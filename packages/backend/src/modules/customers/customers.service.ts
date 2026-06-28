import ExcelJS from "exceljs";
import { Prisma, type OrderStatus } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { AppError } from "../../middleware/errorHandler";
import type { ListCustomersQuery } from "./customers.schema";

const EXCLUDED_ORDER_STATUSES: OrderStatus[] = ["CANCELLED", "REFUNDED"];

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

  const items = customers.map((c) => ({
    id: c.id,
    phone: c.phone,
    name: c.name,
    createdAt: c.createdAt,
    orderCount: c.orders.length,
    totalSpent: c.orders.reduce((sum, o) => sum + o.totalAmount, 0),
    lastOrderAt: c.orders.length > 0 ? c.orders.reduce((max, o) => (o.createdAt > max ? o.createdAt : max), c.orders[0].createdAt) : null,
  }));

  return { items, total, page, pageSize };
}

// The customer's full order history, including cancelled/refunded ones - on
// a detail card that's context worth keeping visible, unlike the list view's
// totalSpent/orderCount which deliberately exclude them (matches listCustomers).
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
  const totalSpent = billableOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  return {
    id: customer.id,
    phone: customer.phone,
    name: customer.name,
    createdAt: customer.createdAt,
    orderCount: billableOrders.length,
    totalSpent,
    orders: customer.orders,
  };
}

export async function exportCustomersToExcel(tenantId: string): Promise<Buffer> {
  const customers = await prisma.customer.findMany({
    where: { tenantId },
    include: { orders: { where: { status: { notIn: EXCLUDED_ORDER_STATUSES } }, select: { totalAmount: true, createdAt: true } } },
    orderBy: { createdAt: "desc" },
  });

  const items = customers.map((c) => ({
    name: c.name,
    phone: c.phone,
    createdAt: c.createdAt,
    orderCount: c.orders.length,
    totalSpent: c.orders.reduce((sum, o) => sum + o.totalAmount, 0),
    lastOrderAt: c.orders.length > 0 ? c.orders.reduce((max, o) => (o.createdAt > max ? o.createdAt : max), c.orders[0].createdAt) : null,
  }));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Customers");
  sheet.addRow(["Name", "Phone", "Order Count", "Total Spent", "Last Order At", "Customer Since"]);

  for (const c of items) {
    sheet.addRow([c.name, c.phone, c.orderCount, c.totalSpent, c.lastOrderAt?.toISOString() ?? "", c.createdAt.toISOString()]);
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
