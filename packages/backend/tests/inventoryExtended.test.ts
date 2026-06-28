import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/db/prisma";
import { registerAndLoginSeller, type TestSeller } from "./helpers/registerTenant";
import { deleteTenantCompletely } from "./helpers/cleanupTenant";

const describeWithDb = process.env.SKIP_DB_TESTS ? describe.skip : describe;

describeWithDb("inventory: write-offs, stocktakes, suppliers, daily report (integration)", () => {
  const app = createApp();
  let seller: TestSeller;
  let variantId: string;

  function auth() {
    return { Authorization: `Bearer ${seller.accessToken}` };
  }

  beforeAll(async () => {
    seller = await registerAndLoginSeller(app);

    const product = await request(app).post("/api/products").set(auth()).send({
      name: "Inventory Extended Test Product",
      price: 5000,
      variants: [{ sku: `INVEXT-${Date.now()}`, stockQuantity: 0 }],
    });
    variantId = product.body.product.variants[0].id;

    await request(app).post("/api/inventory/receipts").set(auth()).send({ variantId, quantity: 20, purchasePrice: 1000 });
  });

  afterAll(async () => {
    await deleteTenantCompletely(seller.tenantId);
    await prisma.$disconnect();
  });

  it("rejects a write-off larger than the current stock", async () => {
    const res = await request(app).post("/api/inventory/write-offs").set(auth()).send({
      variantId,
      quantity: 9999,
      note: "Too many",
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INSUFFICIENT_STOCK");
  });

  it("writes off stock, requiring a reason, and books an expense only when a unit cost is given", async () => {
    const noCost = await request(app).post("/api/inventory/write-offs").set(auth()).send({
      variantId,
      quantity: 2,
      note: "Expired",
    });
    expect(noCost.status).toBe(201);
    expect(noCost.body.movement.quantity).toBe(-2);

    const balanceBefore = await request(app).get("/api/finance/balance").set(auth());

    const withCost = await request(app).post("/api/inventory/write-offs").set(auth()).send({
      variantId,
      quantity: 3,
      unitCost: 1000,
      note: "Broken in transit",
    });
    expect(withCost.status).toBe(201);

    const balanceAfter = await request(app).get("/api/finance/balance").set(auth());
    expect(balanceAfter.body.balance).toBe(balanceBefore.body.balance - 3 * 1000);

    const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    expect(variant.stockQuantity).toBe(20 - 2 - 3);
  });

  it("rejects a write-off with no reason", async () => {
    const res = await request(app).post("/api/inventory/write-offs").set(auth()).send({ variantId, quantity: 1, note: "" });
    expect(res.status).toBe(400);
  });

  it("reconciles stock via a stocktake, recording the movement even with zero discrepancy", async () => {
    const variantBefore = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });

    const noChange = await request(app).post("/api/inventory/stocktakes").set(auth()).send({
      variantId,
      actualQuantity: variantBefore.stockQuantity,
    });
    expect(noChange.status).toBe(201);
    expect(noChange.body.movement.quantity).toBe(0);
    expect(noChange.body.movement.type).toBe("STOCKTAKE");

    const shortfall = await request(app).post("/api/inventory/stocktakes").set(auth()).send({
      variantId,
      actualQuantity: variantBefore.stockQuantity - 4,
      note: "Found 4 fewer than recorded",
    });
    expect(shortfall.status).toBe(201);
    expect(shortfall.body.movement.quantity).toBe(-4);

    const variantAfter = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    expect(variantAfter.stockQuantity).toBe(variantBefore.stockQuantity - 4);
  });

  it("computes a daily report with opening/closing stock and today's movement sums", async () => {
    const res = await request(app).get("/api/inventory/daily-report").set(auth());
    expect(res.status).toBe(200);
    const row = res.body.rows.find((r: { variantId: string }) => r.variantId === variantId);
    expect(row).toBeTruthy();
    expect(row.closingStock).toBe(row.openingStock + row.receipts - row.sales - row.writeOffs + row.stocktakeAdjustments);
    expect(row.actualStock).not.toBeNull();
  });

  it("exports inventory to an Excel file", async () => {
    const res = await request(app)
      .get("/api/inventory/export")
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

  describe("suppliers", () => {
    let supplierId: string;

    it("creates a supplier", async () => {
      const res = await request(app).post("/api/suppliers").set(auth()).send({
        name: "Test Supplier",
        contactPerson: "Alisher",
        phone: "+998901112233",
      });
      expect(res.status).toBe(201);
      expect(res.body.supplier.name).toBe("Test Supplier");
      supplierId = res.body.supplier.id;
    });

    it("links a supplier to a receipt", async () => {
      const res = await request(app).post("/api/inventory/receipts").set(auth()).send({
        variantId,
        quantity: 5,
        purchasePrice: 1200,
        supplierId,
      });
      expect(res.status).toBe(201);
      expect(res.body.movement.supplierId).toBe(supplierId);
    });

    it("rejects a receipt with a supplier from another tenant", async () => {
      const otherSeller = await registerAndLoginSeller(app);
      const otherSupplier = await request(app)
        .post("/api/suppliers")
        .set({ Authorization: `Bearer ${otherSeller.accessToken}` })
        .send({ name: "Other Tenant Supplier" });

      const res = await request(app).post("/api/inventory/receipts").set(auth()).send({
        variantId,
        quantity: 1,
        supplierId: otherSupplier.body.supplier.id,
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_SUPPLIER");

      await deleteTenantCompletely(otherSeller.tenantId);
    });

    it("updates and deletes a supplier with no linked movements", async () => {
      const fresh = await request(app).post("/api/suppliers").set(auth()).send({ name: "Disposable Supplier" });
      const id = fresh.body.supplier.id;

      const updated = await request(app).patch(`/api/suppliers/${id}`).set(auth()).send({ phone: "+998900009999" });
      expect(updated.status).toBe(200);
      expect(updated.body.supplier.phone).toBe("+998900009999");

      const deleted = await request(app).delete(`/api/suppliers/${id}`).set(auth());
      expect(deleted.status).toBe(204);
    });

    it("refuses to delete a supplier referenced by an existing receipt", async () => {
      const res = await request(app).delete(`/api/suppliers/${supplierId}`).set(auth());
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("SUPPLIER_HAS_MOVEMENTS");
    });

    it("searches suppliers by name", async () => {
      const res = await request(app).get("/api/suppliers").set(auth()).query({ search: "Test Supplier" });
      expect(res.status).toBe(200);
      expect(res.body.items.some((s: { id: string }) => s.id === supplierId)).toBe(true);
    });
  });
});
