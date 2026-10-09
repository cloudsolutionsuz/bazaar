import crypto from "node:crypto";
import { Prisma, type Agent, type OrderStatus } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { env } from "../../config/env";
import { AppError } from "../../middleware/errorHandler";
import { hashPassword } from "../../utils/password";
import type { BulkBonusInput, CreateAgentInput, CreatePayoutInput, UpdateAgentInput } from "./agents.schema";

const EXCLUDED_ORDER_STATUSES: OrderStatus[] = ["CANCELLED", "REFUNDED"];
const PAYOUT_CATEGORY = "Agent bonusi";
const REF_CODE_ATTEMPTS = 5;

function buildReferralLink(subdomain: string, refCode: string): string {
  const template =
    env.storefrontUrlTemplate ??
    (env.baseDomain === "localhost" ? "http://{subdomain}.localhost:5174" : `https://{subdomain}.${env.baseDomain}`);
  const base = template.replace("{subdomain}", subdomain).replace(/\/+$/, "");
  return `${base}/?ref=${encodeURIComponent(refCode)}`;
}

interface AgentTotals {
  orderCount: number;
  ordersAmount: number;
  bonusAccrued: number;
  bonusPaid: number;
}

const NO_TOTALS: AgentTotals = { orderCount: 0, ordersAmount: 0, bonusAccrued: 0, bonusPaid: 0 };

function toAgentDto(agent: Agent & { user: { email: string } }, subdomain: string, totals: AgentTotals = NO_TOTALS) {
  const { user, userId: _userId, tenantId: _tenantId, ...rest } = agent;
  return {
    ...rest,
    login: user.email,
    link: buildReferralLink(subdomain, agent.refCode),
    ...totals,
    bonusBalance: totals.bonusAccrued - totals.bonusPaid,
  };
}

async function getSubdomain(tenantId: string): Promise<string> {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { subdomain: true } });
  return tenant.subdomain;
}

async function getOwnedAgent(tenantId: string, agentId: string) {
  const agent = await prisma.agent.findFirst({ where: { id: agentId, tenantId }, include: { user: { select: { email: true } } } });
  if (!agent) {
    throw new AppError(404, "NOT_FOUND", "Agent not found");
  }
  return agent;
}

// Balances are never stored - same "don't store derived numbers" convention
// as supplier/customer balances. An agent's balance is always (bonuses earned
// on archived orders) - (bonuses on orders already attached to a payout).
async function computeTotals(tenantId: string, agentIds: string[]): Promise<Map<string, AgentTotals>> {
  const totals = new Map<string, AgentTotals>(agentIds.map((id) => [id, { ...NO_TOTALS }]));
  if (agentIds.length === 0) return totals;

  const scope = { tenantId, agentId: { in: agentIds } };
  const [orders, accrued, paid] = await Promise.all([
    prisma.order.groupBy({
      by: ["agentId"],
      where: { ...scope, status: { notIn: EXCLUDED_ORDER_STATUSES } },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.order.groupBy({ by: ["agentId"], where: { ...scope, agentBonus: { not: null } }, _sum: { agentBonus: true } }),
    prisma.order.groupBy({ by: ["agentId"], where: { ...scope, agentPayoutId: { not: null } }, _sum: { agentBonus: true } }),
  ]);

  for (const row of orders) {
    const entry = totals.get(row.agentId as string);
    if (!entry) continue;
    entry.orderCount = row._count._all;
    entry.ordersAmount = row._sum.totalAmount ?? 0;
  }
  for (const row of accrued) {
    const entry = totals.get(row.agentId as string);
    if (entry) entry.bonusAccrued = row._sum.agentBonus ?? 0;
  }
  for (const row of paid) {
    const entry = totals.get(row.agentId as string);
    if (entry) entry.bonusPaid = row._sum.agentBonus ?? 0;
  }
  return totals;
}

export async function listAgents(tenantId: string) {
  const [agents, subdomain] = await Promise.all([
    prisma.agent.findMany({ where: { tenantId }, include: { user: { select: { email: true } } }, orderBy: { createdAt: "desc" } }),
    getSubdomain(tenantId),
  ]);
  const totals = await computeTotals(tenantId, agents.map((a) => a.id));
  return agents.map((agent) => toAgentDto(agent, subdomain, totals.get(agent.id)));
}

export async function getAgent(tenantId: string, agentId: string) {
  const [agent, subdomain, totals] = await Promise.all([
    getOwnedAgent(tenantId, agentId),
    getSubdomain(tenantId),
    computeTotals(tenantId, [agentId]),
  ]);
  return toAgentDto(agent, subdomain, totals.get(agentId));
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

async function assertLoginAvailable(login: string, exceptUserId?: string): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email: login }, select: { id: true } });
  if (existing && existing.id !== exceptUserId) {
    throw new AppError(409, "LOGIN_TAKEN", "This login is already taken");
  }
}

async function generateRefCode(tenantId: string): Promise<string> {
  for (let attempt = 0; attempt < REF_CODE_ATTEMPTS; attempt++) {
    const refCode = crypto.randomBytes(4).toString("hex");
    const taken = await prisma.agent.findFirst({ where: { tenantId, refCode }, select: { id: true } });
    if (!taken) return refCode;
  }
  throw new AppError(500, "REF_CODE_FAILED", "Could not generate a referral code, please try again");
}

export async function createAgent(tenantId: string, input: CreateAgentInput) {
  await assertLoginAvailable(input.login);
  const [passwordHash, refCode] = await Promise.all([hashPassword(input.password), generateRefCode(tenantId)]);

  try {
    const agent = await prisma.$transaction(async (tx) => {
      // The agent's login lives in users.email: that column is the one
      // globally-unique login identifier the auth flow already knows.
      const user = await tx.user.create({
        data: {
          tenantId,
          email: input.login,
          passwordHash,
          role: "AGENT",
          name: input.fullName,
          phone: input.phone,
          emailVerifiedAt: new Date(),
        },
      });
      return tx.agent.create({
        data: {
          tenantId,
          userId: user.id,
          fullName: input.fullName,
          phone: input.phone,
          telegram: input.telegram || null,
          instagram: input.instagram || null,
          youtube: input.youtube || null,
          tiktok: input.tiktok || null,
          refCode,
          bonusType: input.bonusType,
          bonusValue: input.bonusValue,
        },
      });
    });
    return getAgent(tenantId, agent.id);
  } catch (err) {
    // Two requests racing for the same login both pass assertLoginAvailable.
    if (isUniqueViolation(err)) {
      throw new AppError(409, "LOGIN_TAKEN", "This login is already taken");
    }
    throw err;
  }
}

export async function updateAgent(tenantId: string, agentId: string, input: UpdateAgentInput) {
  const agent = await getOwnedAgent(tenantId, agentId);
  if (input.login !== undefined) {
    await assertLoginAvailable(input.login, agent.userId);
  }
  const passwordHash = input.password ? await hashPassword(input.password) : undefined;
  // A new password or a deactivation must end the sessions already open.
  const revokeSessions = passwordHash !== undefined || input.isActive === false;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: agent.userId },
        data: {
          ...(input.login !== undefined ? { email: input.login } : {}),
          ...(input.fullName !== undefined ? { name: input.fullName } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(passwordHash !== undefined ? { passwordHash } : {}),
        },
      });
      await tx.agent.update({
        where: { id: agentId },
        data: {
          ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.telegram !== undefined ? { telegram: input.telegram || null } : {}),
          ...(input.instagram !== undefined ? { instagram: input.instagram || null } : {}),
          ...(input.youtube !== undefined ? { youtube: input.youtube || null } : {}),
          ...(input.tiktok !== undefined ? { tiktok: input.tiktok || null } : {}),
          ...(input.bonusType !== undefined ? { bonusType: input.bonusType } : {}),
          ...(input.bonusValue !== undefined ? { bonusValue: input.bonusValue } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });
      if (revokeSessions) {
        await tx.refreshToken.updateMany({ where: { userId: agent.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      }
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AppError(409, "LOGIN_TAKEN", "This login is already taken");
    }
    throw err;
  }

  return getAgent(tenantId, agentId);
}

// An agent with sales or payouts is history the reports depend on - it can
// only be deactivated, never deleted.
export async function deleteAgent(tenantId: string, agentId: string): Promise<void> {
  const agent = await getOwnedAgent(tenantId, agentId);

  const [orderCount, payoutCount] = await Promise.all([
    prisma.order.count({ where: { agentId } }),
    prisma.agentPayout.count({ where: { agentId } }),
  ]);
  if (orderCount > 0 || payoutCount > 0) {
    throw new AppError(409, "AGENT_HAS_HISTORY", "This agent has orders or payouts; deactivate instead of deleting");
  }

  await prisma.$transaction([
    prisma.agent.delete({ where: { id: agentId } }),
    // RefreshToken/VerificationToken cascade-delete with the user.
    prisma.user.delete({ where: { id: agent.userId } }),
  ]);
}

export async function bulkSetBonus(tenantId: string, input: BulkBonusInput): Promise<{ updated: number }> {
  const result = await prisma.agent.updateMany({
    where: { tenantId, ...(input.agentIds ? { id: { in: input.agentIds } } : {}) },
    data: { bonusType: input.bonusType, bonusValue: input.bonusValue },
  });
  return { updated: result.count };
}

// What the Kassa can pay an agent right now: archived orders whose bonus has
// been earned and isn't attached to any payout yet.
const payableWhere = (tenantId: string, agentId: string): Prisma.OrderWhereInput => ({
  tenantId,
  agentId,
  status: "ARCHIVED",
  agentBonus: { gt: 0 },
  agentPayoutId: null,
});

export async function getUnpaidOrders(tenantId: string, agentId: string) {
  await getOwnedAgent(tenantId, agentId);
  const orders = await prisma.order.findMany({
    where: payableWhere(tenantId, agentId),
    select: { id: true, customerName: true, totalAmount: true, agentBonus: true, agentBonusAccruedAt: true, createdAt: true },
    orderBy: { agentBonusAccruedAt: "asc" },
  });
  const items = orders.map((o) => ({ ...o, agentBonus: o.agentBonus ?? 0 }));
  return { items, totalAmount: items.reduce((sum, o) => sum + o.agentBonus, 0) };
}

export async function createPayout(tenantId: string, userId: string, agentId: string, input: CreatePayoutInput) {
  const agent = await getOwnedAgent(tenantId, agentId);
  const register = await prisma.cashRegister.findFirst({ where: { id: input.cashRegisterId, tenantId, isActive: true } });
  if (!register) {
    throw new AppError(404, "REGISTER_NOT_FOUND", "Cash register not found or inactive");
  }
  const orderIds = [...new Set(input.orderIds)];

  return prisma.$transaction(async (tx) => {
    const orders = await tx.order.findMany({
      where: { ...payableWhere(tenantId, agentId), id: { in: orderIds } },
      select: { id: true, agentBonus: true },
    });
    if (orders.length !== orderIds.length) {
      throw new AppError(400, "INVALID_ORDERS", "Some orders are not payable: already paid, not archived, or not this agent's");
    }
    const amount = orders.reduce((sum, o) => sum + (o.agentBonus ?? 0), 0);

    const transaction = await tx.transaction.create({
      data: {
        tenantId,
        type: "EXPENSE",
        category: PAYOUT_CATEGORY,
        amount,
        description: `${agent.fullName} (${orders.length})`,
        cashRegisterId: register.id,
        agentId,
        createdByUserId: userId,
      },
    });
    const payout = await tx.agentPayout.create({
      data: { tenantId, agentId, amount, transactionId: transaction.id, createdByUserId: userId },
    });

    // The agentPayoutId: null guard makes a concurrent payout of the same
    // order lose the race instead of paying the bonus twice.
    const claimed = await tx.order.updateMany({
      where: { id: { in: orderIds }, agentPayoutId: null },
      data: { agentPayoutId: payout.id },
    });
    if (claimed.count !== orderIds.length) {
      throw new AppError(409, "ALREADY_PAID", "Some of these orders were just paid by someone else");
    }

    return { payout: { ...payout, orderCount: orders.length } };
  });
}
