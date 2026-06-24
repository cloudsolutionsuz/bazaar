import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/db/prisma";
import { registerAndLoginSeller, type TestSeller } from "./helpers/registerTenant";
import { deleteTenantCompletely } from "./helpers/cleanupTenant";

const describeWithDb = process.env.SKIP_DB_TESTS ? describe.skip : describe;

// A 1x1 transparent PNG, just large enough for sharp to process.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

describeWithDb("banners (integration)", () => {
  const app = createApp();
  let seller: TestSeller;
  let host: string;

  function auth() {
    return { Authorization: `Bearer ${seller.accessToken}` };
  }

  beforeAll(async () => {
    seller = await registerAndLoginSeller(app);
    host = `${seller.subdomain}.localhost`;
  });

  afterAll(async () => {
    await deleteTenantCompletely(seller.tenantId);
    await prisma.$disconnect();
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/banners");
    expect(res.status).toBe(401);
  });

  it("rejects a request with no image file", async () => {
    const res = await request(app).post("/api/banners").set(auth());
    expect(res.status).toBe(400);
  });

  it("creates a banner with an uploaded image, defaulting to active", async () => {
    const res = await request(app)
      .post("/api/banners")
      .set(auth())
      .field("linkUrl", "https://example.com/promo")
      .attach("image", TINY_PNG, "banner.png");

    expect(res.status).toBe(201);
    expect(res.body.banner.imageUrl).toMatch(/^\/uploads\/.+\.jpg$/);
    expect(res.body.banner.linkUrl).toBe("https://example.com/promo");
    expect(res.body.banner.isActive).toBe(true);
    expect(res.body.banner.position).toBe(0);
  });

  it("creates a second banner at the next position and lists both for the owner", async () => {
    const res = await request(app).post("/api/banners").set(auth()).attach("image", TINY_PNG, "banner2.png");
    expect(res.status).toBe(201);
    expect(res.body.banner.position).toBe(1);
    expect(res.body.banner.linkUrl).toBeNull();

    const list = await request(app).get("/api/banners").set(auth());
    expect(list.status).toBe(200);
    expect(list.body.banners).toHaveLength(2);
  });

  it("only returns active banners, ordered by position, on the public storefront endpoint", async () => {
    const list = await request(app).get("/api/banners").set(auth());
    const [first, second] = list.body.banners;

    const deactivate = await request(app).patch(`/api/banners/${second.id}`).set(auth()).send({ isActive: false });
    expect(deactivate.status).toBe(200);
    expect(deactivate.body.banner.isActive).toBe(false);

    const publicList = await request(app).get("/api/storefront/banners").set("Host", host);
    expect(publicList.status).toBe(200);
    expect(publicList.body.banners).toHaveLength(1);
    expect(publicList.body.banners[0].id).toBe(first.id);

    // Restore it for the reorder/delete tests below.
    await request(app).patch(`/api/banners/${second.id}`).set(auth()).send({ isActive: true });
  });

  it("reorders banners", async () => {
    const list = await request(app).get("/api/banners").set(auth());
    const [first, second] = list.body.banners;

    const reorder = await request(app)
      .patch("/api/banners/reorder")
      .set(auth())
      .send({ bannerIds: [second.id, first.id] });
    expect(reorder.status).toBe(204);

    const reordered = await request(app).get("/api/banners").set(auth());
    expect(reordered.body.banners[0].id).toBe(second.id);
    expect(reordered.body.banners[0].position).toBe(0);
    expect(reordered.body.banners[1].id).toBe(first.id);
    expect(reordered.body.banners[1].position).toBe(1);
  });

  it("deletes a banner", async () => {
    const list = await request(app).get("/api/banners").set(auth());
    const toDelete = list.body.banners[0];

    const del = await request(app).delete(`/api/banners/${toDelete.id}`).set(auth());
    expect(del.status).toBe(204);

    const after = await request(app).get("/api/banners").set(auth());
    expect(after.body.banners).toHaveLength(1);
    expect(after.body.banners.map((b: { id: string }) => b.id)).not.toContain(toDelete.id);
  });
});
