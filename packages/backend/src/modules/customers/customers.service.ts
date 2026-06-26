import { Prisma, type OrderStatus } from "@prisma/client";
import { prisma } from "../../db/prisma";
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
