import { prisma } from "../../db/prisma";

export async function getTenantMessages(tenantId: string) {
  const messages = await prisma.supportMessage.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
  });
  // Mark SUPER_ADMIN messages as read when tenant views the chat
  await prisma.supportMessage.updateMany({
    where: { tenantId, sender: "SUPER_ADMIN", readAt: null },
    data: { readAt: new Date() },
  });
  return messages;
}

export function sendTenantMessage(tenantId: string, text: string) {
  return prisma.supportMessage.create({ data: { tenantId, sender: "TENANT", text } });
}

export function getTenantUnreadCount(tenantId: string) {
  return prisma.supportMessage.count({ where: { tenantId, sender: "SUPER_ADMIN", readAt: null } });
}

// Super admin: list all tenants that have ever sent a support message, newest first
export async function listSupportChats() {
  const [lastMessages, unreadCounts] = await Promise.all([
    prisma.supportMessage.findMany({
      distinct: ["tenantId"],
      orderBy: { createdAt: "desc" },
      include: { tenant: { select: { name: true } } },
    }),
    prisma.supportMessage.groupBy({
      by: ["tenantId"],
      where: { sender: "TENANT", readAt: null },
      _count: { _all: true },
    }),
  ]);

  const unreadMap = new Map(unreadCounts.map((u) => [u.tenantId, u._count._all]));

  return lastMessages.map((m) => ({
    tenantId: m.tenantId,
    tenantName: m.tenant.name,
    lastText: m.text,
    lastSender: m.sender,
    lastAt: m.createdAt,
    unreadCount: unreadMap.get(m.tenantId) ?? 0,
  }));
}

export async function getSuperAdminMessages(tenantId: string) {
  const messages = await prisma.supportMessage.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
  });
  // Mark TENANT messages as read when super admin views the conversation
  await prisma.supportMessage.updateMany({
    where: { tenantId, sender: "TENANT", readAt: null },
    data: { readAt: new Date() },
  });
  return messages;
}

export function sendSuperAdminMessage(tenantId: string, text: string) {
  return prisma.supportMessage.create({ data: { tenantId, sender: "SUPER_ADMIN", text } });
}

export function getSuperAdminUnreadCount() {
  return prisma.supportMessage.count({ where: { sender: "TENANT", readAt: null } });
}
