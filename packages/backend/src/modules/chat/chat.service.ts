import { prisma } from "../../db/prisma";
import { AppError } from "../../middleware/errorHandler";

// "Last message per customer" via Prisma's distinct+orderBy combo: ordering
// by createdAt desc means distinct keeps the first (= newest) row it sees
// per customerId, and the result stays sorted by that same order - exactly
// the "latest row per group" the inbox list needs, without a raw query.
export async function listThreads(tenantId: string) {
  const [lastMessages, unreadCounts] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { tenantId },
      distinct: ["customerId"],
      orderBy: { createdAt: "desc" },
      include: { customer: true },
    }),
    prisma.chatMessage.groupBy({
      by: ["customerId"],
      where: { tenantId, sender: "CUSTOMER", readAt: null },
      _count: { _all: true },
    }),
  ]);

  const unreadByCustomer = new Map(unreadCounts.map((u) => [u.customerId, u._count._all]));

  return lastMessages.map((m) => ({
    customerId: m.customerId,
    customerName: m.customer.name,
    customerPhone: m.customer.phone,
    lastMessageText: m.text,
    lastMessageSender: m.sender,
    lastMessageAt: m.createdAt,
    unreadCount: unreadByCustomer.get(m.customerId) ?? 0,
  }));
}

// Cheaper than listThreads() when the dashboard just needs a number, not
// every thread's preview.
export function getUnreadCount(tenantId: string): Promise<number> {
  return prisma.chatMessage.count({ where: { tenantId, sender: "CUSTOMER", readAt: null } });
}

async function getCustomerOrThrow(tenantId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId } });
  if (!customer) {
    throw new AppError(404, "NOT_FOUND", "Customer not found");
  }
  return customer;
}

// Opening a thread *is* the read receipt - there's no separate "mark as
// read" action, matching how a buyer has no equivalent affordance either.
export async function getThreadMessages(tenantId: string, customerId: string) {
  const customer = await getCustomerOrThrow(tenantId, customerId);

  const messages = await prisma.chatMessage.findMany({
    where: { tenantId, customerId },
    orderBy: { createdAt: "asc" },
  });

  await prisma.chatMessage.updateMany({
    where: { tenantId, customerId, sender: "CUSTOMER", readAt: null },
    data: { readAt: new Date() },
  });

  return { customer, messages };
}

export async function sendStaffMessage(tenantId: string, userId: string, customerId: string, text: string) {
  await getCustomerOrThrow(tenantId, customerId);

  return prisma.chatMessage.create({
    data: { tenantId, customerId, sender: "STAFF", text, createdByUserId: userId },
  });
}
