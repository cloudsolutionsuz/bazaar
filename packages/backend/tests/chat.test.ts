import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/db/prisma";
import { registerAndLoginSeller, type TestSeller } from "./helpers/registerTenant";
import { deleteTenantCompletely } from "./helpers/cleanupTenant";

const describeWithDb = process.env.SKIP_DB_TESTS ? describe.skip : describe;

describeWithDb("chat (buyer <-> shop, integration)", () => {
  const app = createApp();
  let seller: TestSeller;
  let host: string;
  const phone = "+998900001122";

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

  it("creates a Customer and a CUSTOMER message on the first storefront chat message", async () => {
    const res = await request(app)
      .post("/api/storefront/chat")
      .set("Host", host)
      .send({ phone, name: "Aziz", text: "Здравствуйте, есть размер 42?" });
    expect(res.status).toBe(201);
    expect(res.body.message).toMatchObject({ sender: "CUSTOMER", text: "Здравствуйте, есть размер 42?" });

    const customers = await prisma.customer.findMany({ where: { tenantId: seller.tenantId } });
    expect(customers).toHaveLength(1);
    expect(customers[0].name).toBe("Aziz");

    const myMessages = await request(app).get("/api/storefront/chat").set("Host", host).query({ phone });
    expect(myMessages.status).toBe(200);
    expect(myMessages.body.messages).toHaveLength(1);
  });

  it("reuses the same Customer for a second message with a differently formatted phone", async () => {
    await request(app)
      .post("/api/storefront/chat")
      .set("Host", host)
      .send({ phone: "998 90 000-11-22", name: "Aziz", text: "Второй вопрос" });

    const customers = await prisma.customer.findMany({ where: { tenantId: seller.tenantId } });
    expect(customers).toHaveLength(1);

    const myMessages = await request(app).get("/api/storefront/chat").set("Host", host).query({ phone });
    expect(myMessages.body.messages).toHaveLength(2);
  });

  it("shows the thread in the staff inbox with an unread count, which clears after opening it", async () => {
    const threads = await request(app).get("/api/chat/threads").set(auth());
    expect(threads.status).toBe(200);
    const thread = threads.body.items.find((t: { customerName: string }) => t.customerName === "Aziz");
    expect(thread).toBeTruthy();
    expect(thread.unreadCount).toBe(2);
    expect(thread.lastMessageText).toBe("Второй вопрос");

    const detail = await request(app).get(`/api/chat/threads/${thread.customerId}/messages`).set(auth());
    expect(detail.status).toBe(200);
    expect(detail.body.messages).toHaveLength(2);

    const threadsAfter = await request(app).get("/api/chat/threads").set(auth());
    const threadAfter = threadsAfter.body.items.find((t: { customerId: string }) => t.customerId === thread.customerId);
    expect(threadAfter.unreadCount).toBe(0);
  });

  it("lets staff reply, and the buyer sees the reply through the storefront endpoint", async () => {
    const threads = await request(app).get("/api/chat/threads").set(auth());
    const thread = threads.body.items.find((t: { customerName: string }) => t.customerName === "Aziz");

    const reply = await request(app)
      .post(`/api/chat/threads/${thread.customerId}/messages`)
      .set(auth())
      .send({ text: "Да, есть в наличии" });
    expect(reply.status).toBe(201);
    expect(reply.body.message).toMatchObject({ sender: "STAFF", text: "Да, есть в наличии" });

    const myMessages = await request(app).get("/api/storefront/chat").set("Host", host).query({ phone });
    expect(myMessages.body.messages).toHaveLength(3);
    expect(myMessages.body.messages[2]).toMatchObject({ sender: "STAFF", text: "Да, есть в наличии" });
  });

  it("keeps tenants isolated - a staff member from another tenant can't see or message this thread", async () => {
    const otherSeller = await registerAndLoginSeller(app);
    const otherAuth = { Authorization: `Bearer ${otherSeller.accessToken}` };

    const threads = await request(app).get("/api/chat/threads").set(auth());
    const thread = threads.body.items.find((t: { customerName: string }) => t.customerName === "Aziz");

    const otherThreads = await request(app).get("/api/chat/threads").set(otherAuth);
    expect(otherThreads.body.items).toHaveLength(0);

    const otherDetail = await request(app).get(`/api/chat/threads/${thread.customerId}/messages`).set(otherAuth);
    expect(otherDetail.status).toBe(404);

    const otherReply = await request(app)
      .post(`/api/chat/threads/${thread.customerId}/messages`)
      .set(otherAuth)
      .send({ text: "should not work" });
    expect(otherReply.status).toBe(404);

    await deleteTenantCompletely(otherSeller.tenantId);
  });
});
