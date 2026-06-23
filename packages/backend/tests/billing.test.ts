import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/db/prisma";
import { env } from "../src/config/env";
import { registerAndLoginSeller, type TestSeller } from "./helpers/registerTenant";
import { deleteTenantCompletely } from "./helpers/cleanupTenant";

const describeWithDb = process.env.SKIP_DB_TESTS ? describe.skip : describe;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

describeWithDb("billing (integration)", () => {
  const app = createApp();
  let seller: TestSeller;
  let superAdminToken: string;

  beforeAll(async () => {
    seller = await registerAndLoginSeller(app);

    const superLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: env.superadminEmail, password: env.superadminPassword });
    superAdminToken = superLogin.body.accessToken;
  });

  afterAll(async () => {
    await deleteTenantCompletely(seller.tenantId);
    await prisma.$disconnect();
  });

  function sellerAuth() {
    return { Authorization: `Bearer ${seller.accessToken}` };
  }

  function superAuth() {
    return { Authorization: `Bearer ${superAdminToken}` };
  }

  it("generates the first invoice once the trial ends and keeps the tenant active", async () => {
    await prisma.tenant.update({ where: { id: seller.tenantId }, data: { trialEndsAt: daysAgo(1) } });

    const run = await request(app).post("/api/billing/run-cycle").set(superAuth());
    expect(run.status).toBe(200);

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: seller.tenantId } });
    expect(tenant.status).toBe("ACTIVE");

    const invoice = await prisma.billingInvoice.findFirstOrThrow({ where: { tenantId: seller.tenantId } });
    expect(invoice.status).toBe("PENDING");
    expect(invoice.amount).toBeGreaterThan(0);
  });

  it("marks the invoice overdue and the tenant past-due once the due date passes", async () => {
    const invoice = await prisma.billingInvoice.findFirstOrThrow({ where: { tenantId: seller.tenantId } });
    await prisma.billingInvoice.update({ where: { id: invoice.id }, data: { dueDate: daysAgo(1) } });

    await request(app).post("/api/billing/run-cycle").set(superAuth());

    const updatedInvoice = await prisma.billingInvoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(updatedInvoice.status).toBe("OVERDUE");

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: seller.tenantId } });
    expect(tenant.status).toBe("PAST_DUE");
  });

  it("blocks the tenant once the overdue invoice is past the block grace period", async () => {
    const invoice = await prisma.billingInvoice.findFirstOrThrow({ where: { tenantId: seller.tenantId } });
    await prisma.billingInvoice.update({ where: { id: invoice.id }, data: { dueDate: daysAgo(10) } });

    await request(app).post("/api/billing/run-cycle").set(superAuth());

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: seller.tenantId } });
    expect(tenant.status).toBe("BLOCKED");
  });

  it("rejects normal business routes once blocked, but keeps /me and billing reachable", async () => {
    const products = await request(app).get("/api/products").set(sellerAuth());
    expect(products.status).toBe(403);
    expect(products.body.error.code).toBe("TENANT_BLOCKED");

    const me = await request(app).get("/api/auth/me").set(sellerAuth());
    expect(me.status).toBe(200);
    expect(me.body.tenant.status).toBe("BLOCKED");

    const summary = await request(app).get("/api/billing/summary").set(sellerAuth());
    expect(summary.status).toBe(200);
    expect(summary.body.nextInvoice.status).toBe("OVERDUE");
  });

  it("unblocks the tenant once the invoice is paid via the sandbox checkout", async () => {
    const invoice = await prisma.billingInvoice.findFirstOrThrow({ where: { tenantId: seller.tenantId } });

    const pay = await request(app).post(`/api/billing/invoices/${invoice.id}/confirm-sandbox-payment`).set(sellerAuth());
    expect(pay.status).toBe(200);
    expect(pay.body.invoice.status).toBe("PAID");

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: seller.tenantId } });
    expect(tenant.status).toBe("ACTIVE");

    const products = await request(app).get("/api/products").set(sellerAuth());
    expect(products.status).toBe(200);
  });

  describe("plan management (super admin only)", () => {
    const code = `test-plan-${Date.now()}`;

    afterAll(async () => {
      await prisma.plan.deleteMany({ where: { code } });
    });

    it("rejects plan creation from a non-super-admin", async () => {
      const res = await request(app).post("/api/plans").set(sellerAuth()).send({ code, name: "Test", priceSum: 1000 });
      expect(res.status).toBe(403);
    });

    it("allows the super admin to create and update a plan", async () => {
      const created = await request(app).post("/api/plans").set(superAuth()).send({ code, name: "Test", priceSum: 1000 });
      expect(created.status).toBe(201);

      const updated = await request(app).patch(`/api/plans/${created.body.plan.id}`).set(superAuth()).send({ priceSum: 2000 });
      expect(updated.status).toBe(200);
      expect(updated.body.plan.priceSum).toBe(2000);
    });
  });
});
