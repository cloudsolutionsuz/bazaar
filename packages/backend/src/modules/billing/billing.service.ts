import type { PaymentProviderType } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { AppError } from "../../middleware/errorHandler";

// "Грейс-период" from the spec is modeled as two stages: a few days after
// the period starts before payment is actually due, then a further window
// after the due date before the shop gets blocked.
const DUE_GRACE_DAYS = 3;
const BLOCK_GRACE_DAYS = 3;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

async function startFirstBillingPeriod(now: Date): Promise<void> {
  const endingTrials = await prisma.tenant.findMany({
    where: { status: "TRIAL", trialEndsAt: { lte: now }, isVip: false },
    include: { plan: true },
  });

  for (const tenant of endingTrials) {
    const periodStart = tenant.trialEndsAt ?? now;
    const periodEnd = addMonths(periodStart, 1);
    const dueDate = addDays(periodStart, DUE_GRACE_DAYS);

    await prisma.$transaction([
      prisma.billingInvoice.create({
        data: {
          tenantId: tenant.id,
          planId: tenant.planId,
          planCode: tenant.plan.code,
          amount: tenant.plan.priceSum,
          periodStart,
          periodEnd,
          dueDate,
        },
      }),
      prisma.tenant.update({ where: { id: tenant.id }, data: { status: "ACTIVE" } }),
    ]);
  }
}

async function renewExpiredPeriods(now: Date): Promise<void> {
  const activeTenants = await prisma.tenant.findMany({ where: { status: "ACTIVE", isVip: false }, include: { plan: true } });

  for (const tenant of activeTenants) {
    const latestInvoice = await prisma.billingInvoice.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { periodEnd: "desc" },
    });
    if (!latestInvoice || latestInvoice.periodEnd > now) continue;

    const periodStart = latestInvoice.periodEnd;
    const alreadyCreated = await prisma.billingInvoice.findFirst({ where: { tenantId: tenant.id, periodStart } });
    if (alreadyCreated) continue;

    await prisma.billingInvoice.create({
      data: {
        tenantId: tenant.id,
        planId: tenant.planId,
        planCode: tenant.plan.code,
        amount: tenant.plan.priceSum,
        periodStart,
        periodEnd: addMonths(periodStart, 1),
        dueDate: addDays(periodStart, DUE_GRACE_DAYS),
      },
    });
  }
}

async function markOverdueInvoices(now: Date): Promise<void> {
  // tenant: {isVip: false} is defense in depth - a tenant marked VIP after a
  // PENDING invoice was already created shouldn't have that invoice flip to
  // overdue/push them to PAST_DUE just because the cycle ran before the flag
  // was set.
  const overdue = await prisma.billingInvoice.findMany({
    where: { status: "PENDING", dueDate: { lt: now }, tenant: { isVip: false } },
  });

  for (const invoice of overdue) {
    await prisma.$transaction([
      prisma.billingInvoice.update({ where: { id: invoice.id }, data: { status: "OVERDUE" } }),
      prisma.tenant.updateMany({ where: { id: invoice.tenantId, status: "ACTIVE" }, data: { status: "PAST_DUE" } }),
    ]);
  }
}

async function blockUnpaidPastGracePeriod(now: Date): Promise<void> {
  const cutoff = addDays(now, -BLOCK_GRACE_DAYS);
  const blockCandidates = await prisma.billingInvoice.findMany({
    where: { status: "OVERDUE", dueDate: { lt: cutoff }, tenant: { isVip: false } },
    include: { tenant: true },
  });

  for (const invoice of blockCandidates) {
    if (invoice.tenant.status === "PAST_DUE") {
      await prisma.tenant.update({ where: { id: invoice.tenantId }, data: { status: "BLOCKED" } });
    }
  }
}

export async function runBillingCycle(): Promise<void> {
  const now = new Date();
  await startFirstBillingPeriod(now);
  await renewExpiredPeriods(now);
  await markOverdueInvoices(now);
  await blockUnpaidPastGracePeriod(now);
}

export async function payInvoice(invoiceId: string, provider: PaymentProviderType, providerTransactionId?: string) {
  const invoice = await prisma.billingInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) {
    throw new AppError(404, "NOT_FOUND", "Invoice not found");
  }
  if (invoice.status === "PAID") {
    return invoice;
  }

  const [updated] = await prisma.$transaction([
    prisma.billingInvoice.update({
      where: { id: invoiceId },
      data: { status: "PAID", paidAt: new Date(), provider, providerTransactionId },
    }),
    prisma.tenant.update({ where: { id: invoice.tenantId }, data: { status: "ACTIVE" } }),
  ]);

  return updated;
}

export async function getInvoiceForTenant(tenantId: string, invoiceId: string) {
  const invoice = await prisma.billingInvoice.findFirst({ where: { id: invoiceId, tenantId } });
  if (!invoice) {
    throw new AppError(404, "NOT_FOUND", "Invoice not found");
  }
  return invoice;
}

export async function getBillingSummary(tenantId: string) {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, include: { plan: true } });
  const invoices = await prisma.billingInvoice.findMany({ where: { tenantId }, orderBy: { periodStart: "desc" } });
  const nextInvoice = invoices.find((i) => i.status === "PENDING" || i.status === "OVERDUE") ?? null;

  return { tenant, invoices, nextInvoice };
}
