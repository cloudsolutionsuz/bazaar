import { describe, expect, it, vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/db/prisma";
import { registerAndLoginSeller, type TestSeller } from "./helpers/registerTenant";
import { deleteTenantCompletely } from "./helpers/cleanupTenant";

const describeWithDb = process.env.SKIP_DB_TESTS ? describe.skip : describe;

describeWithDb("notifications (super admin / telegram, integration)", () => {
  const app = createApp();
  let seller: TestSeller;
  let variantId: string;
  let sku: string;
  const lowStockThreshold = 5;

  function auth() {
    return { Authorization: `Bearer ${seller.accessToken}` };
  }

  beforeAll(async () => {
    seller = await registerAndLoginSeller(app);

    sku = `NOTIF-${Date.now()}`;
    const product = await request(app).post("/api/products").set(auth()).send({
      name: "Notification Test Product",
      price: 10000,
      variants: [{ sku, stockQuantity: 0, lowStockThreshold }],
    });
    variantId = product.body.product.variants[0].id;

    await request(app).post("/api/inventory/receipts").set(auth()).send({
      variantId,
      quantity: 10,
      purchasePrice: 5000,
    });
  });

  afterAll(async () => {
    await deleteTenantCompletely(seller.tenantId);
    await prisma.$disconnect();
  });

  let logSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    logSpy.mockRestore();
  });

  it("rejects unauthenticated requests to change settings", async () => {
    const res = await request(app).patch("/api/tenants/me").send({ telegramChatId: "12345" });
    expect(res.status).toBe(401);
  });

  it("rejects a logged-in manager (non-owner) from changing settings", async () => {
    const managerEmail = `manager${Date.now()}@example.com`;
    const invite = await request(app).post("/api/employees/invite").set(auth()).send({
      name: "Manager",
      email: managerEmail,
      role: "MANAGER",
    });
    expect(invite.status).toBe(201);

    const inviteToken = await prisma.verificationToken.findFirstOrThrow({
      where: { userId: invite.body.employee.id, type: "EMPLOYEE_INVITE" },
    });
    await request(app).post("/api/auth/accept-invite").send({ token: inviteToken.token, password: "managerpass123" });
    const login = await request(app).post("/api/auth/login").send({ email: managerEmail, password: "managerpass123" });

    const res = await request(app)
      .patch("/api/tenants/me")
      .set({ Authorization: `Bearer ${login.body.accessToken}` })
      .send({ telegramChatId: "12345" });
    expect(res.status).toBe(403);
  });

  it("does not log anything when no telegramChatId is configured", async () => {
    const order = await request(app).post("/api/orders").set(auth()).send({
      customerName: "No Telegram Buyer",
      customerPhone: "+998900000001",
      items: [{ variantId, quantity: 1 }],
    });
    expect(order.status).toBe(201);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("lets the owner set a telegramChatId, reflected on /api/auth/me", async () => {
    const update = await request(app).patch("/api/tenants/me").set(auth()).send({ telegramChatId: "999888777" });
    expect(update.status).toBe(200);
    expect(update.body.tenant.telegramChatId).toBe("999888777");

    const me = await request(app).get("/api/auth/me").set(auth());
    expect(me.body.tenant.telegramChatId).toBe("999888777");
  });

  it("logs a new-order notification once telegramChatId is configured", async () => {
    const order = await request(app).post("/api/orders").set(auth()).send({
      customerName: "Telegram Buyer",
      customerPhone: "+998900000002",
      items: [{ variantId, quantity: 1 }],
    });
    expect(order.status).toBe(201);

    const calls = logSpy.mock.calls.map((c) => String(c[0]));
    expect(calls.some((line) => line.includes("[telegram]") && line.includes("999888777") && line.includes("Telegram Buyer"))).toBe(
      true,
    );
  });

  it("logs a low-stock alert only on the threshold-crossing sale, not on subsequent ones", async () => {
    // Stock is now 8 (10 received - 1 - 1 from previous tests), threshold is 5.
    // Selling 4 brings it to 4, crossing the threshold for the first time.
    const crossing = await request(app).post("/api/orders").set(auth()).send({
      customerName: "Crossing Buyer",
      customerPhone: "+998900000003",
      items: [{ variantId, quantity: 4 }],
    });
    expect(crossing.status).toBe(201);

    const crossingCalls = logSpy.mock.calls.map((c) => String(c[0]));
    expect(crossingCalls.some((line) => line.includes("[telegram]") && line.includes("Низкий остаток") && line.includes(sku))).toBe(
      true,
    );

    logSpy.mockClear();

    // Stock is now 4, already below threshold - selling 1 more (stock -> 3)
    // must not log a second low-stock alert.
    const again = await request(app).post("/api/orders").set(auth()).send({
      customerName: "Still Low Buyer",
      customerPhone: "+998900000004",
      items: [{ variantId, quantity: 1 }],
    });
    expect(again.status).toBe(201);

    const againCalls = logSpy.mock.calls.map((c) => String(c[0]));
    expect(againCalls.some((line) => line.includes("Низкий остаток"))).toBe(false);
  });
});
