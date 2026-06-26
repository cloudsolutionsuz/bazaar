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
});
