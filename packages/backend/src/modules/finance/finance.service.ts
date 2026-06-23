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

export async function getPnL(tenantId: string, from: Date, to: Date): Promise<PnLResult> {
  const orders = await prisma.order.findMany({
    where: { tenantId, createdAt: { gte: from, lte: to }, status: { notIn: EXCLUDED_ORDER_STATUSES } },
    include: { items: { include: { variant: { include: { product: true } } } } },
  });

  const variantIds = Array.from(new Set(orders.flatMap((o) => o.items.map((i) => i.variantId))));

  // Cost basis = the most recent receipt's purchase price per variant, not
  // FIFO/weighted-average - simplest reading of "берётся из закупочной цены".
  const latestReceipts = variantIds.length
    ? await prisma.inventoryMovement.findMany({
        where: { tenantId, variantId: { in: variantIds }, type: "RECEIPT" },
        orderBy: { createdAt: "desc" },
        distinct: ["variantId"],
      })
    : [];
  const latestCostByVariant = new Map(latestReceipts.map((m) => [m.variantId, m.purchasePrice ?? 0]));

  let revenue = 0;
  let cogs = 0;
  const byProductMap = new Map<string, { productName: string; revenue: number; cogs: number }>();

  for (const order of orders) {
    for (const item of order.items) {
      revenue += item.totalPrice;
      const itemCogs = (latestCostByVariant.get(item.variantId) ?? 0) * item.quantity;
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

  return { revenue, orderCount, averageOrderValue, salesOverTime, topProducts };
}
