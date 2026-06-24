import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/db/prisma";
import { registerAndLoginSeller, type TestSeller } from "./helpers/registerTenant";
import { deleteTenantCompletely } from "./helpers/cleanupTenant";
import { DEFAULT_ADDRESS } from "./helpers/orderFixtures";

const describeWithDb = process.env.SKIP_DB_TESTS ? describe.skip : describe;

describeWithDb("storefront (integration)", () => {
  const app = createApp();
  let seller: TestSeller;
  let activeProductId: string;
  let activeVariantId: string;
  let hiddenProductId: string;
  let host: string;

  function auth() {
    return { Authorization: `Bearer ${seller.accessToken}` };
  }

  beforeAll(async () => {
    seller = await registerAndLoginSeller(app);
    host = `${seller.subdomain}.localhost`;

    const active = await request(app).post("/api/products").set(auth()).send({
      name: "Visible Product",
      price: 10000,
      variants: [{ sku: `SF-VISIBLE-${Date.now()}`, stockQuantity: 5 }],
    });
    activeProductId = active.body.product.id;
    activeVariantId = active.body.product.variants[0].id;

    const hidden = await request(app).post("/api/products").set(auth()).send({
      name: "Hidden Product",
      price: 5000,
      status: "HIDDEN",
      variants: [{ sku: `SF-HIDDEN-${Date.now()}`, stockQuantity: 5 }],
    });
    hiddenProductId = hidden.body.product.id;
  });

  afterAll(async () => {
    await deleteTenantCompletely(seller.tenantId);
    await prisma.$disconnect();
  });

  it("returns 404 for an unknown shop subdomain", async () => {
    const res = await request(app).get("/api/storefront/products").set("Host", "no-such-shop.localhost");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("SHOP_NOT_FOUND");
  });

  it("lists only non-hidden products, scoped to the tenant", async () => {
    const res = await request(app).get("/api/storefront/products").set("Host", host);
    expect(res.status).toBe(200);
    const ids = res.body.items.map((p: { id: string }) => p.id);
    expect(ids).toContain(activeProductId);
    expect(ids).not.toContain(hiddenProductId);
  });

  it("404s a hidden product's detail page", async () => {
    const res = await request(app).get(`/api/storefront/products/${hiddenProductId}`).set("Host", host);
    expect(res.status).toBe(404);
  });

  it("lists categories for the resolved tenant", async () => {
    const res = await request(app).get("/api/storefront/categories").set("Host", host);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.categories)).toBe(true);
  });

  it("places an order without authentication and decrements stock", async () => {
    const res = await request(app).post("/api/storefront/orders").set("Host", host).send({
      customerName: "Guest Buyer",
      customerPhone: "+998901112233",
      ...DEFAULT_ADDRESS,
      items: [{ variantId: activeVariantId, quantity: 2 }],
    });

    expect(res.status).toBe(201);
    expect(res.body.order.status).toBe("NEW");
    expect(res.body.order.totalAmount).toBe(20000);

    const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: activeVariantId } });
    expect(variant.stockQuantity).toBe(3);

    const movement = await prisma.inventoryMovement.findFirstOrThrow({ where: { orderId: res.body.order.id } });
    expect(movement.createdByUserId).toBeNull();
  });

  it("tracks a page view without authentication", async () => {
    const res = await request(app)
      .post("/api/storefront/analytics/track")
      .set("Host", host)
      .send({ sessionId: "test-session-1", path: "/products/123" });
    expect(res.status).toBe(204);

    const pageView = await prisma.pageView.findFirstOrThrow({ where: { tenantId: seller.tenantId } });
    expect(pageView.sessionId).toBe("test-session-1");
    expect(pageView.path).toBe("/products/123");
  });

  it("blocks storefront access once the tenant is BLOCKED", async () => {
    await prisma.tenant.update({ where: { id: seller.tenantId }, data: { status: "BLOCKED" } });

    const res = await request(app).get("/api/storefront/products").set("Host", host);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("SHOP_BLOCKED");

    const track = await request(app)
      .post("/api/storefront/analytics/track")
      .set("Host", host)
      .send({ sessionId: "test-session-2", path: "/" });
    expect(track.status).toBe(403);

    await prisma.tenant.update({ where: { id: seller.tenantId }, data: { status: "ACTIVE" } });
  });
});
