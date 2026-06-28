import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { hashPassword, verifyPassword } from "../src/utils/password";
import { signAccessToken, verifyAccessToken, hashToken } from "../src/utils/jwt";
import { createApp } from "../src/app";
import { prisma } from "../src/db/prisma";

describe("password hashing", () => {
  it("verifies a matching password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("correct-horse-battery-staple", hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });
});

describe("jwt access tokens", () => {
  it("round-trips claims through sign/verify", () => {
    const token = signAccessToken({ sub: "user-1", role: "OWNER", tenantId: "tenant-1" });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.role).toBe("OWNER");
    expect(payload.tenantId).toBe("tenant-1");
  });

  it("hashToken is deterministic for the same input", () => {
    expect(hashToken("same-value")).toBe(hashToken("same-value"));
    expect(hashToken("a")).not.toBe(hashToken("b"));
  });
});

// Requires a reachable Postgres (DATABASE_URL) with migrations + seed applied.
const describeWithDb = process.env.SKIP_DB_TESTS ? describe.skip : describe;

describeWithDb("auth flow (integration)", () => {
  const app = createApp();
  const suffix = Date.now();
  const email = `seller${suffix}@example.com`;
  const password = "supersecret123";
  let accessToken: string;
  let refreshToken: string;

  afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
      await prisma.verificationToken.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    const tenant = await prisma.tenant.findUnique({ where: { subdomain: `selleshop${suffix}` } });
    if (tenant) {
      // registerSeller auto-creates a default CashRegister - must go before the tenant.
      await prisma.cashRegister.deleteMany({ where: { tenantId: tenant.id } });
    }
    await prisma.tenant.deleteMany({ where: { subdomain: `selleshop${suffix}` } });
    await prisma.$disconnect();
  });

  it("registers a new seller + tenant on the trial plan, already email-verified", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Test Seller",
      email,
      password,
      shopName: "Selle Shop",
      subdomain: `selleshop${suffix}`,
      planCode: "start",
    });

    expect(res.status).toBe(201);
    expect(res.body.tenant.status).toBe("TRIAL");
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.passwordHash).toBeUndefined();

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.emailVerifiedAt).not.toBeNull();
  });

  it("logs in immediately after registering, no verification step needed", async () => {
    const res = await request(app).post("/api/auth/login").send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it("returns the current user + tenant from /me", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
    expect(res.body.tenant.subdomain).toBe(`selleshop${suffix}`);
  });

  it("rejects /me without a token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("rotates the refresh token and issues a new access token", async () => {
    const res = await request(app).post("/api/auth/refresh").send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).not.toBe(refreshToken);

    const reuse = await request(app).post("/api/auth/refresh").send({ refreshToken });
    expect(reuse.status).toBe(401);
  });

  it("logs out and invalidates the refresh token", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({ email, password });
    const freshRefreshToken = loginRes.body.refreshToken;

    const logoutRes = await request(app).post("/api/auth/logout").send({ refreshToken: freshRefreshToken });
    expect(logoutRes.status).toBe(204);

    const reuse = await request(app).post("/api/auth/refresh").send({ refreshToken: freshRefreshToken });
    expect(reuse.status).toBe(401);
  });
});
