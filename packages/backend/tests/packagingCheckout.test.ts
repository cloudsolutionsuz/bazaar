import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/db/prisma";
import { registerAndLoginSeller, type TestSeller } from "./helpers/registerTenant";
import { deleteTenantCompletely } from "./helpers/cleanupTenant";
import { DEFAULT_ADDRESS, SECOND_PHONE } from "./helpers/orderFixtures";

const describeWithDb = process.env.SKIP_DB_TESTS ? describe.skip : describe;

describeWithDb("box/block packaging and storefront checkout rules (integration)", () => {
  const app = createApp();
  let seller: TestSeller;
  let host: string;
  let productId: string;
  let variantId: string;
  let plainVariantId: string;
  const PRICE = 2000;

  function auth() {
    return { Authorization: `Bearer ${seller.accessToken}` };
  }

  function checkout(body: object) {
    return request(app)
      .post("/api/storefront/orders")
      .set("Host", host)
      .send({ customerName: "Pack Buyer", customerPhone: "+998950000001", ...SECOND_PHONE, ...DEFAULT_ADDRESS, ...body });
  }

  async function stock(id: string): Promise<number> {
    return (await prisma.productVariant.findUniqueOrThrow({ where: { id } })).stockQuantity;
  }

  beforeAll(async () => {
    seller = await registerAndLoginSeller(app);
    host = `${seller.subdomain}.localhost`;

    const packed = await request(app).post("/api/products").set(auth()).send({
      name: "Packed Product",
      price: PRICE,
      piecesPerBlock: 10,
      piecesPerBox: 24,
      variants: [{ sku: `PK-${Date.now()}`, stockQuantity: 100 }],
    });
    expect(packed.status).toBe(201);
    productId = packed.body.product.id;
    variantId = packed.body.product.variants[0].id;

    const plain = await request(app).post("/api/products").set(auth()).send({
      name: "Plain Product",
      price: 500,
      variants: [{ sku: `PL-${Date.now()}`, stockQuantity: 100 }],
    });
    plainVariantId = plain.body.product.variants[0].id;
  });

  afterAll(async () => {
    await deleteTenantCompletely(seller.tenantId);
    await prisma.$disconnect();
  });

  it("stores, updates and clears the pieces-per-block/box on a product, and exposes them to the storefront", async () => {
    const created = await request(app).get(`/api/products/${productId}`).set(auth());
    expect(created.body.product).toMatchObject({ piecesPerBlock: 10, piecesPerBox: 24 });

    const storefront = await request(app).get(`/api/storefront/products/${productId}`).set("Host", host);
    expect(storefront.body.product).toMatchObject({ piecesPerBlock: 10, piecesPerBox: 24, price: PRICE });

    const tooSmall = await request(app).patch(`/api/products/${productId}`).set(auth()).send({ piecesPerBox: 1 });
    expect(tooSmall.status).toBe(400);

    const cleared = await request(app).patch(`/api/products/${productId}`).set(auth()).send({ piecesPerBlock: null });
    expect(cleared.body.product.piecesPerBlock).toBeNull();
    expect(cleared.body.product.piecesPerBox).toBe(24);

    const restored = await request(app).patch(`/api/products/${productId}`).set(auth()).send({ piecesPerBlock: 10 });
    expect(restored.body.product.piecesPerBlock).toBe(10);
  });

  it("prices a box as pieces-in-box x the per-piece price and takes that many pieces from stock", async () => {
    const res = await checkout({ items: [{ variantId, quantity: 2, unit: "BOX" }] });
    expect(res.status).toBe(201);
    expect(res.body.order.totalAmount).toBe(2 * 24 * PRICE);

    const item = res.body.order.items[0];
    expect(item).toMatchObject({ quantity: 48, unitPrice: PRICE, totalPrice: 48 * PRICE, unit: "BOX", unitSize: 24 });
    expect(await stock(variantId)).toBe(52);

    const movement = await prisma.inventoryMovement.findFirstOrThrow({ where: { orderId: res.body.order.id } });
    expect(movement.quantity).toBe(-48);
  });

  it("mixes pieces, blocks and boxes of the same product in one order", async () => {
    const res = await checkout({
      items: [
        { variantId, quantity: 3 },
        { variantId, quantity: 1, unit: "BLOCK" },
        { variantId, quantity: 1, unit: "BOX" },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.order.totalAmount).toBe((3 + 10 + 24) * PRICE);
    expect(await stock(variantId)).toBe(15);
  });

  it("refuses a box when there isn't a whole box left, without touching stock", async () => {
    const res = await checkout({ items: [{ variantId, quantity: 1, unit: "BOX" }] });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INSUFFICIENT_STOCK");
    expect(await stock(variantId)).toBe(15);
  });

  it("returns every piece to stock when a box order is cancelled", async () => {
    const order = await checkout({ items: [{ variantId, quantity: 1, unit: "BLOCK" }] });
    expect(await stock(variantId)).toBe(5);
    await request(app).patch(`/api/orders/${order.body.order.id}/status`).set(auth()).send({ status: "CANCELLED" });
    expect(await stock(variantId)).toBe(15);
  });

  it("rejects a cart line whose pack size no longer matches the product's", async () => {
    const before = await stock(variantId);

    const stale = await checkout({ items: [{ variantId, quantity: 1, unit: "BLOCK", unitSize: 12 }] });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("UNIT_SIZE_CHANGED");
    expect(await stock(variantId)).toBe(before);

    const current = await checkout({ items: [{ variantId, quantity: 1, unit: "BLOCK", unitSize: 10 }] });
    expect(current.status).toBe(201);
    await request(app).patch(`/api/orders/${current.body.order.id}/status`).set(auth()).send({ status: "CANCELLED" });
    expect(await stock(variantId)).toBe(before);
  });

  it("rejects a unit the product isn't sold by, and an unknown unit", async () => {
    const notPacked = await checkout({ items: [{ variantId: plainVariantId, quantity: 1, unit: "BOX" }] });
    expect(notPacked.status).toBe(400);
    expect(notPacked.body.error.code).toBe("INVALID_UNIT");

    const unknown = await checkout({ items: [{ variantId, quantity: 1, unit: "PALLET" }] });
    expect(unknown.status).toBe(400);
  });

  it("only accepts Uzbek phone numbers at checkout: +998 and exactly 9 digits", async () => {
    const items = [{ variantId: plainVariantId, quantity: 1 }];
    // The last three hold exactly 9 digits - the letters alone must sink them.
    const rejected = ["+7 900 123 45 67", "+99890123456", "+9989012345678", "90123456a", "abcdefghi", "901234567a", "90a1234567", "+998 90 123 45 67 ext"];
    for (const customerPhone of rejected) {
      const res = await checkout({ customerPhone, items });
      expect(res.status, customerPhone).toBe(400);
    }

    const badSecond = await checkout({ additionalPhones: ["+7 900 123 45 67"], items });
    expect(badSecond.status).toBe(400);

    const ok = await checkout({ customerPhone: "95 000 00 02", additionalPhones: ["950000003"], items });
    expect(ok.status).toBe(201);
    // Stored with the country code even when typed without it.
    expect(ok.body.order.customerPhone).toBe("998950000002");
    expect(ok.body.order.additionalPhones).toEqual(["998950000003"]);
  });

  it("requires a second phone number at checkout; further numbers stay optional", async () => {
    const items = [{ variantId: plainVariantId, quantity: 1 }];

    const none = await request(app)
      .post("/api/storefront/orders")
      .set("Host", host)
      .send({ customerName: "One Phone", customerPhone: "+998950000004", ...DEFAULT_ADDRESS, items });
    expect(none.status).toBe(400);

    const empty = await checkout({ additionalPhones: [], items });
    expect(empty.status).toBe(400);

    const three = await checkout({ additionalPhones: ["+998950000005", "+998950000006", "+998950000007"], items });
    expect(three.status).toBe(201);
    expect(three.body.order.additionalPhones).toHaveLength(3);
  });

  it("blocks storefront orders below the shop's minimum order amount, and tells the storefront what it is", async () => {
    const settings = await request(app).patch("/api/tenants/me").set(auth()).send({ minOrderAmount: 5000 });
    expect(settings.status).toBe(200);

    const meta = await request(app).get("/api/storefront/meta").set("Host", host);
    expect(meta.body.minOrderAmount).toBe(5000);

    const below = await checkout({ items: [{ variantId: plainVariantId, quantity: 9 }] });
    expect(below.status).toBe(400);
    expect(below.body.error.code).toBe("MIN_ORDER_AMOUNT");

    const exactly = await checkout({ items: [{ variantId: plainVariantId, quantity: 10 }] });
    expect(exactly.status).toBe(201);

    await request(app).patch("/api/tenants/me").set(auth()).send({ minOrderAmount: 0 });
    const noLimit = await checkout({ items: [{ variantId: plainVariantId, quantity: 1 }] });
    expect(noLimit.status).toBe(201);
  });
});
