import type { AgentBonusType, Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";

// Kept apart from agents.service.ts because orders.service.ts needs these two
// during checkout/archiving, and agents.service.ts in turn reads orders.

export function findActiveAgentByRefCode(tenantId: string, refCode: string) {
  return prisma.agent.findFirst({ where: { tenantId, refCode, isActive: true }, select: { id: true } });
}

// What the bonus percentage applies to: the goods themselves after product
// discounts and the promo code, without the delivery fee.
export function goodsAmountOf(order: { discountAmount: number; items: { totalPrice: number }[] }): number {
  const itemsTotal = order.items.reduce((sum, item) => sum + item.totalPrice, 0);
  return Math.max(0, itemsTotal - order.discountAmount);
}

export function computeAgentBonus(bonusType: AgentBonusType, bonusValue: number, goodsAmount: number): number {
  if (bonusType === "FIXED") return bonusValue;
  return Math.round((goodsAmount * bonusValue) / 100);
}

// Snapshots the bonus onto the order using the agent's terms at this moment,
// so changing an agent's bonus later never rewrites what was already earned.
export async function accrueAgentBonus(
  tx: Prisma.TransactionClient,
  order: { id: string; agentId: string | null; discountAmount: number; items: { totalPrice: number }[] },
): Promise<void> {
  if (!order.agentId) return;
  const agent = await tx.agent.findUnique({ where: { id: order.agentId }, select: { bonusType: true, bonusValue: true } });
  if (!agent) return;

  // agentBonus: null makes this a one-time write: a second, concurrent
  // "archive" of the same order can't re-price a bonus that may already be
  // on its way to being paid out.
  await tx.order.updateMany({
    where: { id: order.id, agentBonus: null },
    data: {
      agentBonus: computeAgentBonus(agent.bonusType, agent.bonusValue, goodsAmountOf(order)),
      agentBonusAccruedAt: new Date(),
    },
  });
}
