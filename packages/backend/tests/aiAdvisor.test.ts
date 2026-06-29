import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/db/prisma";
import { registerAndLoginSeller, type TestSeller } from "./helpers/registerTenant";
import { deleteTenantCompletely } from "./helpers/cleanupTenant";

const describeWithDb = process.env.SKIP_DB_TESTS ? describe.skip : describe;

// No ANTHROPIC_API_KEY is configured in this test environment (and never
// will be in CI) - that's exactly the scenario these tests exercise. The
// happy path (a real model call producing a sensible answer grounded in the
// tenant's actual data) can only be checked manually, once a real key is in
// packages/backend/.env - same as this project's Telegram integration,
// which is also never asserted against a real external call.
describeWithDb("AI advisor (integration)", () => {
  const app = createApp();
  let seller: TestSeller;

  function auth() {
    return { Authorization: `Bearer ${seller.accessToken}` };
  }

  beforeAll(async () => {
    seller = await registerAndLoginSeller(app);
  });

  afterAll(async () => {
    await deleteTenantCompletely(seller.tenantId);
    await prisma.$disconnect();
  });

  it("requires authentication", async () => {
    const res = await request(app).post("/api/ai-advisor/ask").send({ question: "Как идут продажи?" });
    expect(res.status).toBe(401);
  });

  it("rejects an empty question", async () => {
    const res = await request(app).post("/api/ai-advisor/ask").set(auth()).send({ question: "" });
    expect(res.status).toBe(400);
  });

  it("rejects a question over the length limit", async () => {
    const res = await request(app)
      .post("/api/ai-advisor/ask")
      .set(auth())
      .send({ question: "a".repeat(2001) });
    expect(res.status).toBe(400);
  });

  it("returns a friendly 503 when no Anthropic API key is configured", async () => {
    const res = await request(app).post("/api/ai-advisor/ask").set(auth()).send({ question: "Как идут продажи?" });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("AI_NOT_CONFIGURED");
  });
});
