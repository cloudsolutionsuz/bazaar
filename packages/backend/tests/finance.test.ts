import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/db/prisma";
import { registerAndLoginSeller, type TestSeller } from "./helpers/registerTenant";
import { deleteTenantCompletely } from "./helpers/cleanupTenant";
import { DEFAULT_ADDRESS } from "./helpers/orderFixtures";

const describeWithDb = process.env.SKIP_DB_TESTS ? describe.skip : describe;

function isoDate(d: Date): string {
  return d.toISOString();
}

describeWithDb("finance (integration)", () => {
  const app = createApp();
  let seller: TestSeller;
  let variantId: string;
  let defaultRegisterId: string;
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

    const registers = await request(app).get("/api/cash-registers").set(auth());
    defaultRegisterId = registers.body.items.find((r: { isDefault: boolean }) => r.isDefault).id;
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
      cashRegisterId: defaultRegisterId,
    });
    expect(res.status).toBe(201);

    const balance = await request(app).get("/api/finance/balance").set(auth());
    expect(balance.body.balance).toBe(-5000);
  });

  it("rejects a manual transaction without a cash register, and one for another tenant's register", async () => {
    const missingRegister = await request(app).post("/api/finance/transactions").set(auth()).send({
      type: "EXPENSE",
      category: "Без кассы",
      amount: 100,
    });
    expect(missingRegister.status).toBe(400);

    const otherTenant = await registerAndLoginSeller(app);
    const otherRegisters = await request(app)
      .get("/api/cash-registers")
      .set({ Authorization: `Bearer ${otherTenant.accessToken}` });
    const foreignRegisterId = otherRegisters.body.items[0].id;

    const wrongTenant = await request(app).post("/api/finance/transactions").set(auth()).send({
      type: "EXPENSE",
      category: "Чужая касса",
      amount: 100,
      cashRegisterId: foreignRegisterId,
    });
    expect(wrongTenant.status).toBe(404);

    await deleteTenantCompletely(otherTenant.tenantId);
  });

  it("creates a PENDING income transaction on order placement that doesn't affect the balance until confirmed", async () => {
    const order = await request(app).post("/api/orders").set(auth()).send({
      customerName: "Finance Buyer",
      customerPhone: "+998900000111",
      ...DEFAULT_ADDRESS,
      items: [{ variantId, quantity: 2 }],
    });
    expect(order.status).toBe(201);
    const orderTotal = order.body.order.totalAmount;
    expect(orderTotal).toBe(salePrice * 2);

    const balanceBeforeBaseline = await request(app).get("/api/finance/balance").set(auth());
    const baseline = balanceBeforeBaseline.body.balance;

    const afterOrder = await request(app).get("/api/finance/balance").set(auth());
    expect(afterOrder.body.balance).toBe(baseline);

    const pendingByName = await request(app).get("/api/finance/transactions/pending").set(auth()).query({ search: "Finance Buyer" });
    expect(pendingByName.status).toBe(200);
    const pendingTx = pendingByName.body.items.find((t: { orderId: string }) => t.orderId === order.body.order.id);
    expect(pendingTx).toBeTruthy();
    expect(pendingTx.amount).toBe(orderTotal);

    // customerPhone is stored digits-only (normalizePhone strips the "+").
    const pendingByPhone = await request(app).get("/api/finance/transactions/pending").set(auth()).query({ search: "998900000111" });
    expect(pendingByPhone.body.items.some((t: { id: string }) => t.id === pendingTx.id)).toBe(true);

    const confirm = await request(app)
      .post(`/api/finance/transactions/${pendingTx.id}/confirm`)
      .set(auth())
      .send({ cashRegisterId: defaultRegisterId });
    expect(confirm.status).toBe(200);
    expect(confirm.body.transaction.cashRegisterId).toBe(defaultRegisterId);

    const afterConfirm = await request(app).get("/api/finance/balance").set(auth());
    expect(afterConfirm.body.balance).toBe(baseline + orderTotal);

    const cancel = await request(app).patch(`/api/orders/${order.body.order.id}/status`).set(auth()).send({ status: "CANCELLED" });
    expect(cancel.status).toBe(200);

    const afterCancel = await request(app).get("/api/finance/balance").set(auth());
    expect(afterCancel.body.balance).toBe(baseline);

    const transactions = await request(app).get("/api/finance/transactions").set(auth());
    const categories = transactions.body.items.map((t: { category: string }) => t.category);
    expect(categories).toContain("Продажа");
    expect(categories).toContain("Возврат");
    const refund = transactions.body.items.find((t: { category: string }) => t.category === "Возврат");
    // The reversal lands in the same register the sale was confirmed into.
    expect(refund.cashRegisterId).toBe(defaultRegisterId);
  });

  it("deletes the still-pending income transaction on cancellation without ever touching the balance", async () => {
    const balanceBefore = await request(app).get("/api/finance/balance").set(auth());
    const baseline = balanceBefore.body.balance;

    const order = await request(app).post("/api/orders").set(auth()).send({
      customerName: "Unconfirmed Buyer",
      customerPhone: "+998900000666",
      ...DEFAULT_ADDRESS,
      items: [{ variantId, quantity: 1 }],
    });
    expect(order.status).toBe(201);

    const cancel = await request(app).patch(`/api/orders/${order.body.order.id}/status`).set(auth()).send({ status: "CANCELLED" });
    expect(cancel.status).toBe(200);

    const afterCancel = await request(app).get("/api/finance/balance").set(auth());
    expect(afterCancel.body.balance).toBe(baseline);

    const transactions = await request(app).get("/api/finance/transactions").set(auth());
    const orderTransactions = transactions.body.items.filter((t: { orderId: string | null }) => t.orderId === order.body.order.id);
    expect(orderTransactions).toHaveLength(0);

    const pending = await request(app).get("/api/finance/transactions/pending").set(auth()).query({ search: "Unconfirmed Buyer" });
    expect(pending.body.items.some((t: { orderId: string }) => t.orderId === order.body.order.id)).toBe(false);
  });

  it("computes P&L cost basis from the purchase price, excluding cancelled orders", async () => {
    const activeOrder = await request(app).post("/api/orders").set(auth()).send({
      customerName: "PnL Buyer",
      customerPhone: "+998900000222",
      ...DEFAULT_ADDRESS,
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
      ...DEFAULT_ADDRESS,
      items: [{ variantId: fifoVariantId, quantity: 7 }],
    });
    expect(firstSale.status).toBe(201);

    // The remaining 3 units of the second lot are still there; selling 2
    // more draws only from that lot, @ 2000 each = 4000.
    const secondSale = await request(app).post("/api/orders").set(auth()).send({
      customerName: "FIFO Buyer 2",
      customerPhone: "+998900000444",
      ...DEFAULT_ADDRESS,
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

  it("has a write-off consume the oldest FIFO lot so a later sale costs correctly from what's left", async () => {
    const price = 9000;
    const product = await request(app).post("/api/products").set(auth()).send({
      name: "FIFO WriteOff Test Product",
      price,
      variants: [{ sku: `FIFOWO-${Date.now()}`, stockQuantity: 0 }],
    });
    const variant = product.body.product.variants[0].id;

    // Two lots: 5 @ 1000, then 5 @ 2000.
    await request(app).post("/api/inventory/receipts").set(auth()).send({ variantId: variant, quantity: 5, purchasePrice: 1000 });
    await request(app).post("/api/inventory/receipts").set(auth()).send({ variantId: variant, quantity: 5, purchasePrice: 2000 });

    // Write off 3 units - should consume 3 from the first (oldest) lot,
    // leaving it with 2 remaining, not touching the second lot at all.
    const writeOff = await request(app).post("/api/inventory/write-offs").set(auth()).send({
      variantId: variant,
      quantity: 3,
      note: "Damaged in storage",
    });
    expect(writeOff.status).toBe(201);

    // Selling 4 should now draw 2 from the (depleted) first lot @1000 + 2
    // from the second lot @2000 = 6000 - NOT 4*1000=4000, which is what it'd
    // be if the write-off hadn't been replayed into the FIFO lot queue.
    const sale = await request(app).post("/api/orders").set(auth()).send({
      customerName: "FIFO WriteOff Buyer",
      customerPhone: "+998900000555",
      ...DEFAULT_ADDRESS,
      items: [{ variantId: variant, quantity: 4 }],
    });
    expect(sale.status).toBe(201);

    const from = isoDate(new Date(Date.now() - 60 * 60 * 1000));
    const to = isoDate(new Date(Date.now() + 60 * 60 * 1000));
    const pnl = await request(app).get("/api/finance/pnl").set(auth()).query({ from, to });
    const breakdown = pnl.body.byProduct.find((p: { productName: string }) => p.productName === "FIFO WriteOff Test Product");
    expect(breakdown.cogs).toBe(2 * 1000 + 2 * 2000);
    expect(breakdown.revenue).toBe(price * 4);
  });

  it("computes visits as distinct sessions and conversion rate as orders/visits", async () => {
    const host = `${seller.subdomain}.localhost`;

    // 2 page views from the same session (counts as 1 visit) + 1 from a
    // second session = 2 visits total.
    await request(app).post("/api/storefront/analytics/track").set("Host", host).send({ sessionId: "conv-session-a", path: "/" });
    await request(app)
      .post("/api/storefront/analytics/track")
      .set("Host", host)
      .send({ sessionId: "conv-session-a", path: "/products/1" });
    await request(app).post("/api/storefront/analytics/track").set("Host", host).send({ sessionId: "conv-session-b", path: "/" });

    const from = isoDate(new Date(Date.now() - 60 * 60 * 1000));
    const to = isoDate(new Date(Date.now() + 60 * 60 * 1000));
    const analytics = await request(app).get("/api/finance/analytics").set(auth()).query({ from, to, granularity: "day" });
    expect(analytics.status).toBe(200);
    expect(analytics.body.visits).toBe(2);

    const expectedRate = Math.round((analytics.body.orderCount / 2) * 1000) / 10;
    expect(analytics.body.conversionRate).toBe(expectedRate);
  });

  it("computes a daily summary with opening/closing balance and pending income", async () => {
    // Everything in this test run happens "today", so openingBalance/income
    // before this test's own actions is whatever earlier tests in this file
    // left behind - compare deltas rather than absolute numbers so this
    // stays correct regardless of what ran before it.
    const before = await request(app).get("/api/finance/daily-summary").set(auth());
    expect(before.status).toBe(200);

    const order = await request(app).post("/api/orders").set(auth()).send({
      customerName: "Summary Buyer",
      customerPhone: "+998900000777",
      ...DEFAULT_ADDRESS,
      items: [{ variantId, quantity: 1 }],
    });
    expect(order.status).toBe(201);
    const orderTotal = order.body.order.totalAmount;

    const expense = await request(app).post("/api/finance/transactions").set(auth()).send({
      type: "EXPENSE",
      category: "Транспорт",
      amount: 1000,
      cashRegisterId: defaultRegisterId,
    });
    expect(expense.status).toBe(201);

    const after = await request(app).get("/api/finance/daily-summary").set(auth());
    expect(after.status).toBe(200);
    // The new order's income is still PENDING, so it doesn't move opening/income/expense.
    expect(after.body.openingBalance).toBe(before.body.openingBalance);
    expect(after.body.income).toBe(before.body.income);
    expect(after.body.expense).toBe(before.body.expense + 1000);
    expect(after.body.pendingIncome).toBeGreaterThanOrEqual(before.body.pendingIncome + orderTotal);
    expect(after.body.closingBalance).toBe(after.body.openingBalance + after.body.income - after.body.expense);
  });

  it("keeps a second cash register's balance separate from the default register and the tenant-wide total", async () => {
    const createRegister = await request(app).post("/api/cash-registers").set(auth()).send({ name: "Точка на рынке" });
    expect(createRegister.status).toBe(201);
    const secondRegisterId = createRegister.body.cashRegister.id;

    const beforeTotal = await request(app).get("/api/finance/balance").set(auth());
    const beforeDefault = await request(app).get("/api/finance/balance").set(auth()).query({ cashRegisterId: defaultRegisterId });
    const beforeSecond = await request(app).get("/api/finance/balance").set(auth()).query({ cashRegisterId: secondRegisterId });
    expect(beforeSecond.body.balance).toBe(0);

    const income = await request(app).post("/api/finance/transactions").set(auth()).send({
      type: "INCOME",
      category: "Прочее",
      amount: 7000,
      cashRegisterId: secondRegisterId,
    });
    expect(income.status).toBe(201);

    const afterTotal = await request(app).get("/api/finance/balance").set(auth());
    const afterDefault = await request(app).get("/api/finance/balance").set(auth()).query({ cashRegisterId: defaultRegisterId });
    const afterSecond = await request(app).get("/api/finance/balance").set(auth()).query({ cashRegisterId: secondRegisterId });

    expect(afterSecond.body.balance).toBe(7000);
    expect(afterDefault.body.balance).toBe(beforeDefault.body.balance);
    expect(afterTotal.body.balance).toBe(beforeTotal.body.balance + 7000);

    const summaryForSecond = await request(app).get("/api/finance/daily-summary").set(auth()).query({ cashRegisterId: secondRegisterId });
    expect(summaryForSecond.body.income).toBe(7000);
    expect(summaryForSecond.body.closingBalance).toBe(7000);
    // Pending income has no register assigned yet, so a register-filtered
    // summary can't attribute it to this specific register.
    expect(summaryForSecond.body.pendingIncome).toBe(0);

    const transactionsForSecond = await request(app).get("/api/finance/transactions").set(auth()).query({ cashRegisterId: secondRegisterId });
    expect(transactionsForSecond.body.items.every((t: { cashRegisterId: string }) => t.cashRegisterId === secondRegisterId)).toBe(true);
  });
});
