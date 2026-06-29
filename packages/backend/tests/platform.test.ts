import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/db/prisma";
import { registerAndLoginSeller, type TestSeller } from "./helpers/registerTenant";
import { loginAsSuperAdmin } from "./helpers/loginAsSuperAdmin";
import { deleteTenantCompletely } from "./helpers/cleanupTenant";

const describeWithDb = process.env.SKIP_DB_TESTS ? describe.skip : describe;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

describeWithDb("platform (super admin, integration)", () => {
  const app = createApp();
  let seller: TestSeller;
  let superAdminToken: string;
  let startPlanId: string;

  function auth() {
    return { Authorization: `Bearer ${superAdminToken}` };
  }

  beforeAll(async () => {
    seller = await registerAndLoginSeller(app, "business");
    superAdminToken = await loginAsSuperAdmin(app);
    const startPlan = await prisma.plan.findUniqueOrThrow({ where: { code: "start" } });
    startPlanId = startPlan.id;
  });

  afterAll(async () => {
    await deleteTenantCompletely(seller.tenantId);
    await prisma.$disconnect();
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/platform/tenants");
    expect(res.status).toBe(401);
  });

  it("rejects non-super-admin requests", async () => {
    const res = await request(app).get("/api/platform/tenants").set({ Authorization: `Bearer ${seller.accessToken}` });
    expect(res.status).toBe(403);
  });

  it("lists tenants including the test tenant with owner and plan info", async () => {
    const res = await request(app).get("/api/platform/tenants").set(auth()).query({ search: seller.subdomain });
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    const tenant = res.body.items[0];
    expect(tenant.id).toBe(seller.tenantId);
    expect(tenant.plan.code).toBe("business");
    expect(tenant.users[0].email).toBe(seller.email);
    expect(tenant.users[0]).not.toHaveProperty("passwordHash");
  });

  it("returns tenant detail with full invoice and user history, never leaking password hashes", async () => {
    const res = await request(app).get(`/api/platform/tenants/${seller.tenantId}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.tenant.id).toBe(seller.tenantId);
    expect(res.body.tenant.users.length).toBeGreaterThanOrEqual(1);
    for (const user of res.body.tenant.users) {
      expect(user).not.toHaveProperty("passwordHash");
    }
  });

  it("404s on a non-existent tenant", async () => {
    const res = await request(app).get("/api/platform/tenants/00000000-0000-0000-0000-000000000000").set(auth());
    expect(res.status).toBe(404);
  });

  it("changes a tenant's plan", async () => {
    const res = await request(app)
      .patch(`/api/platform/tenants/${seller.tenantId}/plan`)
      .set(auth())
      .send({ planId: startPlanId });
    expect(res.status).toBe(200);
    expect(res.body.tenant.planId).toBe(startPlanId);

    const detail = await request(app).get(`/api/platform/tenants/${seller.tenantId}`).set(auth());
    expect(detail.body.tenant.plan.code).toBe("start");
  });

  it("404s when changing to a non-existent plan", async () => {
    const res = await request(app)
      .patch(`/api/platform/tenants/${seller.tenantId}/plan`)
      .set(auth())
      .send({ planId: "00000000-0000-0000-0000-000000000000" });
    expect(res.status).toBe(404);
  });

  it("computes platform-wide stats including tenants created in this run", async () => {
    // Other test files run concurrently against the same shared dev DB and
    // create/delete their own tenants, so an exact before/after delta would
    // be racy. Instead assert invariants that hold regardless of concurrent
    // activity: `seller` (from beforeAll) and `another` are both fresh TRIAL
    // tenants that haven't been cleaned up yet, so the count can only be at
    // least 2 - it can't have dropped out from under us.
    const another = await registerAndLoginSeller(app, "start");
    try {
      const res = await request(app).get("/api/platform/stats").set(auth());
      expect(res.status).toBe(200);
      const { totalTenants, byStatus, mrr } = res.body;
      expect(totalTenants).toBe(byStatus.TRIAL + byStatus.ACTIVE + byStatus.PAST_DUE + byStatus.BLOCKED);
      expect(byStatus.TRIAL).toBeGreaterThanOrEqual(2);
      expect(mrr).toBeGreaterThanOrEqual(0);
    } finally {
      await deleteTenantCompletely(another.tenantId);
    }
  });

  it("reflects a paid invoice as LTV on the tenant list, detail, and platform-wide totalLtv", async () => {
    await prisma.tenant.update({ where: { id: seller.tenantId }, data: { trialEndsAt: daysAgo(1) } });
    await request(app).post("/api/billing/run-cycle").set(auth());

    const invoice = await prisma.billingInvoice.findFirstOrThrow({ where: { tenantId: seller.tenantId } });
    const statsBefore = await request(app).get("/api/platform/stats").set(auth());
    const ltvBeforePayment = statsBefore.body.totalLtv;

    await prisma.billingInvoice.update({ where: { id: invoice.id }, data: { status: "PAID", paidAt: new Date() } });

    const list = await request(app).get("/api/platform/tenants").set(auth()).query({ search: seller.subdomain });
    expect(list.body.items[0].ltv).toBe(invoice.amount);

    const detail = await request(app).get(`/api/platform/tenants/${seller.tenantId}`).set(auth());
    expect(detail.body.tenant.ltv).toBe(invoice.amount);

    const statsAfter = await request(app).get("/api/platform/stats").set(auth());
    expect(statsAfter.body.totalLtv).toBe(ltvBeforePayment + invoice.amount);
  });

  it("marking a tenant VIP unblocks it immediately, and the billing cycle leaves it alone afterward", async () => {
    // Drive the same tenant to BLOCKED first, mirroring billing.test.ts's exact sequence.
    const invoice = await prisma.billingInvoice.findFirstOrThrow({ where: { tenantId: seller.tenantId } });
    await prisma.billingInvoice.update({ where: { id: invoice.id }, data: { status: "PENDING", dueDate: daysAgo(10) } });
    await request(app).post("/api/billing/run-cycle").set(auth());

    const blocked = await prisma.tenant.findUniqueOrThrow({ where: { id: seller.tenantId } });
    expect(blocked.status).toBe("BLOCKED");

    const vipRes = await request(app).patch(`/api/platform/tenants/${seller.tenantId}/vip`).set(auth()).send({ isVip: true });
    expect(vipRes.status).toBe(200);
    expect(vipRes.body.tenant.isVip).toBe(true);
    expect(vipRes.body.tenant.status).toBe("ACTIVE");

    const invoiceCountBefore = await prisma.billingInvoice.count({ where: { tenantId: seller.tenantId } });
    // Make the existing invoice look overdue again and let the period lapse - none of this should touch a VIP tenant.
    await prisma.billingInvoice.update({
      where: { id: invoice.id },
      data: { status: "PENDING", dueDate: daysAgo(10), periodEnd: daysAgo(1) },
    });
    await request(app).post("/api/billing/run-cycle").set(auth());

    const afterCycle = await prisma.tenant.findUniqueOrThrow({ where: { id: seller.tenantId } });
    expect(afterCycle.status).toBe("ACTIVE");
    expect(afterCycle.isVip).toBe(true);
    const invoiceCountAfter = await prisma.billingInvoice.count({ where: { tenantId: seller.tenantId } });
    expect(invoiceCountAfter).toBe(invoiceCountBefore);
    const untouchedInvoice = await prisma.billingInvoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(untouchedInvoice.status).toBe("PENDING");
  });

  it("returns billing timeline segments covering the tenant's trial and invoice history", async () => {
    const res = await request(app).get("/api/platform/billing-timeline").set(auth()).query({ search: seller.subdomain });
    expect(res.status).toBe(200);
    const tenantTimeline = res.body.items.find((t: { tenantId: string }) => t.tenantId === seller.tenantId);
    expect(tenantTimeline).toBeTruthy();
    expect(tenantTimeline.isVip).toBe(true);
    expect(tenantTimeline.segments.length).toBeGreaterThan(0);
    expect(tenantTimeline.segments.some((s: { status: string }) => s.status === "TRIAL")).toBe(true);
    expect(tenantTimeline.segments.some((s: { status: string }) => s.status === "PENDING")).toBe(true);
  });
});
