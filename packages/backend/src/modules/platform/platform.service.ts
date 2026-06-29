import { Prisma, type TenantStatus } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { AppError } from "../../middleware/errorHandler";
import { toPublicUser } from "../auth/auth.service";
import type { ListTenantsQuery } from "./platform.schema";

const tenantListInclude = {
  plan: true,
  users: { where: { role: "OWNER" as const }, take: 1 },
  invoices: { orderBy: { createdAt: "desc" as const }, take: 1 },
};

// LTV is never stored - replayed from PAID invoices, same "don't store
// derived numbers" convention as Kassa's balance and supplier debt.
// groupBy can't be done per-tenant-on-demand for a single id efficiently
// different from a batch, so this one function serves both listTenants
// (a page of ids) and getTenantDetail (a single id in an array).
async function computeLtv(tenantIds: string[]): Promise<Map<string, number>> {
  if (tenantIds.length === 0) return new Map();
  const sums = await prisma.billingInvoice.groupBy({
    by: ["tenantId"],
    where: { tenantId: { in: tenantIds }, status: "PAID" },
    _sum: { amount: true },
  });
  return new Map(sums.map((s) => [s.tenantId, s._sum.amount ?? 0]));
}

export async function listTenants(query: ListTenantsQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  const where: Prisma.TenantWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { subdomain: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      include: tenantListInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.tenant.count({ where }),
  ]);

  const ltvByTenant = await computeLtv(tenants.map((t) => t.id));
  const items = tenants.map((tenant) => ({
    ...tenant,
    users: tenant.users.map(toPublicUser),
    ltv: ltvByTenant.get(tenant.id) ?? 0,
  }));
  return { items, total, page, pageSize };
}

export async function getTenantDetail(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      plan: true,
      users: { orderBy: { createdAt: "asc" } },
      invoices: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!tenant) {
    throw new AppError(404, "NOT_FOUND", "Tenant not found");
  }
  const ltvByTenant = await computeLtv([tenantId]);
  return { ...tenant, users: tenant.users.map(toPublicUser), ltv: ltvByTenant.get(tenantId) ?? 0 };
}

export async function updateTenantVip(tenantId: string, isVip: boolean) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    throw new AppError(404, "NOT_FOUND", "Tenant not found");
  }

  // Marking VIP is itself an unblock - a VIP tenant can't sensibly sit in
  // TRIAL/PAST_DUE/BLOCKED once the billing cycle will never touch them again.
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { isVip, ...(isVip ? { status: "ACTIVE" as const } : {}) },
  });
  return getTenantDetail(tenantId);
}

interface TimelineSegment {
  start: Date;
  end: Date;
  status: string;
  label: string;
}

// A "Gantt-style" view of every tenant's billing history: one segment for
// the trial period (if any) plus one per invoice, each carrying its own
// status so the admin UI can color-code them - reuses the exact same
// search/status filters as listTenants, just with the full invoice history
// instead of only the latest one.
export async function getBillingTimeline(query: ListTenantsQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  const where: Prisma.TenantWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { subdomain: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      include: { invoices: { orderBy: { periodStart: "asc" } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.tenant.count({ where }),
  ]);

  const items = tenants.map((tenant) => {
    const segments: TimelineSegment[] = [];
    if (tenant.trialEndsAt) {
      segments.push({ start: tenant.createdAt, end: tenant.trialEndsAt, status: "TRIAL", label: "Trial" });
    }
    for (const invoice of tenant.invoices) {
      segments.push({ start: invoice.periodStart, end: invoice.periodEnd, status: invoice.status, label: invoice.planCode });
    }
    return { tenantId: tenant.id, tenantName: tenant.name, isVip: tenant.isVip, segments };
  });

  return { items, total, page, pageSize };
}

export async function updateTenantPlan(tenantId: string, planId: string) {
  const [tenant, plan] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.plan.findUnique({ where: { id: planId } }),
  ]);
  if (!tenant) {
    throw new AppError(404, "NOT_FOUND", "Tenant not found");
  }
  if (!plan) {
    throw new AppError(404, "NOT_FOUND", "Plan not found");
  }

  await prisma.tenant.update({ where: { id: tenantId }, data: { planId } });
  return getTenantDetail(tenantId);
}

export async function getStats() {
  const [countsByStatus, activeTenants, paidTotal] = await Promise.all([
    prisma.tenant.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.tenant.findMany({ where: { status: "ACTIVE" }, select: { plan: { select: { priceSum: true } } } }),
    prisma.billingInvoice.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
  ]);

  const byStatus: Record<TenantStatus, number> = { TRIAL: 0, ACTIVE: 0, PAST_DUE: 0, BLOCKED: 0 };
  for (const row of countsByStatus) {
    byStatus[row.status] = row._count._all;
  }

  const mrr = activeTenants.reduce((sum, t) => sum + t.plan.priceSum, 0);
  const totalTenants = Object.values(byStatus).reduce((sum, n) => sum + n, 0);
  // "Total ever collected" across the whole platform, lifetime - a separate
  // figure from MRR (recurring, current-month-only).
  const totalLtv = paidTotal._sum.amount ?? 0;

  return { totalTenants, byStatus, mrr, totalLtv };
}
