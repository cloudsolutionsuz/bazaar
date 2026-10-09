import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/db/prisma";
import { registerAndLoginSeller, type TestSeller } from "./helpers/registerTenant";
import { deleteTenantCompletely } from "./helpers/cleanupTenant";
import { DEFAULT_ADDRESS, SECOND_PHONE } from "./helpers/orderFixtures";

const describeWithDb = process.env.SKIP_DB_TESTS ? describe.skip : describe;

describeWithDb("agents (integration)", () => {
  const app = createApp();
  let seller: TestSeller;
  let otherSeller: TestSeller;
  let host: string;
  let variantId: string;
  let registerId: string;

  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const agentLogin = `agent.a.${suffix}`;
  const secondLogin = `agent.b.${suffix}`;
  const agentPassword = "agentpass1";
  const PRICE = 100_000;

  let agentId: string;
  let agentRefCode: string;
  let agentToken: string;
  let secondAgentId: string;
  let secondAgentToken: string;

  function auth(token = seller.accessToken) {
    return { Authorization: `Bearer ${token}` };
  }

  async function placeStorefrontOrder(phone: string, agentRef?: string, quantity = 1) {
    const res = await request(app)
      .post("/api/storefront/orders")
      .set("Host", host)
      .send({
        customerName: "Referred Buyer",
        customerPhone: phone,
        ...SECOND_PHONE,
        ...DEFAULT_ADDRESS,
        items: [{ variantId, quantity }],
        ...(agentRef !== undefined ? { agentRef } : {}),
      });
    expect(res.status).toBe(201);
    return res.body.order.id as string;
  }

  async function setStatus(orderId: string, status: string) {
    const res = await request(app).patch(`/api/orders/${orderId}/status`).set(auth()).send({ status });
    expect(res.status).toBe(200);
  }

  beforeAll(async () => {
    seller = await registerAndLoginSeller(app, "start");
    otherSeller = await registerAndLoginSeller(app);
    host = `${seller.subdomain}.localhost`;

    const product = await request(app).post("/api/products").set(auth()).send({
      name: "Agent Product",
      price: PRICE,
      variants: [{ sku: `AG-${suffix}`, stockQuantity: 100 }],
    });
    variantId = product.body.product.variants[0].id;

    const registers = await request(app).get("/api/cash-registers").set(auth());
    registerId = registers.body.items[0].id;
  });

  afterAll(async () => {
    await deleteTenantCompletely(seller.tenantId);
    await deleteTenantCompletely(otherSeller.tenantId);
    await prisma.$disconnect();
  });

  it("creates an agent with a login, a referral link and bonus terms", async () => {
    const res = await request(app).post("/api/agents").set(auth()).send({
      fullName: "Aliyev Vali Karimovich",
      phone: "90 123 45 67",
      telegram: "@vali",
      instagram: "https://instagram.com/vali",
      login: agentLogin.toUpperCase(),
      password: agentPassword,
      bonusType: "PERCENT",
      bonusValue: 5,
    });
    expect(res.status).toBe(201);
    const agent = res.body.agent;
    expect(agent.login).toBe(agentLogin);
    expect(agent.phone).toBe("998901234567");
    expect(agent.link).toContain(`${seller.subdomain}.`);
    expect(agent.link).toContain(`?ref=${agent.refCode}`);
    expect(agent.bonusBalance).toBe(0);
    expect(agent.passwordHash).toBeUndefined();
    agentId = agent.id;
    agentRefCode = agent.refCode;
  });

  it("does not count agents against the plan's employee limit or list them as employees", async () => {
    // The "start" plan allows a single employee (the owner) - an agent must still fit.
    const employees = await request(app).get("/api/employees").set(auth());
    expect(employees.status).toBe(200);
    expect(employees.body.employees.map((e: { email: string }) => e.email)).not.toContain(agentLogin);

    const second = await request(app).post("/api/agents").set(auth()).send({
      fullName: "Second Agent",
      phone: "+998901112244",
      login: secondLogin,
      password: agentPassword,
      bonusType: "FIXED",
      bonusValue: 7000,
    });
    expect(second.status).toBe(201);
    secondAgentId = second.body.agent.id;
  });

  it("rejects a duplicate login, a non-Uzbek phone and a percent above 100", async () => {
    const base = { fullName: "Dup Agent", phone: "+998901112255", password: agentPassword, bonusType: "PERCENT", bonusValue: 5 };

    const duplicate = await request(app).post("/api/agents").set(auth()).send({ ...base, login: agentLogin });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("LOGIN_TAKEN");

    const badPhone = await request(app).post("/api/agents").set(auth()).send({ ...base, login: `x${suffix}`, phone: "+7 900 123 45 67" });
    expect(badPhone.status).toBe(400);

    const lettersInPhone = await request(app).post("/api/agents").set(auth()).send({ ...base, login: `y${suffix}`, phone: "90123456" });
    expect(lettersInPhone.status).toBe(400);

    const badPercent = await request(app).post("/api/agents").set(auth()).send({ ...base, login: `z${suffix}`, bonusValue: 150 });
    expect(badPercent.status).toBe(400);
  });

  it("lets the agent log in with login + password and reach only the agent endpoints", async () => {
    const login = await request(app).post("/api/auth/login").send({ email: agentLogin, password: agentPassword });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe("AGENT");
    // Only the shop's public identity - no Telegram chat, plan or billing fields.
    expect(Object.keys(login.body.tenant).sort()).toEqual(["id", "name", "status", "subdomain"]);
    agentToken = login.body.accessToken;

    const secondLoginRes = await request(app).post("/api/auth/login").send({ email: secondLogin, password: agentPassword });
    secondAgentToken = secondLoginRes.body.accessToken;

    const wrongPassword = await request(app).post("/api/auth/login").send({ email: agentLogin, password: "nope-nope" });
    expect(wrongPassword.status).toBe(401);

    const me = await request(app).get("/api/agents/me").set(auth(agentToken));
    expect(me.status).toBe(200);
    expect(me.body.agent.id).toBe(agentId);

    for (const path of ["/api/agents", "/api/orders", "/api/products", "/api/finance/balance", "/api/customers", "/api/employees"]) {
      const res = await request(app).get(path).set(auth(agentToken));
      expect(res.status, path).toBe(403);
    }
    const payoutAttempt = await request(app)
      .post(`/api/agents/${agentId}/payouts`)
      .set(auth(agentToken))
      .send({ orderIds: [], cashRegisterId: registerId });
    expect(payoutAttempt.status).toBe(403);
  });

  it("attributes storefront orders to the agent whose referral code was used, and ignores unknown codes", async () => {
    const referred = await placeStorefrontOrder("+998930000001", agentRefCode);
    const unknownCode = await placeStorefrontOrder("+998930000002", "no-such-code");
    const direct = await placeStorefrontOrder("+998930000003");

    const rows = await prisma.order.findMany({ where: { id: { in: [referred, unknownCode, direct] } }, select: { id: true, agentId: true } });
    const agentOf = new Map(rows.map((r) => [r.id, r.agentId]));
    expect(agentOf.get(referred)).toBe(agentId);
    expect(agentOf.get(unknownCode)).toBeNull();
    expect(agentOf.get(direct)).toBeNull();

    // Not earned yet: the bonus only appears once the order is archived.
    const order = await prisma.order.findUniqueOrThrow({ where: { id: referred } });
    expect(order.agentBonus).toBeNull();

    // Buyers never see who referred them or what the agent earns.
    const mine = await request(app).get("/api/storefront/orders/by-phone").set("Host", host).query({ phone: "+998930000001" });
    expect(mine.body.orders).toHaveLength(1);
    for (const field of ["agentId", "agentBonus", "agentBonusAccruedAt", "agentPayoutId"]) {
      expect(mine.body.orders[0]).not.toHaveProperty(field);
    }
  });

  it("accrues the bonus when a referred order is archived - on the goods amount, excluding delivery", async () => {
    await request(app).post("/api/delivery").set(auth()).send({ name: "Tashkent", regions: ["tashkent_city"], cost: 20_000 });

    const orderId = await placeStorefrontOrder("+998930000004", agentRefCode, 2);
    const placed = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(placed.shippingCost).toBe(20_000);
    expect(placed.totalAmount).toBe(PRICE * 2 + 20_000);

    await setStatus(orderId, "SHIPPED");
    await setStatus(orderId, "DELIVERED");
    const beforeArchive = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(beforeArchive.agentBonus).toBeNull();

    await setStatus(orderId, "ARCHIVED");
    const archived = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    // 5% of 200 000 goods - the 20 000 delivery fee earns nothing.
    expect(archived.agentBonus).toBe(10_000);
    expect(archived.agentBonusAccruedAt).not.toBeNull();
  });

  it("earns nothing for an order that was cancelled before being archived", async () => {
    const orderId = await placeStorefrontOrder("+998930000005", agentRefCode);
    await setStatus(orderId, "CANCELLED");
    await setStatus(orderId, "ARCHIVED");
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.agentBonus).toBeNull();
  });

  it("applies a bulk bonus change to every agent, keeping bonuses already earned", async () => {
    const bulk = await request(app).patch("/api/agents/bulk-bonus").set(auth()).send({ bonusType: "PERCENT", bonusValue: 10 });
    expect(bulk.status).toBe(200);
    expect(bulk.body.updated).toBe(2);

    const list = await request(app).get("/api/agents").set(auth());
    expect(list.body.agents.every((a: { bonusType: string; bonusValue: number }) => a.bonusType === "PERCENT" && a.bonusValue === 10)).toBe(true);
    const first = list.body.agents.find((a: { id: string }) => a.id === agentId);
    expect(first.bonusAccrued).toBe(10_000);

    // Only the second agent switches to a fixed sum per order.
    const single = await request(app)
      .patch("/api/agents/bulk-bonus")
      .set(auth())
      .send({ bonusType: "FIXED", bonusValue: 7000, agentIds: [secondAgentId] });
    expect(single.body.updated).toBe(1);

    const secondAgent = await prisma.agent.findUniqueOrThrow({ where: { id: secondAgentId } });
    // Archived straight from NEW: the bonus is earned on archiving, whatever the status before it.
    const orderId = await placeStorefrontOrder("+998930000006", secondAgent.refCode, 3);
    await setStatus(orderId, "ARCHIVED");
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.agentBonus).toBe(7000);
  });

  it("shows an agent only their own sales, with a dashboard summary and filters", async () => {
    const own = await request(app).get("/api/agents/sales").set(auth(agentToken));
    expect(own.status).toBe(200);
    expect(own.body.items.length).toBeGreaterThan(0);
    expect(own.body.items.every((o: { agentId: string }) => o.agentId === agentId)).toBe(true);
    expect(own.body.summary.totalCount).toBe(3);
    expect(own.body.summary.archivedCount).toBe(2);
    expect(own.body.summary.bonusAccrued).toBe(10_000);
    expect(own.body.summary.unpaidCount).toBe(1);
    expect(own.body.summary.unpaidAmount).toBe(10_000);
    expect(own.body.summary.paidCount).toBe(0);

    // Asking for someone else's data is ignored for an AGENT login.
    const spoofed = await request(app).get("/api/agents/sales").set(auth(agentToken)).query({ agentId: secondAgentId });
    expect(spoofed.body.items.every((o: { agentId: string }) => o.agentId === agentId)).toBe(true);

    const newOnly = await request(app).get("/api/agents/sales").set(auth(agentToken)).query({ status: "NEW" });
    expect(newOnly.body.items.every((o: { status: string }) => o.status === "NEW")).toBe(true);
    expect(newOnly.body.summary.totalCount).toBe(1);

    const unpaid = await request(app).get("/api/agents/sales").set(auth(agentToken)).query({ payment: "unpaid" });
    expect(unpaid.body.items).toHaveLength(1);
    expect(unpaid.body.items[0].agentBonus).toBe(10_000);
    // "unpaid" already implies ARCHIVED, so combining it with NEW matches nothing.
    const contradictory = await request(app).get("/api/agents/sales").set(auth(agentToken)).query({ payment: "unpaid", status: "NEW" });
    expect(contradictory.body.items).toHaveLength(0);

    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const noneYet = await request(app).get("/api/agents/sales").set(auth(agentToken)).query({ from: future });
    expect(noneYet.body.summary.totalCount).toBe(0);

    const staffView = await request(app).get("/api/agents/sales").set(auth());
    expect(staffView.body.summary.totalCount).toBe(4);
    const staffFiltered = await request(app).get("/api/agents/sales").set(auth()).query({ agentId: secondAgentId });
    expect(staffFiltered.body.summary.totalCount).toBe(1);
  });

  it("pays an agent out of the Kassa for the selected unpaid archived orders, exactly once", async () => {
    const unpaid = await request(app).get(`/api/agents/${agentId}/unpaid-orders`).set(auth());
    expect(unpaid.status).toBe(200);
    expect(unpaid.body.items).toHaveLength(1);
    expect(unpaid.body.totalAmount).toBe(10_000);
    const orderId = unpaid.body.items[0].id;

    const balanceBefore = (await request(app).get("/api/finance/balance").set(auth())).body.balance;

    const notTheirs = await request(app)
      .post(`/api/agents/${secondAgentId}/payouts`)
      .set(auth())
      .send({ orderIds: [orderId], cashRegisterId: registerId });
    expect(notTheirs.status).toBe(400);
    expect(notTheirs.body.error.code).toBe("INVALID_ORDERS");

    const payout = await request(app)
      .post(`/api/agents/${agentId}/payouts`)
      .set(auth())
      .send({ orderIds: [orderId], cashRegisterId: registerId });
    expect(payout.status).toBe(201);
    expect(payout.body.payout.amount).toBe(10_000);

    const balanceAfter = (await request(app).get("/api/finance/balance").set(auth())).body.balance;
    expect(balanceAfter).toBe(balanceBefore - 10_000);

    const again = await request(app)
      .post(`/api/agents/${agentId}/payouts`)
      .set(auth())
      .send({ orderIds: [orderId], cashRegisterId: registerId });
    expect(again.status).toBe(400);
    expect((await request(app).get("/api/finance/balance").set(auth())).body.balance).toBe(balanceAfter);

    const afterPayout = await request(app).get(`/api/agents/${agentId}/unpaid-orders`).set(auth());
    expect(afterPayout.body.items).toHaveLength(0);

    const sales = await request(app).get("/api/agents/sales").set(auth(agentToken)).query({ payment: "paid" });
    expect(sales.body.items).toHaveLength(1);
    expect(sales.body.items[0].isPaid).toBe(true);
    expect(sales.body.summary.paidAmount).toBe(10_000);

    const payouts = await request(app).get("/api/agents/payouts").set(auth(agentToken));
    expect(payouts.body.items).toHaveLength(1);
    expect(payouts.body.totalAmount).toBe(10_000);
    expect(payouts.body.items[0].orderCount).toBe(1);

    // The other agent must not see this payout.
    const othersPayouts = await request(app).get("/api/agents/payouts").set(auth(secondAgentToken));
    expect(othersPayouts.body.items).toHaveLength(0);
  });

  it("reconciles earned vs paid per agent (akt-sverka), with opening balances and an Excel export", async () => {
    const all = await request(app).get("/api/agents/reconciliation").set(auth());
    expect(all.status).toBe(200);
    const first = all.body.rows.find((r: { agentId: string }) => r.agentId === agentId);
    const second = all.body.rows.find((r: { agentId: string }) => r.agentId === secondAgentId);
    expect(first).toMatchObject({ openingBalance: 0, archivedCount: 1, accrued: 10_000, paid: 10_000, closingBalance: 0 });
    expect(second).toMatchObject({ openingBalance: 0, archivedCount: 1, accrued: 7000, paid: 0, closingBalance: 7000 });
    expect(all.body.totals.closingBalance).toBe(7000);

    // A period starting tomorrow: everything so far is "before" it.
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const later = await request(app).get("/api/agents/reconciliation").set(auth()).query({ from: tomorrow });
    const secondLater = later.body.rows.find((r: { agentId: string }) => r.agentId === secondAgentId);
    expect(secondLater).toMatchObject({ openingBalance: 7000, accrued: 0, paid: 0, closingBalance: 7000 });

    const ownOnly = await request(app).get("/api/agents/reconciliation").set(auth(secondAgentToken));
    expect(ownOnly.body.rows).toHaveLength(1);
    expect(ownOnly.body.rows[0].agentId).toBe(secondAgentId);

    const xlsx = await request(app).get("/api/agents/reconciliation/export").set(auth());
    expect(xlsx.status).toBe(200);
    expect(xlsx.headers["content-type"]).toContain("spreadsheetml");
  });

  it("keeps agents isolated between shops", async () => {
    const foreignList = await request(app).get("/api/agents").set(auth(otherSeller.accessToken));
    expect(foreignList.body.agents).toHaveLength(0);

    const foreignUpdate = await request(app).patch(`/api/agents/${agentId}`).set(auth(otherSeller.accessToken)).send({ fullName: "Hijacked" });
    expect(foreignUpdate.status).toBe(404);

    const foreignUnpaid = await request(app).get(`/api/agents/${agentId}/unpaid-orders`).set(auth(otherSeller.accessToken));
    expect(foreignUnpaid.status).toBe(404);
  });

  it("changes the password, deactivates the agent immediately, and refuses to delete one with history", async () => {
    const reset = await request(app).patch(`/api/agents/${agentId}`).set(auth()).send({ password: "newpass99" });
    expect(reset.status).toBe(200);
    expect((await request(app).post("/api/auth/login").send({ email: agentLogin, password: agentPassword })).status).toBe(401);
    const relogin = await request(app).post("/api/auth/login").send({ email: agentLogin, password: "newpass99" });
    expect(relogin.status).toBe(200);

    const deactivate = await request(app).patch(`/api/agents/${agentId}`).set(auth()).send({ isActive: false });
    expect(deactivate.body.agent.isActive).toBe(false);

    // The access token issued a moment ago stops working right away.
    const afterDeactivation = await request(app).get("/api/agents/sales").set(auth(relogin.body.accessToken));
    expect(afterDeactivation.status).toBe(403);
    expect(afterDeactivation.body.error.code).toBe("AGENT_DISABLED");
    const loginBlocked = await request(app).post("/api/auth/login").send({ email: agentLogin, password: "newpass99" });
    expect(loginBlocked.status).toBe(403);

    // A deactivated agent's link no longer attributes new orders.
    const orderId = await placeStorefrontOrder("+998930000007", agentRefCode);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).agentId).toBeNull();

    const remove = await request(app).delete(`/api/agents/${agentId}`).set(auth());
    expect(remove.status).toBe(409);
    expect(remove.body.error.code).toBe("AGENT_HAS_HISTORY");

    const fresh = await request(app).post("/api/agents").set(auth()).send({
      fullName: "No History",
      phone: "901112266",
      login: `fresh${suffix}`,
      password: agentPassword,
      bonusType: "PERCENT",
      bonusValue: 1,
    });
    const removeFresh = await request(app).delete(`/api/agents/${fresh.body.agent.id}`).set(auth());
    expect(removeFresh.status).toBe(204);
    expect(await prisma.user.findUnique({ where: { email: `fresh${suffix}` } })).toBeNull();
  });
});
