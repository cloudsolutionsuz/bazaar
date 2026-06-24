import { Prisma, type OrderStatus } from "@prisma/client";
import { prisma } from "../../db/prisma";
import type { CreateTransactionInput, ListTransactionsQuery } from "./finance.schema";

const EXCLUDED_ORDER_STATUSES: OrderStatus[] = ["CANCELLED", "REFUNDED"];

export async function getBalance(tenantId: string): Promise<number> {
  const [income, expense] = await Promise.all([
    prisma.transaction.aggregate({ where: { tenantId, type: "INCOME" }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { tenantId, type: "EXPENSE" }, _sum: { amount: true } }),
  ]);
  return (income._sum.amount ?? 0) - (expense._sum.amount ?? 0);
}

export function createTransaction(tenantId: string, userId: string, input: CreateTransactionInput) {
  return prisma.transaction.create({
    data: {
      tenantId,
      type: input.type,
      category: input.category,
      amount: input.amount,
      description: input.description,
      createdByUserId: userId,
    },
  });
}

export async function listTransactions(tenantId: string, query: ListTransactionsQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  const where: Prisma.TransactionWhereInput = {
    tenantId,
    ...(query.type ? { type: query.type } : {}),
    ...(query.from || query.to
      ? { createdAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.transaction.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.transaction.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

interface ProductBreakdown {
  productId: string;
  productName: string;
  revenue: number;
  cogs: number;
  margin: number;
}

interface PnLResult {
  revenue: number;
  cogs: number;
  expenses: number;
  netProfit: number;
  byProduct: ProductBreakdown[];
}

interface Lot {
  remainingQty: number;
  purchasePrice: number;
}

// FIFO cost of goods sold: replays every RECEIPT/SALE movement for the given
// variants in chronological order (from the very beginning, not just from
// `from`) to know which lots are already partially consumed by the time the
// reporting period starts, then attributes each sale's cost to the oldest
// surviving lot(s) at the price they were actually bought for. SALE
// movements belonging to cancelled/refunded orders are skipped - those
// orders are already excluded from revenue, so they shouldn't consume a lot
// here either (their stock was already restored via a RETURN movement,
// which this function never has to look at as a result).
// Returns cost keyed by "orderId:variantId", summed across all matching
// movements - safe even in the unlikely event an order lists one variant
// more than once.
async function computeFifoCogs(
  tenantId: string,
  variantIds: string[],
  from: Date,
  to: Date,
): Promise<Map<string, number>> {
  const costByOrderVariant = new Map<string, number>();
  if (variantIds.length === 0) return costByOrderVariant;

  const movements = await prisma.inventoryMovement.findMany({
    where: {
      tenantId,
      variantId: { in: variantIds },
      createdAt: { lte: to },
      OR: [{ type: "RECEIPT" }, { type: "SALE", order: { status: { notIn: EXCLUDED_ORDER_STATUSES } } }],
    },
    orderBy: { createdAt: "asc" },
  });

  const lotsByVariant = new Map<string, Lot[]>();
  const lastPriceByVariant = new Map<string, number>();

  for (const m of movements) {
    if (m.type === "RECEIPT") {
      const price = m.purchasePrice ?? 0;
      const lots = lotsByVariant.get(m.variantId) ?? [];
      lots.push({ remainingQty: m.quantity, purchasePrice: price });
      lotsByVariant.set(m.variantId, lots);
      lastPriceByVariant.set(m.variantId, price);
      continue;
    }

    // SALE: m.quantity is negative.
    let qtyToConsume = -m.quantity;
    const lots = lotsByVariant.get(m.variantId) ?? [];
    let cost = 0;
    while (qtyToConsume > 0 && lots.length > 0) {
      const lot = lots[0];
      const consumed = Math.min(lot.remainingQty, qtyToConsume);
      cost += consumed * lot.purchasePrice;
      lot.remainingQty -= consumed;
      qtyToConsume -= consumed;
      if (lot.remainingQty <= 0) lots.shift();
    }
    if (qtyToConsume > 0) {
      // Oversold relative to recorded receipts (e.g. stock seeded directly
      // without a receipt) - cost the shortfall at the last known purchase
      // price rather than silently undercounting COGS.
      cost += qtyToConsume * (lastPriceByVariant.get(m.variantId) ?? 0);
    }

    if (m.createdAt >= from && m.createdAt <= to && m.orderId) {
      const key = `${m.orderId}:${m.variantId}`;
      costByOrderVariant.set(key, (costByOrderVariant.get(key) ?? 0) + cost);
    }
  }

  return costByOrderVariant;
}

export async function getPnL(tenantId: string, from: Date, to: Date): Promise<PnLResult> {
  const orders = await prisma.order.findMany({
    where: { tenantId, createdAt: { gte: from, lte: to }, status: { notIn: EXCLUDED_ORDER_STATUSES } },
    include: { items: { include: { variant: { include: { product: true } } } } },
  });

  const variantIds = Array.from(new Set(orders.flatMap((o) => o.items.map((i) => i.variantId))));
  const fifoCostByOrderVariant = await computeFifoCogs(tenantId, variantIds, from, to);

  let revenue = 0;
  let cogs = 0;
  const byProductMap = new Map<string, { productName: string; revenue: number; cogs: number }>();

  for (const order of orders) {
    for (const item of order.items) {
      revenue += item.totalPrice;
      const itemCogs = fifoCostByOrderVariant.get(`${order.id}:${item.variantId}`) ?? 0;
      cogs += itemCogs;

      const productId = item.variant.productId;
      const entry = byProductMap.get(productId) ?? { productName: item.variant.product.name, revenue: 0, cogs: 0 };
      entry.revenue += item.totalPrice;
      entry.cogs += itemCogs;
      byProductMap.set(productId, entry);
    }
  }

  // Manual expenses only - "Возврат" reversal transactions already net out
  // of revenue via the excluded order statuses above, so including them
  // here too would double-count the loss.
  const manualExpenses = await prisma.transaction.aggregate({
    where: { tenantId, type: "EXPENSE", orderId: null, createdAt: { gte: from, lte: to } },
    _sum: { amount: true },
  });
  const expenses = manualExpenses._sum.amount ?? 0;

  const byProduct = Array.from(byProductMap.entries())
    .map(([productId, v]) => ({
      productId,
      productName: v.productName,
      revenue: v.revenue,
      cogs: v.cogs,
      margin: v.revenue > 0 ? Math.round(((v.revenue - v.cogs) / v.revenue) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return { revenue, cogs, expenses, netProfit: revenue - cogs - expenses, byProduct };
}

type Granularity = "day" | "week" | "month";

function bucketKey(date: Date, granularity: Granularity): string {
  if (granularity === "month") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  if (granularity === "week") {
    const monday = new Date(date);
    const dayOfWeek = (date.getDay() + 6) % 7; // Monday = 0
    monday.setDate(date.getDate() - dayOfWeek);
    return monday.toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

interface AnalyticsResult {
  revenue: number;
  orderCount: number;
  averageOrderValue: number;
  visits: number;
  conversionRate: number;
  salesOverTime: { bucket: string; revenue: number; orderCount: number }[];
  topProducts: { productId: string; productName: string; revenue: number; quantity: number }[];
}

export async function getAnalytics(tenantId: string, from: Date, to: Date, granularity: Granularity = "day"): Promise<AnalyticsResult> {
  const orders = await prisma.order.findMany({
    where: { tenantId, createdAt: { gte: from, lte: to }, status: { notIn: EXCLUDED_ORDER_STATUSES } },
    include: { items: { include: { variant: { include: { product: true } } } } },
  });

  const revenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const orderCount = orders.length;
  const averageOrderValue = orderCount > 0 ? Math.round(revenue / orderCount) : 0;

  const buckets = new Map<string, { revenue: number; orderCount: number }>();
  for (const order of orders) {
    const key = bucketKey(order.createdAt, granularity);
    const entry = buckets.get(key) ?? { revenue: 0, orderCount: 0 };
    entry.revenue += order.totalAmount;
    entry.orderCount += 1;
    buckets.set(key, entry);
  }
  const salesOverTime = Array.from(buckets.entries())
    .map(([bucket, v]) => ({ bucket, ...v }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket));

  const productMap = new Map<string, { productName: string; revenue: number; quantity: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      const productId = item.variant.productId;
      const entry = productMap.get(productId) ?? { productName: item.variant.product.name, revenue: 0, quantity: 0 };
      entry.revenue += item.totalPrice;
      entry.quantity += item.quantity;
      productMap.set(productId, entry);
    }
  }
  const topProducts = Array.from(productMap.entries())
    .map(([productId, v]) => ({ productId, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // A visit is a unique session in the period, not a raw page-view count -
  // one shopper browsing 5 pages is still one visit.
  const visitSessions = await prisma.pageView.findMany({
    where: { tenantId, createdAt: { gte: from, lte: to } },
    distinct: ["sessionId"],
    select: { sessionId: true },
  });
  const visits = visitSessions.length;
  const conversionRate = visits > 0 ? Math.round((orderCount / visits) * 1000) / 10 : 0;

  return { revenue, orderCount, averageOrderValue, visits, conversionRate, salesOverTime, topProducts };
}
