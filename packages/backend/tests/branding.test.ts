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

describeWithDb("shop branding (integration)", () => {
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

  it("rejects unauthenticated settings updates", async () => {
    const res = await request(app).patch("/api/tenants/me").send({ themeColor: "#1f7a64" });
    expect(res.status).toBe(401);
  });

  it("updates theme color and description without touching telegramChatId", async () => {
    const res = await request(app)
      .patch("/api/tenants/me")
      .set(auth())
      .send({ themeColor: "#1f7a64", description: "Лучшие товары в городе" });

    expect(res.status).toBe(200);
    expect(res.body.tenant.themeColor).toBe("#1f7a64");
    expect(res.body.tenant.description).toBe("Лучшие товары в городе");

    const meta = await request(app).get("/api/storefront/meta").set("Host", host);
    expect(meta.body.themeColor).toBe("#1f7a64");
    expect(meta.body.description).toBe("Лучшие товары в городе");
  });

  it("rejects an invalid theme color", async () => {
    const res = await request(app).patch("/api/tenants/me").set(auth()).send({ themeColor: "not-a-color" });
    expect(res.status).toBe(400);
  });

  it("rejects a logo upload with no file", async () => {
    const res = await request(app).post("/api/tenants/me/logo").set(auth());
    expect(res.status).toBe(400);
  });

  it("uploads a logo, replacing any previous one", async () => {
    const first = await request(app).post("/api/tenants/me/logo").set(auth()).attach("image", TINY_PNG, "logo1.png");
    expect(first.status).toBe(200);
    expect(first.body.tenant.logoUrl).toMatch(/^\/uploads\/.+\.jpg$/);
    const firstLogoUrl = first.body.tenant.logoUrl as string;

    const second = await request(app).post("/api/tenants/me/logo").set(auth()).attach("image", TINY_PNG, "logo2.png");
    expect(second.status).toBe(200);
    expect(second.body.tenant.logoUrl).not.toBe(firstLogoUrl);

    const meta = await request(app).get("/api/storefront/meta").set("Host", host);
    expect(meta.body.logoUrl).toBe(second.body.tenant.logoUrl);
  });
});
