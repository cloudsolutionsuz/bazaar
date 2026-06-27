import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import ExcelJS from "exceljs";
import { createApp } from "../src/app";
import { prisma } from "../src/db/prisma";
import { registerAndLoginSeller, type TestSeller } from "./helpers/registerTenant";
import { deleteTenantCompletely } from "./helpers/cleanupTenant";
import { DEFAULT_ADDRESS } from "./helpers/orderFixtures";

const describeWithDb = process.env.SKIP_DB_TESTS ? describe.skip : describe;

// A 1x1 transparent PNG, just large enough for sharp to process.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

// supertest/superagent won't auto-parse an xlsx Content-Type into res.body,
// so binary downloads need an explicit byte-preserving parser.
function getBinary(app: Parameters<typeof request>[0], url: string, headers: Record<string, string>) {
  return request(app)
    .get(url)
    .set(headers)
    .buffer()
    .parse((res, callback) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => callback(null, Buffer.concat(chunks)));
    });
}

describeWithDb("products / inventory / orders (integration)", () => {
  const app = createApp();
  let seller: TestSeller;

  beforeAll(async () => {
    seller = await registerAndLoginSeller(app);
  });

  afterAll(async () => {
    await deleteTenantCompletely(seller.tenantId);
    await prisma.$disconnect();
  });

  function auth() {
    return { Authorization: `Bearer ${seller.accessToken}` };
  }

  describe("products", () => {
    it("creates a product with an auto-generated default variant", async () => {
      const res = await request(app)
        .post("/api/products")
        .set(auth())
        .send({ name: "Simple Tee", price: 50000 });

      expect(res.status).toBe(201);
      expect(res.body.product.variants).toHaveLength(1);
      expect(res.body.product.variants[0].name).toBeNull();
      expect(res.body.product.variants[0].stockQuantity).toBe(0);
    });

    it("creates a product with explicit variants", async () => {
      const res = await request(app)
        .post("/api/products")
        .set(auth())
        .send({
          name: "Hoodie",
          price: 150000,
          variants: [
            { name: "S / Black", sku: `HOOD-S-BLK-${Date.now()}`, stockQuantity: 5 },
            { name: "M / Black", sku: `HOOD-M-BLK-${Date.now()}`, stockQuantity: 3, priceOverride: 160000 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.product.variants).toHaveLength(2);

      // initial non-zero stock at creation must be logged in the inventory ledger
      const movements = await prisma.inventoryMovement.findMany({
        where: { variantId: { in: res.body.product.variants.map((v: { id: string }) => v.id) } },
      });
      expect(movements.every((m) => m.type === "ADJUSTMENT")).toBe(true);
    });

    it("rejects duplicate SKUs within the same tenant", async () => {
      const sku = `DUP-${Date.now()}`;
      const first = await request(app).post("/api/products").set(auth()).send({
        name: "First", price: 1000, variants: [{ sku }],
      });
      expect(first.status).toBe(201);

      const second = await request(app).post("/api/products").set(auth()).send({
        name: "Second", price: 1000, variants: [{ sku }],
      });
      expect(second.status).toBe(409);
      expect(second.body.error.code).toBe("SKU_TAKEN");
    });

    it("lists products scoped to the tenant", async () => {
      const res = await request(app).get("/api/products").set(auth());
      expect(res.status).toBe(200);
      expect(res.body.total).toBeGreaterThan(0);
    });

    it("uploads and compresses a product image", async () => {
      const created = await request(app).post("/api/products").set(auth()).send({ name: "With Image", price: 1000 });
      const productId = created.body.product.id;

      const res = await request(app)
        .post(`/api/products/${productId}/images`)
        .set(auth())
        .attach("images", TINY_PNG, "test.png");

      expect(res.status).toBe(201);
      expect(res.body.product.images).toHaveLength(1);
      expect(res.body.product.images[0].url).toMatch(/^\/uploads\/.+\.jpg$/);
    });

    it("refuses to delete a product once it has been ordered", async () => {
      const created = await request(app).post("/api/products").set(auth()).send({
        name: "Ordered Product", price: 20000, variants: [{ sku: `ORD-DEL-${Date.now()}`, stockQuantity: 10 }],
      });
      const variant = created.body.product.variants[0];

      await request(app).post("/api/orders").set(auth()).send({
        customerName: "Buyer", customerPhone: "+998901234567", ...DEFAULT_ADDRESS,
        items: [{ variantId: variant.id, quantity: 1 }],
      });

      const del = await request(app).delete(`/api/products/${created.body.product.id}`).set(auth());
      expect(del.status).toBe(409);
      expect(del.body.error.code).toBe("PRODUCT_HAS_ORDERS");
    });
  });

  describe("inventory", () => {
    it("increases stock via a manual receipt and logs the movement", async () => {
      const created = await request(app).post("/api/products").set(auth()).send({
        name: "Receipt Test", price: 5000, variants: [{ sku: `RCPT-${Date.now()}`, stockQuantity: 0 }],
      });
      const variantId = created.body.product.variants[0].id;

      const receipt = await request(app).post("/api/inventory/receipts").set(auth()).send({
        variantId, quantity: 20, purchasePrice: 3000, note: "Test receipt",
      });
      expect(receipt.status).toBe(201);

      const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
      expect(variant.stockQuantity).toBe(20);

      const movements = await request(app).get("/api/inventory/movements").set(auth()).query({ variantId });
      expect(movements.body.items.some((m: { type: string }) => m.type === "RECEIPT")).toBe(true);
    });

    it("lists variants at or below their low-stock threshold", async () => {
      const sku = `LOW-${Date.now()}`;
      await request(app).post("/api/products").set(auth()).send({
        name: "Low Stock Item", price: 1000, variants: [{ sku, stockQuantity: 2, lowStockThreshold: 5 }],
      });

      const res = await request(app).get("/api/inventory/low-stock").set(auth());
      expect(res.status).toBe(200);
      expect(res.body.variants.some((v: { sku: string }) => v.sku === sku)).toBe(true);
    });
  });

  describe("orders", () => {
    it("creates an order, deducts stock, and records status history", async () => {
      const created = await request(app).post("/api/products").set(auth()).send({
        name: "Order Test Item", price: 10000, variants: [{ sku: `ORD-${Date.now()}`, stockQuantity: 10 }],
      });
      const variant = created.body.product.variants[0];

      const order = await request(app).post("/api/orders").set(auth()).send({
        customerName: "Jamshid", customerPhone: "+998901112233", paymentMethod: "cash", ...DEFAULT_ADDRESS,
        items: [{ variantId: variant.id, quantity: 4 }],
      });

      expect(order.status).toBe(201);
      expect(order.body.order.status).toBe("NEW");
      expect(order.body.order.totalAmount).toBe(40000);
      expect(order.body.order.statusHistory).toHaveLength(1);

      const updatedVariant = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
      expect(updatedVariant.stockQuantity).toBe(6);
    });

    it("rejects an order when stock is insufficient", async () => {
      const created = await request(app).post("/api/products").set(auth()).send({
        name: "Scarce Item", price: 1000, variants: [{ sku: `SCARCE-${Date.now()}`, stockQuantity: 1 }],
      });
      const variant = created.body.product.variants[0];

      const res = await request(app).post("/api/orders").set(auth()).send({
        customerName: "Buyer", customerPhone: "+998900000000", ...DEFAULT_ADDRESS,
        items: [{ variantId: variant.id, quantity: 5 }],
      });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("INSUFFICIENT_STOCK");
    });

    it("enforces the order status state machine and restocks on cancellation", async () => {
      const created = await request(app).post("/api/products").set(auth()).send({
        name: "Cancel Test Item", price: 1000, variants: [{ sku: `CANCEL-${Date.now()}`, stockQuantity: 10 }],
      });
      const variant = created.body.product.variants[0];

      const order = await request(app).post("/api/orders").set(auth()).send({
        customerName: "Buyer", customerPhone: "+998900000001", ...DEFAULT_ADDRESS,
        items: [{ variantId: variant.id, quantity: 3 }],
      });
      const orderId = order.body.order.id;

      const invalidJump = await request(app).patch(`/api/orders/${orderId}/status`).set(auth()).send({ status: "DELIVERED" });
      expect(invalidJump.status).toBe(400);
      expect(invalidJump.body.error.code).toBe("INVALID_TRANSITION");

      const cancel = await request(app).patch(`/api/orders/${orderId}/status`).set(auth()).send({ status: "CANCELLED" });
      expect(cancel.status).toBe(200);
      expect(cancel.body.order.status).toBe("CANCELLED");

      const restockedVariant = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
      expect(restockedVariant.stockQuantity).toBe(10);

      const movements = await prisma.inventoryMovement.findMany({ where: { orderId } });
      expect(movements.some((m) => m.type === "RETURN")).toBe(true);
    });

    it("stores the courier name on the SHIPPED transition, archives only from a terminal status, and hides archived orders by default", async () => {
      const created = await request(app).post("/api/products").set(auth()).send({
        name: "Archive Test Item", price: 2000, variants: [{ sku: `ARCH-${Date.now()}`, stockQuantity: 5 }],
      });
      const variant = created.body.product.variants[0];

      const order = await request(app).post("/api/orders").set(auth()).send({
        customerName: "Archive Buyer", customerPhone: "+998900000002", ...DEFAULT_ADDRESS,
        items: [{ variantId: variant.id, quantity: 1 }],
      });
      const orderId = order.body.order.id;

      const earlyArchive = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .set(auth())
        .send({ status: "ARCHIVED" });
      expect(earlyArchive.status).toBe(400);
      expect(earlyArchive.body.error.code).toBe("INVALID_TRANSITION");

      const processing = await request(app).patch(`/api/orders/${orderId}/status`).set(auth()).send({ status: "PROCESSING" });
      expect(processing.status).toBe(200);

      const shipped = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .set(auth())
        .send({ status: "SHIPPED", courierName: "Aziz Kuryer" });
      expect(shipped.status).toBe(200);
      expect(shipped.body.order.courierName).toBe("Aziz Kuryer");

      const delivered = await request(app).patch(`/api/orders/${orderId}/status`).set(auth()).send({ status: "DELIVERED" });
      expect(delivered.status).toBe(200);

      const archived = await request(app).patch(`/api/orders/${orderId}/status`).set(auth()).send({ status: "ARCHIVED" });
      expect(archived.status).toBe(200);
      expect(archived.body.order.status).toBe("ARCHIVED");

      const defaultList = await request(app).get("/api/orders").set(auth()).query({ pageSize: 100 });
      expect(defaultList.body.items.map((o: { id: string }) => o.id)).not.toContain(orderId);

      const archivedList = await request(app).get("/api/orders").set(auth()).query({ status: "ARCHIVED" });
      expect(archivedList.body.items.map((o: { id: string }) => o.id)).toContain(orderId);

      const includeArchivedList = await request(app).get("/api/orders").set(auth()).query({ includeArchived: "true", pageSize: 100 });
      expect(includeArchivedList.body.items.map((o: { id: string }) => o.id)).toContain(orderId);
    });
  });

  describe("plan limits", () => {
    it("blocks creating a product once the plan's product limit is reached", async () => {
      // Isolated tenant: mutating the plan must not leak into the shared
      // `seller` tenant used by every other describe block in this file.
      const limitedSeller = await registerAndLoginSeller(app);
      const limitedAuth = { Authorization: `Bearer ${limitedSeller.accessToken}` };

      const limitedPlan = await prisma.plan.create({
        data: {
          code: `test-limited-${Date.now()}`,
          name: "Test Limited",
          priceSum: 1,
          maxProducts: 1,
          maxOrdersPerMonth: null,
          maxEmployees: 1,
          features: {},
        },
      });
      await prisma.tenant.update({ where: { id: limitedSeller.tenantId }, data: { planId: limitedPlan.id } });

      const first = await request(app).post("/api/products").set(limitedAuth).send({ name: "Within Limit", price: 1000 });
      expect(first.status).toBe(201);

      const second = await request(app).post("/api/products").set(limitedAuth).send({ name: "Over Limit", price: 1000 });
      expect(second.status).toBe(403);
      expect(second.body.error.code).toBe("PLAN_LIMIT_REACHED");

      await deleteTenantCompletely(limitedSeller.tenantId);
      await prisma.plan.delete({ where: { id: limitedPlan.id } });
    });
  });

  describe("export / import", () => {
    it("exports products to a valid xlsx file", async () => {
      const res = await getBinary(app, "/api/products/export", auth());
      expect(res.status).toBe(200);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body as unknown as Parameters<typeof workbook.xlsx.load>[0]);
      expect(workbook.worksheets[0].getRow(1).getCell(1).value).toBe("Name");
    });

    it("imports simple products from an xlsx file", async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Products");
      const sku = `IMPORT-${Date.now()}`;
      sheet.addRow(["Name", "SKU", "Price", "Description", "Stock"]);
      sheet.addRow(["Imported Item", sku, 7500, "From spreadsheet", 12]);
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

      const res = await request(app).post("/api/products/import").set(auth()).attach("file", buffer, "products.xlsx");

      expect(res.status).toBe(200);
      expect(res.body.created).toBe(1);
      expect(res.body.errors).toHaveLength(0);

      const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku } });
      expect(variant.stockQuantity).toBe(12);
    });
  });
});
