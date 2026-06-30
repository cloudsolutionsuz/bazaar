import ExcelJS from "exceljs";
import { Prisma, type OrderStatus } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { AppError } from "../../middleware/errorHandler";
import type { ListCustomersQuery } from "./customers.schema";

const EXCLUDED_ORDER_STATUSES: OrderStatus[] = ["CANCELLED", "REFUNDED"];

// Paid amount is never stored - same "don't store derived numbers"
// convention as supplier/Kassa balances - it's the sum of CONFIRMED income
// transactions linked to the customer (a PENDING transaction hasn't been
// confirmed by the cashier yet, so it isn't "paid" until then).
async function computePaidAmounts(tenantId: string, customerIds: string[]): Promise<Map<string, number>> {
  const paid = new Map<string, number>();
  if (customerIds.length === 0) return paid;

  const grouped = await prisma.transaction.groupBy({
    by: ["customerId"],
    where: { tenantId, customerId: { in: customerIds }, type: "INCOME", status: "CONFIRMED" },
    _sum: { amount: true },
  });
  for (const g of grouped) {
    if (!g.customerId) continue;
    paid.set(g.customerId, g._sum.amount ?? 0);
  }
  return paid;
}

export async function listCustomers(tenantId: string, query: ListCustomersQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  const where: Prisma.CustomerWhereInput = {
    tenantId,
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { phone: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: {
        orders: { where: { status: { notIn: EXCLUDED_ORDER_STATUSES } }, select: { totalAmount: true, createdAt: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.customer.count({ where }),
  ]);

  const paidAmounts = await computePaidAmounts(tenantId, customers.map((c) => c.id));

  const items = customers.map((c) => {
    const purchaseAmount = c.orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const paidAmount = paidAmounts.get(c.id) ?? 0;
    return {
      id: c.id,
      phone: c.phone,
      name: c.name,
      addressRegion: c.addressRegion,
      addressDistrict: c.addressDistrict,
      addressMahalla: c.addressMahalla,
      createdAt: c.createdAt,
      orderCount: c.orders.length,
      purchaseAmount,
      paidAmount,
      balance: purchaseAmount - paidAmount,
      lastOrderAt: c.orders.length > 0 ? c.orders.reduce((max, o) => (o.createdAt > max ? o.createdAt : max), c.orders[0].createdAt) : null,
    };
  });

  return { items, total, page, pageSize };
}

// The customer's full order history, including cancelled/refunded ones - on
// a detail card that's context worth keeping visible, unlike the list view's
// purchaseAmount/orderCount which deliberately exclude them (matches listCustomers).
export async function getCustomer(tenantId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        include: {
          items: { include: { variant: { include: { product: true } } } },
          statusHistory: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  if (!customer) {
    throw new AppError(404, "NOT_FOUND", "Customer not found");
  }

  const billableOrders = customer.orders.filter((o) => !EXCLUDED_ORDER_STATUSES.includes(o.status));
  const purchaseAmount = billableOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const paidAmount = (await computePaidAmounts(tenantId, [customer.id])).get(customer.id) ?? 0;

  return {
    id: customer.id,
    phone: customer.phone,
    name: customer.name,
    addressRegion: customer.addressRegion,
    addressDistrict: customer.addressDistrict,
    addressMahalla: customer.addressMahalla,
    createdAt: customer.createdAt,
    orderCount: billableOrders.length,
    purchaseAmount,
    paidAmount,
    balance: purchaseAmount - paidAmount,
    orders: customer.orders,
  };
}

export async function exportCustomersToExcel(tenantId: string): Promise<Buffer> {
  const customers = await prisma.customer.findMany({
    where: { tenantId },
    include: { orders: { where: { status: { notIn: EXCLUDED_ORDER_STATUSES } }, select: { totalAmount: true, createdAt: true } } },
    orderBy: { createdAt: "desc" },
  });

  const paidAmounts = await computePaidAmounts(tenantId, customers.map((c) => c.id));

  const items = customers.map((c) => {
    const purchaseAmount = c.orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const paidAmount = paidAmounts.get(c.id) ?? 0;
    return {
      name: c.name,
      phone: c.phone,
      addressRegion: c.addressRegion,
      addressDistrict: c.addressDistrict,
      addressMahalla: c.addressMahalla,
      createdAt: c.createdAt,
      orderCount: c.orders.length,
      purchaseAmount,
      paidAmount,
      balance: purchaseAmount - paidAmount,
      lastOrderAt: c.orders.length > 0 ? c.orders.reduce((max, o) => (o.createdAt > max ? o.createdAt : max), c.orders[0].createdAt) : null,
    };
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Customers");
  sheet.addRow([
    "Name",
    "Phone",
    "Region",
    "District",
    "Mahalla",
    "Order Count",
    "Purchase Amount",
    "Paid Amount",
    "Balance",
    "Last Order At",
    "Customer Since",
  ]);

  for (const c of items) {
    sheet.addRow([
      c.name,
      c.phone,
      c.addressRegion ?? "",
      c.addressDistrict ?? "",
      c.addressMahalla ?? "",
      c.orderCount,
      c.purchaseAmount,
      c.paidAmount,
      c.balance,
      c.lastOrderAt?.toISOString() ?? "",
      c.createdAt.toISOString(),
    ]);
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
