import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/db/prisma";
import { registerAndLoginSeller, type TestSeller } from "./helpers/registerTenant";
import { deleteTenantCompletely } from "./helpers/cleanupTenant";
import { DEFAULT_ADDRESS } from "./helpers/orderFixtures";

const describeWithDb = process.env.SKIP_DB_TESTS ? describe.skip : describe;

describeWithDb("dashboard summary (integration)", () => {
  const app = createApp();
  let seller: TestSeller;
  let host: string;

  function auth() {
    return { Authorization: `Bearer ${seller.accessToken}` };
  }

  beforeAll(async () => {
    seller = await registerAndLoginSeller(app);
    host = `${seller.subdomain}.localhost`;

    const product = await request(app).post("/api/products").set(auth()).send({
      name: "Dashboard Test Product",
      price: 20000,
      variants: [{ sku: `DASH-${Date.now()}`, stockQuantity: 2, lowStockThreshold: 5 }],
    });
    const variantId = product.body.product.variants[0].id;

    await request(app)
      .post("/api/storefront/orders")
      .set("Host", host)
      .send({
        customerName: "Dashboard Buyer",
        customerPhone: "+998900004444",
        ...DEFAULT_ADDRESS,
        items: [{ variantId, quantity: 1 }],
      });
  });

  afterAll(async () => {
    await deleteTenantCompletely(seller.tenantId);
    await prisma.$disconnect();
  });

  it("requires OWNER/MANAGER auth", async () => {
    const res = await request(app).get("/api/dashboard/summary");
    expect(res.status).toBe(401);
  });

  it("summarizes today's and this week's revenue/orders, low stock count, and recent orders", async () => {
    const res = await request(app).get("/api/dashboard/summary").set(auth());
    expect(res.status).toBe(200);
    expect(res.body.today.revenue).toBe(20000);
    expect(res.body.today.orderCount).toBe(1);
    expect(res.body.week.revenue).toBe(20000);
    expect(res.body.week.orderCount).toBe(1);
    expect(res.body.lowStockCount).toBe(1);
    expect(res.body.recentOrders).toHaveLength(1);
    expect(res.body.recentOrders[0].customerName).toBe("Dashboard Buyer");
  });

  it("includes the last 30 days' sales chart data and top products", async () => {
    const res = await request(app).get("/api/dashboard/summary").set(auth());
    expect(res.status).toBe(200);
    expect(res.body.salesOverTime.length).toBeGreaterThan(0);
    expect(res.body.salesOverTime[0]).toMatchObject({ revenue: 20000, orderCount: 1 });
    expect(res.body.topProducts[0]).toMatchObject({ productName: "Dashboard Test Product", revenue: 20000 });
  });

  it("matches the live Kassa balance from /api/finance/balance", async () => {
    const dashboard = await request(app).get("/api/dashboard/summary").set(auth());
    const balance = await request(app).get("/api/finance/balance").set(auth());
    expect(dashboard.body.kassaBalance).toBe(balance.body.balance);
  });

  it("counts unread buyer chat messages, which clears after a staff member opens the thread", async () => {
    const before = await request(app).get("/api/dashboard/summary").set(auth());

    const chatMessage = await request(app)
      .post("/api/storefront/chat")
      .set("Host", host)
      .send({ phone: "+998900005555", name: "Chat Buyer", text: "Вопрос про доставку" });
    expect(chatMessage.status).toBe(201);

    const afterMessage = await request(app).get("/api/dashboard/summary").set(auth());
    expect(afterMessage.body.unreadChatCount).toBe(before.body.unreadChatCount + 1);

    const threads = await request(app).get("/api/chat/threads").set(auth());
    const thread = threads.body.items.find((t: { customerName: string }) => t.customerName === "Chat Buyer");
    await request(app).get(`/api/chat/threads/${thread.customerId}/messages`).set(auth());

    const afterRead = await request(app).get("/api/dashboard/summary").set(auth());
    expect(afterRead.body.unreadChatCount).toBe(before.body.unreadChatCount);
  });
});
