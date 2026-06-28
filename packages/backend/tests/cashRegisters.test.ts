import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/db/prisma";
import { registerAndLoginSeller, type TestSeller } from "./helpers/registerTenant";
import { deleteTenantCompletely } from "./helpers/cleanupTenant";

const describeWithDb = process.env.SKIP_DB_TESTS ? describe.skip : describe;

describeWithDb("cash registers (integration)", () => {
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

  it("auto-creates exactly one default, active register on registration", async () => {
    const res = await request(app).get("/api/cash-registers").set(auth());
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ name: "Основная касса", isDefault: true, isActive: true });
  });

  it("creates a second register that is not default", async () => {
    const res = await request(app).post("/api/cash-registers").set(auth()).send({ name: "Точка на рынке" });
    expect(res.status).toBe(201);
    expect(res.body.cashRegister).toMatchObject({ name: "Точка на рынке", isDefault: false, isActive: true });
  });

  it("promoting a register to default unsets the previous default", async () => {
    const list = await request(app).get("/api/cash-registers").set(auth());
    const secondRegister = list.body.items.find((r: { name: string }) => r.name === "Точка на рынке");
    const oldDefault = list.body.items.find((r: { isDefault: boolean }) => r.isDefault);

    const promote = await request(app).patch(`/api/cash-registers/${secondRegister.id}`).set(auth()).send({ isDefault: true });
    expect(promote.status).toBe(200);
    expect(promote.body.cashRegister.isDefault).toBe(true);

    const afterPromote = await request(app).get("/api/cash-registers").set(auth());
    const stillOldDefault = afterPromote.body.items.find((r: { id: string }) => r.id === oldDefault.id);
    expect(stillOldDefault.isDefault).toBe(false);

    // Restore the original default for the rest of the tests in this file.
    await request(app).patch(`/api/cash-registers/${oldDefault.id}`).set(auth()).send({ isDefault: true });
  });

  it("rejects deactivating the current default register", async () => {
    const list = await request(app).get("/api/cash-registers").set(auth());
    const defaultRegister = list.body.items.find((r: { isDefault: boolean }) => r.isDefault);

    const res = await request(app).patch(`/api/cash-registers/${defaultRegister.id}`).set(auth()).send({ isActive: false });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("CANNOT_DEACTIVATE_DEFAULT");
  });

  it("allows deactivating a non-default register", async () => {
    const list = await request(app).get("/api/cash-registers").set(auth());
    const nonDefault = list.body.items.find((r: { isDefault: boolean }) => !r.isDefault);

    const res = await request(app).patch(`/api/cash-registers/${nonDefault.id}`).set(auth()).send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.cashRegister.isActive).toBe(false);

    // Reactivate so it doesn't interfere with other tests reusing this tenant.
    await request(app).patch(`/api/cash-registers/${nonDefault.id}`).set(auth()).send({ isActive: true });
  });

  it("rejects making an inactive register the default", async () => {
    const created = await request(app).post("/api/cash-registers").set(auth()).send({ name: "Временно выключенная" });
    const id = created.body.cashRegister.id;
    await request(app).patch(`/api/cash-registers/${id}`).set(auth()).send({ isActive: false });

    const res = await request(app).patch(`/api/cash-registers/${id}`).set(auth()).send({ isDefault: true });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INACTIVE_CANNOT_BE_DEFAULT");
  });
});
