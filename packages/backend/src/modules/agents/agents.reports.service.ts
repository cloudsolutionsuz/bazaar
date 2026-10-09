import ExcelJS from "exceljs";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { goodsAmountOf } from "./agents.bonus";
import type { AgentPeriodQuery, AgentSalesQuery } from "./agents.schema";

// scopeAgentId is the agent a request is locked to: an AGENT login can only
// ever see itself, whatever agentId the query string asks for. Staff pass
// undefined and may filter by any agent (or none).
function resolveAgentId(scopeAgentId: string | undefined, requested: string | undefined): string | undefined {
  return scopeAgentId ?? requested;
}

function dateRange(from?: Date, to?: Date): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  return { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
}

const UNPAID: Prisma.OrderWhereInput = { status: "ARCHIVED", agentBonus: { gt: 0 }, agentPayoutId: null };
const PAID: Prisma.OrderWhereInput = { agentPayoutId: { not: null } };

function salesWhere(tenantId: string, query: AgentSalesQuery, scopeAgentId?: string): Prisma.OrderWhereInput {
  const agentId = resolveAgentId(scopeAgentId, query.agentId);
  const createdAt = dateRange(query.from, query.to);
  // AND-ed as separate clauses: "status" and the unpaid filter both
  // constrain order.status, and one must never silently overwrite the other.
  return {
    AND: [
      { tenantId, agentId: agentId ?? { not: null } },
      ...(createdAt ? [{ createdAt }] : []),
      ...(query.status ? [{ status: query.status }] : []),
      ...(query.payment === "paid" ? [PAID] : query.payment === "unpaid" ? [UNPAID] : []),
    ],
  };
}

export async function getSales(tenantId: string, query: AgentSalesQuery, scopeAgentId?: string) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const where = salesWhere(tenantId, query, scopeAgentId);

  const [orders, byStatus, accrued, paid, unpaid] = await Promise.all([
    prisma.order.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        customerName: true,
        status: true,
        totalAmount: true,
        discountAmount: true,
        agentBonus: true,
        agentBonusAccruedAt: true,
        agentId: true,
        agent: { select: { fullName: true } },
        agentPayout: { select: { createdAt: true } },
        items: { select: { totalPrice: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.groupBy({ by: ["status"], where, _count: { _all: true }, _sum: { totalAmount: true } }),
    prisma.order.aggregate({ where: { AND: [where, { agentBonus: { not: null } }] }, _sum: { agentBonus: true } }),
    prisma.order.aggregate({ where: { AND: [where, PAID] }, _count: { _all: true }, _sum: { agentBonus: true } }),
    prisma.order.aggregate({ where: { AND: [where, UNPAID] }, _count: { _all: true }, _sum: { agentBonus: true } }),
  ]);

  const statusRows = byStatus.map((row) => ({ status: row.status, count: row._count._all, amount: row._sum.totalAmount ?? 0 }));
  const archived = statusRows.find((row) => row.status === "ARCHIVED");
  const total = statusRows.reduce((sum, row) => sum + row.count, 0);
  // The headline numbers count real sales only, same as the agents list;
  // cancelled/refunded orders still show in the per-status breakdown.
  const sold = statusRows.filter((row) => row.status !== "CANCELLED" && row.status !== "REFUNDED");

  return {
    summary: {
      totalCount: sold.reduce((sum, row) => sum + row.count, 0),
      totalAmount: sold.reduce((sum, row) => sum + row.amount, 0),
      byStatus: statusRows,
      archivedCount: archived?.count ?? 0,
      archivedAmount: archived?.amount ?? 0,
      bonusAccrued: accrued._sum.agentBonus ?? 0,
      paidCount: paid._count._all,
      paidAmount: paid._sum.agentBonus ?? 0,
      unpaidCount: unpaid._count._all,
      unpaidAmount: unpaid._sum.agentBonus ?? 0,
    },
    items: orders.map((o) => ({
      id: o.id,
      createdAt: o.createdAt,
      customerName: o.customerName,
      status: o.status,
      totalAmount: o.totalAmount,
      goodsAmount: goodsAmountOf(o),
      agentBonus: o.agentBonus,
      agentBonusAccruedAt: o.agentBonusAccruedAt,
      isPaid: o.agentPayout !== null,
      paidAt: o.agentPayout?.createdAt ?? null,
      agentId: o.agentId,
      agentName: o.agent?.fullName ?? null,
    })),
    total,
    page,
    pageSize,
  };
}

const MAX_PAYOUT_ROWS = 500;

export async function getPayouts(tenantId: string, query: AgentPeriodQuery, scopeAgentId?: string) {
  const agentId = resolveAgentId(scopeAgentId, query.agentId);
  const createdAt = dateRange(query.from, query.to);
  const where: Prisma.AgentPayoutWhereInput = { tenantId, ...(agentId ? { agentId } : {}), ...(createdAt ? { createdAt } : {}) };

  const [payouts, totals] = await Promise.all([
    prisma.agentPayout.findMany({
      where,
      include: { agent: { select: { fullName: true } }, _count: { select: { orders: true } } },
      orderBy: { createdAt: "desc" },
      take: MAX_PAYOUT_ROWS,
    }),
    prisma.agentPayout.aggregate({ where, _count: { _all: true }, _sum: { amount: true } }),
  ]);

  return {
    items: payouts.map((p) => ({
      id: p.id,
      createdAt: p.createdAt,
      amount: p.amount,
      agentId: p.agentId,
      agentName: p.agent.fullName,
      orderCount: p._count.orders,
    })),
    count: totals._count._all,
    totalAmount: totals._sum.amount ?? 0,
  };
}

export interface ReconciliationRow {
  agentId: string;
  fullName: string;
  phone: string;
  openingBalance: number;
  archivedCount: number;
  salesAmount: number;
  accrued: number;
  paid: number;
  closingBalance: number;
}

// Akt-sverka: per agent, what the shop owed at the start of the period, what
// was earned and paid during it, and what's still owed at the end. "Earned"
// is dated by when the order was archived, "paid" by when the Kassa paid.
export async function getReconciliation(tenantId: string, query: AgentPeriodQuery, scopeAgentId?: string) {
  const agentId = resolveAgentId(scopeAgentId, query.agentId);
  const agents = await prisma.agent.findMany({
    where: { tenantId, ...(agentId ? { id: agentId } : {}) },
    select: { id: true, fullName: true, phone: true },
    orderBy: { fullName: "asc" },
  });
  const agentIds = agents.map((a) => a.id);
  const inPeriod = dateRange(query.from, query.to);
  const orderScope: Prisma.OrderWhereInput = { tenantId, agentId: { in: agentIds }, agentBonus: { not: null } };
  const payoutScope: Prisma.AgentPayoutWhereInput = { tenantId, agentId: { in: agentIds } };

  // Without a start date there is no "before the period", so opening is 0.
  const [accruedBefore, paidBefore, accruedIn, paidIn] = await Promise.all([
    query.from
      ? prisma.order.groupBy({ by: ["agentId"], where: { ...orderScope, agentBonusAccruedAt: { lt: query.from } }, _sum: { agentBonus: true } })
      : [],
    query.from
      ? prisma.agentPayout.groupBy({ by: ["agentId"], where: { ...payoutScope, createdAt: { lt: query.from } }, _sum: { amount: true } })
      : [],
    prisma.order.groupBy({
      by: ["agentId"],
      where: { ...orderScope, ...(inPeriod ? { agentBonusAccruedAt: inPeriod } : {}) },
      _count: { _all: true },
      _sum: { agentBonus: true, totalAmount: true },
    }),
    prisma.agentPayout.groupBy({
      by: ["agentId"],
      where: { ...payoutScope, ...(inPeriod ? { createdAt: inPeriod } : {}) },
      _sum: { amount: true },
    }),
  ]);

  const accruedBeforeBy = new Map(accruedBefore.map((r) => [r.agentId, r._sum.agentBonus ?? 0]));
  const paidBeforeBy = new Map(paidBefore.map((r) => [r.agentId, r._sum.amount ?? 0]));
  const accruedInBy = new Map(accruedIn.map((r) => [r.agentId, r]));
  const paidInBy = new Map(paidIn.map((r) => [r.agentId, r._sum.amount ?? 0]));

  const rows: ReconciliationRow[] = agents.map((agent) => {
    const openingBalance = (accruedBeforeBy.get(agent.id) ?? 0) - (paidBeforeBy.get(agent.id) ?? 0);
    const period = accruedInBy.get(agent.id);
    const accrued = period?._sum.agentBonus ?? 0;
    const paid = paidInBy.get(agent.id) ?? 0;
    return {
      agentId: agent.id,
      fullName: agent.fullName,
      phone: agent.phone,
      openingBalance,
      archivedCount: period?._count._all ?? 0,
      salesAmount: period?._sum.totalAmount ?? 0,
      accrued,
      paid,
      closingBalance: openingBalance + accrued - paid,
    };
  });

  const sum = (pick: (row: ReconciliationRow) => number) => rows.reduce((total, row) => total + pick(row), 0);
  return {
    rows,
    totals: {
      openingBalance: sum((r) => r.openingBalance),
      archivedCount: sum((r) => r.archivedCount),
      salesAmount: sum((r) => r.salesAmount),
      accrued: sum((r) => r.accrued),
      paid: sum((r) => r.paid),
      closingBalance: sum((r) => r.closingBalance),
    },
  };
}

export async function exportReconciliationToExcel(tenantId: string, query: AgentPeriodQuery, scopeAgentId?: string): Promise<Buffer> {
  const { rows, totals } = await getReconciliation(tenantId, query, scopeAgentId);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Akt-sverka");
  const period = [query.from, query.to].map((d) => (d ? d.toLocaleDateString("ru-RU") : "…")).join(" — ");
  sheet.addRow([`Agentlar bilan akt-sverka: ${period}`]).font = { bold: true };
  sheet.addRow([]);

  const header = sheet.addRow([
    "Agent",
    "Telefon",
    "Davr boshidagi qoldiq",
    "Arxiv buyurtmalar soni",
    "Sotuv summasi",
    "Hisoblangan bonus",
    "To'langan",
    "Davr oxiridagi qoldiq",
  ]);
  header.font = { bold: true };

  for (const row of rows) {
    sheet.addRow([row.fullName, row.phone, row.openingBalance, row.archivedCount, row.salesAmount, row.accrued, row.paid, row.closingBalance]);
  }
  sheet.addRow([
    "Jami",
    "",
    totals.openingBalance,
    totals.archivedCount,
    totals.salesAmount,
    totals.accrued,
    totals.paid,
    totals.closingBalance,
  ]).font = { bold: true };

  sheet.columns.forEach((col) => {
    col.width = 24;
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
