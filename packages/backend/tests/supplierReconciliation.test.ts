import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/db/prisma";
import { registerAndLoginSeller, type TestSeller } from "./helpers/registerTenant";
import { deleteTenantCompletely } from "./helpers/cleanupTenant";
import { DEFAULT_ADDRESS } from "./helpers/orderFixtures";

const describeWithDb = process.env.SKIP_DB_TESTS ? describe.skip : describe;

describeWithDb("supplier reconciliation (integration)", () => {
  const app = createApp();
  let seller: TestSeller;
  let variantId: string;
  let supplierId: string;
  let defaultRegisterId: string;

  function auth() {
    return { Authorization: `Bearer ${seller.accessToken}` };
  }

  beforeAll(async () => {
    seller = await registerAndLoginSeller(app);

    const product = await request(app).post("/api/products").set(auth()).send({
      name: "Reconciliation Test Product",
      price: 9000,
      variants: [{ sku: `RECON-${Date.now()}`, stockQuantity: 0 }],
    });
    variantId = product.body.product.variants[0].id;

    const supplier = await request(app).post("/api/suppliers").set(auth()).send({ name: "Reconciliation Supplier" });
    supplierId = supplier.body.supplier.id;

    const registers = await request(app).get("/api/cash-registers").set(auth());
    defaultRegisterId = registers.body.items.find((r: { isDefault: boolean }) => r.isDefault).id;
  });

  afterAll(async () => {
    await deleteTenantCompletely(seller.tenantId);
    await prisma.$disconnect();
  });

  it("a receipt with a supplier and purchase price creates debt", async () => {
    const receipt = await request(app).post("/api/inventory/receipts").set(auth()).send({
      variantId,
      quantity: 10,
      purchasePrice: 1000,
      supplierId,
    });
    expect(receipt.status).toBe(201);

    const list = await request(app).get("/api/suppliers").set(auth()).query({ search: "Reconciliation Supplier" });
    const listed = list.body.items.find((s: { id: string }) => s.id === supplierId);
    expect(listed.balance).toBe(10000);

    const statement = await request(app).get(`/api/suppliers/${supplierId}/statement`).set(auth());
    expect(statement.status).toBe(200);
    expect(statement.body.openingBalance).toBe(0);
    expect(statement.body.closingBalance).toBe(10000);
    expect(statement.body.entries).toHaveLength(1);
    expect(statement.body.entries[0]).toMatchObject({ type: "RECEIPT", debit: 10000, credit: 0, balanceAfter: 10000 });
  });

  it("a payment reduces the debt and creates a real Kassa expense in the chosen register", async () => {
    const balanceBefore = await request(app).get("/api/finance/balance").set(auth()).query({ cashRegisterId: defaultRegisterId });

    const payment = await request(app).post(`/api/suppliers/${supplierId}/payments`).set(auth()).send({
      amount: 4000,
      cashRegisterId: defaultRegisterId,
    });
    expect(payment.status).toBe(201);
    expect(payment.body.transaction).toMatchObject({ type: "EXPENSE", category: "Оплата поставщику", amount: 4000, supplierId });

    const balanceAfter = await request(app).get("/api/finance/balance").set(auth()).query({ cashRegisterId: defaultRegisterId });
    expect(balanceAfter.body.balance).toBe(balanceBefore.body.balance - 4000);

    const statement = await request(app).get(`/api/suppliers/${supplierId}/statement`).set(auth());
    expect(statement.body.closingBalance).toBe(6000);
  });

  it("a supplier return reduces stock and debt without touching the Kassa balance", async () => {
    const variantBefore = await request(app).get("/api/products").set(auth()).query({ search: "Reconciliation Test Product" });
    const stockBefore = variantBefore.body.items[0].variants[0].stockQuantity;

    const balanceBefore = await request(app).get("/api/finance/balance").set(auth());

    const ret = await request(app).post("/api/inventory/supplier-returns").set(auth()).send({
      variantId,
      quantity: 2,
      supplierId,
      unitCost: 1000,
    });
    expect(ret.status).toBe(201);

    const variantAfter = await request(app).get("/api/products").set(auth()).query({ search: "Reconciliation Test Product" });
    const stockAfter = variantAfter.body.items[0].variants[0].stockQuantity;
    expect(stockAfter).toBe(stockBefore - 2);

    const balanceAfter = await request(app).get("/api/finance/balance").set(auth());
    expect(balanceAfter.body.balance).toBe(balanceBefore.body.balance);

    const statement = await request(app).get(`/api/suppliers/${supplierId}/statement`).set(auth());
    // 10000 (receipt) - 4000 (payment) - 2000 (return) = 4000
    expect(statement.body.closingBalance).toBe(4000);
    const returnEntry = statement.body.entries.find((e: { type: string }) => e.type === "SUPPLIER_RETURN");
    expect(returnEntry).toMatchObject({ debit: 0, credit: 2000 });
  });

  it("rejects a supplier return larger than the current stock", async () => {
    const res = await request(app).post("/api/inventory/supplier-returns").set(auth()).send({
      variantId,
      quantity: 9999,
      supplierId,
      unitCost: 1000,
    });
    expect(res.status).toBe(400);
  });

  it("has a supplier return consume the oldest FIFO lot, same as a write-off", async () => {
    const product = await request(app).post("/api/products").set(auth()).send({
      name: "FIFO Supplier Return Product",
      price: 9000,
      variants: [{ sku: `FIFORET-${Date.now()}`, stockQuantity: 0 }],
    });
    const fifoVariantId = product.body.product.variants[0].id;

    await request(app).post("/api/inventory/receipts").set(auth()).send({ variantId: fifoVariantId, quantity: 5, purchasePrice: 1000 });
    await request(app).post("/api/inventory/receipts").set(auth()).send({ variantId: fifoVariantId, quantity: 5, purchasePrice: 2000 });

    // Returning 3 should consume 3 from the oldest (first) lot, leaving it
    // with 2 remaining, exactly like a write-off would.
    const ret = await request(app).post("/api/inventory/supplier-returns").set(auth()).send({
      variantId: fifoVariantId,
      quantity: 3,
      supplierId,
      unitCost: 1000,
    });
    expect(ret.status).toBe(201);

    // Selling 4 now draws 2 from the depleted first lot @1000 + 2 from the
    // second lot @2000 = 6000, not 4*1000=4000.
    const sale = await request(app).post("/api/orders").set(auth()).send({
      customerName: "FIFO Return Buyer",
      customerPhone: "+998900000999",
      ...DEFAULT_ADDRESS,
      items: [{ variantId: fifoVariantId, quantity: 4 }],
    });
    expect(sale.status).toBe(201);

    const from = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const pnl = await request(app).get("/api/finance/pnl").set(auth()).query({ from, to });
    const breakdown = pnl.body.byProduct.find((p: { productName: string }) => p.productName === "FIFO Supplier Return Product");
    expect(breakdown.cogs).toBe(2 * 1000 + 2 * 2000);
  });

  it("computes openingBalance/closingBalance correctly for a date-bounded statement", async () => {
    const supplier = await request(app).post("/api/suppliers").set(auth()).send({ name: "Dated Statement Supplier" });
    const id = supplier.body.supplier.id;

    await request(app).post("/api/inventory/receipts").set(auth()).send({ variantId, quantity: 5, purchasePrice: 1000, supplierId: id });

    const midpoint = new Date();
    await new Promise((resolve) => setTimeout(resolve, 10));

    await request(app).post("/api/inventory/receipts").set(auth()).send({ variantId, quantity: 3, purchasePrice: 1000, supplierId: id });

    const statement = await request(app)
      .get(`/api/suppliers/${id}/statement`)
      .set(auth())
      .query({ from: midpoint.toISOString() });

    expect(statement.body.openingBalance).toBe(5000);
    expect(statement.body.entries).toHaveLength(1);
    expect(statement.body.closingBalance).toBe(8000);
  });

  it("exports a supplier statement as a valid xlsx buffer", async () => {
    const res = await request(app)
      .get(`/api/suppliers/${supplierId}/statement/export`)
      .set(auth())
      .buffer()
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => callback(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("spreadsheetml");
  });

  it("refuses to delete a supplier with a payment on record", async () => {
    const res = await request(app).delete(`/api/suppliers/${supplierId}`).set(auth());
    expect(res.status).toBe(409);
  });
});
