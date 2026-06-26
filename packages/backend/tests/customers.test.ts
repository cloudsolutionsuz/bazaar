import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/db/prisma";
import { registerAndLoginSeller, type TestSeller } from "./helpers/registerTenant";
import { deleteTenantCompletely } from "./helpers/cleanupTenant";
import { DEFAULT_ADDRESS } from "./helpers/orderFixtures";

const describeWithDb = process.env.SKIP_DB_TESTS ? describe.skip : describe;

describeWithDb("customers (mini-account by phone, integration)", () => {
  const app = createApp();
  let seller: TestSeller;
  let variantId: string;
  let host: string;

  function auth() {
    return { Authorization: `Bearer ${seller.accessToken}` };
  }

  beforeAll(async () => {
    seller = await registerAndLoginSeller(app);
    host = `${seller.subdomain}.localhost`;

    const product = await request(app).post("/api/products").set(auth()).send({
      name: "Customer Test Product",
      price: 15000,
      variants: [{ sku: `CUST-${Date.now()}`, stockQuantity: 50 }],
    });
    variantId = product.body.product.variants[0].id;
  });

  afterAll(async () => {
    await deleteTenantCompletely(seller.tenantId);
    await prisma.$disconnect();
  });

  it("creates a Customer on first order and reuses it on a repeat order with a differently formatted phone", async () => {
    const first = await request(app)
      .post("/api/storefront/orders")
      .set("Host", host)
      .send({
        customerName: "Aziz",
        customerPhone: "+998 90 123-45-67",
        ...DEFAULT_ADDRESS,
        items: [{ variantId, quantity: 1 }],
      });
    expect(first.status).toBe(201);

    const customersAfterFirst = await prisma.customer.findMany({ where: { tenantId: seller.tenantId } });
    expect(customersAfterFirst).toHaveLength(1);
    expect(customersAfterFirst[0].phone).toBe("998901234567");
    expect(customersAfterFirst[0].name).toBe("Aziz");

    // Same phone, different formatting and a new name - should update the
    // same Customer, not create a second one.
    const second = await request(app)
      .post("/api/storefront/orders")
      .set("Host", host)
      .send({
        customerName: "Aziz Karimov",
        customerPhone: "998901234567",
        ...DEFAULT_ADDRESS,
        items: [{ variantId, quantity: 1 }],
      });
    expect(second.status).toBe(201);

    const customersAfterSecond = await prisma.customer.findMany({ where: { tenantId: seller.tenantId } });
    expect(customersAfterSecond).toHaveLength(1);
    expect(customersAfterSecond[0].name).toBe("Aziz Karimov");
    expect(customersAfterSecond[0].id).toBe(customersAfterFirst[0].id);
  });

  it("returns both orders for the buyer's normalized phone via the public lookup, newest first", async () => {
    const res = await request(app).get("/api/storefront/orders/by-phone").set("Host", host).query({ phone: "+998(90)123-45-67" });
    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(2);
    expect(res.body.orders[0].customerName).toBe("Aziz Karimov");
    expect(res.body.orders[1].customerName).toBe("Aziz");
  });

  it("returns an empty list (not a 404) for a phone that never ordered", async () => {
    const res = await request(app).get("/api/storefront/orders/by-phone").set("Host", host).query({ phone: "+998900000999" });
    expect(res.status).toBe(200);
    expect(res.body.orders).toEqual([]);
  });

  it("rejects an order with a district that doesn't belong to the given region", async () => {
    const res = await request(app)
      .post("/api/storefront/orders")
      .set("Host", host)
      .send({
        customerName: "Bad Address Buyer",
        customerPhone: "+998900001111",
        addressRegion: "tashkent_city",
        addressDistrict: "bukhara_city", // belongs to the "bukhara" region, not tashkent_city
        addressMahalla: "Test Mahalla",
        items: [{ variantId, quantity: 1 }],
      });
    expect(res.status).toBe(400);
  });

  it("stores additional contact phone numbers on the order", async () => {
    const res = await request(app)
      .post("/api/storefront/orders")
      .set("Host", host)
      .send({
        customerName: "Multi Phone Buyer",
        customerPhone: "+998900002222",
        additionalPhones: ["+998 90 000-22-23", "998900002224"],
        ...DEFAULT_ADDRESS,
        items: [{ variantId, quantity: 1 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.order.additionalPhones).toEqual(["998900002223", "998900002224"]);
  });

  it("lists customers for the admin with order count/total spent, excluding cancelled/refunded orders", async () => {
    const cancelledBuyer = await request(app)
      .post("/api/storefront/orders")
      .set("Host", host)
      .send({
        customerName: "Cancels Everything",
        customerPhone: "+998900003333",
        ...DEFAULT_ADDRESS,
        items: [{ variantId, quantity: 1 }],
      });
    await request(app)
      .patch(`/api/orders/${cancelledBuyer.body.order.id}/status`)
      .set(auth())
      .send({ status: "CANCELLED" });

    const list = await request(app).get("/api/customers").set(auth()).query({ search: "Aziz" });
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    const aziz = list.body.items[0];
    expect(aziz.name).toBe("Aziz Karimov");
    expect(aziz.orderCount).toBe(2);
    expect(aziz.totalSpent).toBe(30000);

    const cancelled = await request(app).get("/api/customers").set(auth()).query({ search: "Cancels" });
    expect(cancelled.body.items[0].orderCount).toBe(0);
    expect(cancelled.body.items[0].totalSpent).toBe(0);
  });
});
