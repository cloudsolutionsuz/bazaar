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

  const items = tenants.map((tenant) => ({ ...tenant, users: tenant.users.map(toPublicUser) }));
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
  return { ...tenant, users: tenant.users.map(toPublicUser) };
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
  const [countsByStatus, activeTenants] = await Promise.all([
    prisma.tenant.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.tenant.findMany({ where: { status: "ACTIVE" }, select: { plan: { select: { priceSum: true } } } }),
  ]);

  const byStatus: Record<TenantStatus, number> = { TRIAL: 0, ACTIVE: 0, PAST_DUE: 0, BLOCKED: 0 };
  for (const row of countsByStatus) {
    byStatus[row.status] = row._count._all;
  }

  const mrr = activeTenants.reduce((sum, t) => sum + t.plan.priceSum, 0);
  const totalTenants = Object.values(byStatus).reduce((sum, n) => sum + n, 0);

  return { totalTenants, byStatus, mrr };
}
