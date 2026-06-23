import { prisma } from "../../db/prisma";
import { AppError } from "../../middleware/errorHandler";

type LimitedResource = "products" | "orders" | "employees";

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function assertWithinPlanLimit(tenantId: string, resource: LimitedResource): Promise<void> {
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    include: { plan: true },
  });

  if (resource === "products") {
    if (tenant.plan.maxProducts == null) return;
    const count = await prisma.product.count({ where: { tenantId } });
    if (count >= tenant.plan.maxProducts) {
      throw new AppError(403, "PLAN_LIMIT_REACHED", `Plan limit reached: max ${tenant.plan.maxProducts} products`);
    }
    return;
  }

  if (resource === "orders") {
    if (tenant.plan.maxOrdersPerMonth == null) return;
    const count = await prisma.order.count({
      where: { tenantId, createdAt: { gte: startOfCurrentMonth() } },
    });
    if (count >= tenant.plan.maxOrdersPerMonth) {
      throw new AppError(403, "PLAN_LIMIT_REACHED", `Plan limit reached: max ${tenant.plan.maxOrdersPerMonth} orders per month`);
    }
    return;
  }

  // "employees" counts every User on the tenant, including the OWNER -
  // the Start plan's "1 employee" limit is the owner themselves.
  if (tenant.plan.maxEmployees == null) return;
  const count = await prisma.user.count({ where: { tenantId } });
  if (count >= tenant.plan.maxEmployees) {
    throw new AppError(403, "PLAN_LIMIT_REACHED", `Plan limit reached: max ${tenant.plan.maxEmployees} employees`);
  }
}
