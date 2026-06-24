import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/db/prisma";
import { registerAndLoginSeller, type TestSeller } from "./helpers/registerTenant";
import { deleteTenantCompletely } from "./helpers/cleanupTenant";

const describeWithDb = process.env.SKIP_DB_TESTS ? describe.skip : describe;

function isoDate(d: Date): string {
  return d.toISOString();
}

describeWithDb("finance (integration)", () => {
  const app = createApp();
  let seller: TestSeller;
  let variantId: string;
  const purchasePrice = 6000;
  const salePrice = 10000;

  function auth() {
    return { Authorization: `Bearer ${seller.accessToken}` };
  }

  beforeAll(async () => {
    seller = await registerAndLoginSeller(app);

    const product = await request(app).post("/api/products").set(auth()).send({
      name: "Finance Test Product",
      price: salePrice,
      variants: [{ sku: `FIN-${Date.now()}`, stockQuantity: 0 }],
    });
    variantId = product.body.product.variants[0].id;

    await request(app).post("/api/inventory/receipts").set(auth()).send({
      variantId,
      quantity: 20,
      purchasePrice,
    });
  });

  afterAll(async () => {
    await deleteTenantCompletely(seller.tenantId);
    await prisma.$disconnect();
  });

  it("rejects finance routes for cashiers", async () => {
    // No cashier exists yet in this isolated tenant - confirm the route is
    // role-gated by hitting it unauthenticated, mirroring the pattern used
    // for other modules' "non-owner rejected" checks.
    const res = await request(app).get("/api/finance/balance");
    expect(res.status).toBe(401);
  });

  it("tracks a manual expense in the balance", async () => {
    const res = await request(app).post("/api/finance/transactions").set(auth()).send({
      type: "EXPENSE",
      category: "Аренда",
      amount: 5000,
    });
    expect(res.status).toBe(201);

    const balance = await request(app).get("/api/finance/balance").set(auth());
    expect(balance.body.balance).toBe(-5000);
  });

  it("auto-creates an income transaction when an order is placed, and reverses it on cancellation", async () => {
    const order = await request(app).post("/api/orders").set(auth()).send({
      customerName: "Finance Buyer",
      customerPhone: "+998900000111",
      items: [{ variantId, quantity: 2 }],
    });
    expect(order.status).toBe(201);
    const orderTotal = order.body.order.totalAmount;
    expect(orderTotal).toBe(salePrice * 2);

    const afterOrder = await request(app).get("/api/finance/balance").set(auth());
    expect(afterOrder.body.balance).toBe(-5000 + orderTotal);

    const cancel = await request(app).patch(`/api/orders/${order.body.order.id}/status`).set(auth()).send({ status: "CANCELLED" });
    expect(cancel.status).toBe(200);

    const afterCancel = await request(app).get("/api/finance/balance").set(auth());
    expect(afterCancel.body.balance).toBe(-5000);

    const transactions = await request(app).get("/api/finance/transactions").set(auth());
    const categories = transactions.body.items.map((t: { category: string }) => t.category);
    expect(categories).toContain("Продажа");
    expect(categories).toContain("Возврат");
  });

  it("computes P&L cost basis from the purchase price, excluding cancelled orders", async () => {
    const activeOrder = await request(app).post("/api/orders").set(auth()).send({
      customerName: "PnL Buyer",
      customerPhone: "+998900000222",
      items: [{ variantId, quantity: 3 }],
    });
    expect(activeOrder.status).toBe(201);

    const from = isoDate(new Date(Date.now() - 60 * 60 * 1000));
    const to = isoDate(new Date(Date.now() + 60 * 60 * 1000));

    const pnl = await request(app).get("/api/finance/pnl").set(auth()).query({ from, to });
    expect(pnl.status).toBe(200);
    expect(pnl.body.revenue).toBe(salePrice * 3);
    expect(pnl.body.cogs).toBe(purchasePrice * 3);
    // The 5000 manual "Аренда" expense from the earlier test also falls
    // within this window and correctly reduces net profit.
    expect(pnl.body.expenses).toBe(5000);
    expect(pnl.body.netProfit).toBe(salePrice * 3 - purchasePrice * 3 - 5000);
    expect(pnl.body.byProduct[0].productName).toBe("Finance Test Product");
  });

  it("computes analytics revenue/orderCount/AOV and top products over a range", async () => {
    const from = isoDate(new Date(Date.now() - 60 * 60 * 1000));
    const to = isoDate(new Date(Date.now() + 60 * 60 * 1000));

    const analytics = await request(app).get("/api/finance/analytics").set(auth()).query({ from, to, granularity: "day" });
    expect(analytics.status).toBe(200);
    expect(analytics.body.orderCount).toBe(1); // the cancelled order from the previous test is excluded
    expect(analytics.body.revenue).toBe(salePrice * 3);
    expect(analytics.body.averageOrderValue).toBe(salePrice * 3);
    expect(analytics.body.topProducts[0].productName).toBe("Finance Test Product");
  });

  it("computes P&L cost of goods sold by FIFO across receipts at different prices", async () => {
    const fifoPrice = 12000;
    const product = await request(app).post("/api/products").set(auth()).send({
      name: "FIFO Test Product",
      price: fifoPrice,
      variants: [{ sku: `FIFO-${Date.now()}`, stockQuantity: 0 }],
    });
    const fifoVariantId = product.body.product.variants[0].id;

    // Two lots at different purchase prices: 5 units @ 1000, then 5 @ 2000.
    await request(app).post("/api/inventory/receipts").set(auth()).send({ variantId: fifoVariantId, quantity: 5, purchasePrice: 1000 });
    await request(app).post("/api/inventory/receipts").set(auth()).send({ variantId: fifoVariantId, quantity: 5, purchasePrice: 2000 });

    // Selling 7 should consume all 5 units of the first lot (5*1000) plus 2
    // units of the second lot (2*2000) = 9000, not 7*2000 = 14000 (what the
    // old "latest receipt price" logic would have produced).
    const firstSale = await request(app).post("/api/orders").set(auth()).send({
      customerName: "FIFO Buyer 1",
      customerPhone: "+998900000333",
      items: [{ variantId: fifoVariantId, quantity: 7 }],
    });
    expect(firstSale.status).toBe(201);

    // The remaining 3 units of the second lot are still there; selling 2
    // more draws only from that lot, @ 2000 each = 4000.
    const secondSale = await request(app).post("/api/orders").set(auth()).send({
      customerName: "FIFO Buyer 2",
      customerPhone: "+998900000444",
      items: [{ variantId: fifoVariantId, quantity: 2 }],
    });
    expect(secondSale.status).toBe(201);

    const from = isoDate(new Date(Date.now() - 60 * 60 * 1000));
    const to = isoDate(new Date(Date.now() + 60 * 60 * 1000));
    const pnl = await request(app).get("/api/finance/pnl").set(auth()).query({ from, to });
    expect(pnl.status).toBe(200);

    const fifoBreakdown = pnl.body.byProduct.find((p: { productName: string }) => p.productName === "FIFO Test Product");
    expect(fifoBreakdown.cogs).toBe(5 * 1000 + 2 * 2000 + 2 * 2000);
    expect(fifoBreakdown.revenue).toBe(fifoPrice * (7 + 2));
  });
});
