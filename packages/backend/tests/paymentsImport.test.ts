import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import ExcelJS from "exceljs";
import { createApp } from "../src/app";
import { prisma } from "../src/db/prisma";
import { registerAndLoginSeller, type TestSeller } from "./helpers/registerTenant";
import { deleteTenantCompletely } from "./helpers/cleanupTenant";
import { DEFAULT_ADDRESS } from "./helpers/orderFixtures";

const describeWithDb = process.env.SKIP_DB_TESTS ? describe.skip : describe;

interface PreviewRow {
  status: "ok" | "error";
  errorCode: string | null;
  customerName: string | null;
  orderIds: string[];
  debtBefore: number | null;
  debtAfter: number | null;
}

async function buildSheet(rows: unknown[][], headers = ["Telefon", "Buyurtma ID", "Summa", "Izoh"]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("To'lovlar");
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describeWithDb("kassa payments import (integration)", () => {
  const app = createApp();
  let seller: TestSeller;
  let otherSeller: TestSeller;
  let variantId: string;
  let registerId: string;
  const PRICE = 10_000;

  function auth(token = seller.accessToken) {
    return { Authorization: `Bearer ${token}` };
  }

  async function placeOrder(phone: string, quantity: number, name = "Import Buyer"): Promise<string> {
    const res = await request(app).post("/api/orders").set(auth()).send({
      customerName: name,
      customerPhone: phone,
      ...DEFAULT_ADDRESS,
      items: [{ variantId, quantity }],
    });
    expect(res.status).toBe(201);
    return res.body.order.id;
  }

  function validate(rows: object[]) {
    return request(app).post("/api/finance/payments-import/validate").set(auth()).send({ rows });
  }

  function commit(rows: object[]) {
    return request(app).post("/api/finance/payments-import/commit").set(auth()).send({ rows, cashRegisterId: registerId });
  }

  async function balance(): Promise<number> {
    return (await request(app).get("/api/finance/balance").set(auth())).body.balance;
  }

  async function customerDebt(phone: string): Promise<number> {
    const list = await request(app).get("/api/customers").set(auth()).query({ search: phone });
    return list.body.items[0].balance;
  }

  beforeAll(async () => {
    seller = await registerAndLoginSeller(app);
    otherSeller = await registerAndLoginSeller(app);

    const product = await request(app).post("/api/products").set(auth()).send({
      name: "Import Product",
      price: PRICE,
      variants: [{ sku: `PI-${Date.now()}`, stockQuantity: 500 }],
    });
    variantId = product.body.product.variants[0].id;
    registerId = (await request(app).get("/api/cash-registers").set(auth())).body.items[0].id;
  });

  afterAll(async () => {
    await deleteTenantCompletely(seller.tenantId);
    await deleteTenantCompletely(otherSeller.tenantId);
    await prisma.$disconnect();
  });

  it("serves a template that parses back into rows", async () => {
    const template = await request(app)
      .get("/api/finance/payments-import/template")
      .set(auth())
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });
    expect(template.status).toBe(200);
    expect(template.headers["content-type"]).toContain("spreadsheetml");

    const parsed = await request(app)
      .post("/api/finance/payments-import/parse")
      .set(auth())
      .attach("file", template.body as Buffer, "payments-template.xlsx");
    expect(parsed.status).toBe(200);
    // The sample row names nobody real - it must surface as an error, not crash.
    expect(parsed.body.rows).toHaveLength(1);
    expect(parsed.body.rows[0].status).toBe("error");
  });

  it("matches rows by order ID (full or short) and by phone, and reports every kind of bad row", async () => {
    const orderId = await placeOrder("+998940000001", 3, "Karim");

    const file = await buildSheet([
      ["", orderId, 30_000, "to'liq"],
      ["940000001", "", "5 000", ""],
      [998940000001, `#${orderId.slice(0, 8)}`, 1000, ""],
      ["940000099", "", 1000, ""],
      ["abc", "", 1000, ""],
      ["", "zzzzzzzz", 1000, ""],
      ["", "00000000", 1000, ""],
      ["", "", 1000, ""],
      ["940000001", "", -5, ""],
      ["940000001", "", "12.50", ""],
      ["940000002", orderId, 1000, ""],
    ]);
    const res = await request(app).post("/api/finance/payments-import/parse").set(auth()).attach("file", file, "payments.xlsx");
    expect(res.status).toBe(200);
    const rows: PreviewRow[] = res.body.rows;

    expect(rows[0]).toMatchObject({ status: "ok", customerName: "Karim", orderIds: [orderId], debtBefore: 30_000, debtAfter: 0 });
    // Rows share one view of the debt: row 1 already used it all up.
    expect(rows[1]).toMatchObject({ status: "error", errorCode: "NO_DEBT", customerName: "Karim" });
    expect(rows[2]).toMatchObject({ status: "error", errorCode: "NO_DEBT" });
    expect(rows[3].errorCode).toBe("CUSTOMER_NOT_FOUND");
    expect(rows[4].errorCode).toBe("INVALID_PHONE");
    expect(rows[5].errorCode).toBe("INVALID_ORDER_REF");
    expect(rows[6].errorCode).toBe("ORDER_NOT_FOUND");
    expect(rows[7].errorCode).toBe("MISSING_IDENTIFIER");
    expect(rows[8].errorCode).toBe("INVALID_AMOUNT");
    expect(rows[9].errorCode).toBe("INVALID_AMOUNT");
    expect(rows[10].errorCode).toBe("PHONE_MISMATCH");
    expect(res.body.errorCount).toBe(10);

    // Nothing is written by a preview.
    expect(await customerDebt("998940000001")).toBe(30_000);
  });

  it("refuses to commit while any row has an error, changing nothing", async () => {
    const orderId = await placeOrder("+998940000010", 2);
    const before = await balance();

    const res = await commit([
      { orderRef: orderId, amount: 20_000 },
      { orderRef: orderId, amount: 1 },
    ]);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("IMPORT_HAS_ERRORS");
    expect(await balance()).toBe(before);
    expect(await customerDebt("998940000010")).toBe(20_000);
  });

  it("settles an order in full: confirms the pending income, raises the Kassa balance and clears the customer's debt", async () => {
    const orderId = await placeOrder("+998940000020", 4);
    const before = await balance();

    const res = await commit([{ phone: "940000020", orderRef: orderId.slice(0, 8), amount: 40_000, description: "naqd" }]);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ imported: 1, totalAmount: 40_000 });

    expect(await balance()).toBe(before + 40_000);
    expect(await customerDebt("998940000020")).toBe(0);

    const transactions = await prisma.transaction.findMany({ where: { orderId } });
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({ status: "CONFIRMED", amount: 40_000, cashRegisterId: registerId });

    const pending = await request(app).get("/api/finance/transactions/pending").set(auth());
    expect(pending.body.items.some((t: { orderId: string }) => t.orderId === orderId)).toBe(false);

    const again = await validate([{ orderRef: orderId, amount: 1 }]);
    expect(again.body.rows[0].errorCode).toBe("NO_DEBT");
  });

  it("accepts a partial payment, leaves the rest as debt, and rejects paying more than is owed", async () => {
    const orderId = await placeOrder("+998940000030", 5);
    const before = await balance();

    const over = await validate([{ orderRef: orderId, amount: 50_001 }]);
    expect(over.body.rows[0]).toMatchObject({ status: "error", errorCode: "OVERPAID", debtBefore: 50_000 });

    const partial = await commit([{ orderRef: orderId, amount: 20_000 }]);
    expect(partial.status).toBe(201);
    expect(await balance()).toBe(before + 20_000);
    expect(await customerDebt("998940000030")).toBe(30_000);

    const pendingLeft = await prisma.transaction.findFirstOrThrow({ where: { orderId, status: "PENDING" } });
    expect(pendingLeft.amount).toBe(30_000);

    // Two rows in one file finishing the same order off.
    const rest = await commit([
      { orderRef: orderId, amount: 10_000 },
      { orderRef: orderId, amount: 20_000 },
    ]);
    expect(rest.status).toBe(201);
    expect(await balance()).toBe(before + 50_000);
    expect(await customerDebt("998940000030")).toBe(0);
    expect(await prisma.transaction.count({ where: { orderId, status: "PENDING" } })).toBe(0);

    const confirmed = await prisma.transaction.aggregate({ where: { orderId, type: "INCOME", status: "CONFIRMED" }, _sum: { amount: true } });
    expect(confirmed._sum.amount).toBe(50_000);
  });

  it("pays off a customer's oldest debts first when only a phone is given", async () => {
    const older = await placeOrder("+998940000040", 1);
    const newer = await placeOrder("+998940000040", 2);

    const preview = await validate([{ phone: "+998 94 000-00-40", amount: 15_000 }]);
    expect(preview.body.rows[0]).toMatchObject({ status: "ok", debtBefore: 30_000, debtAfter: 15_000 });
    expect(preview.body.rows[0].orderIds).toEqual([older, newer]);

    expect((await commit([{ phone: "940000040", amount: 15_000 }])).status).toBe(201);

    expect(await prisma.transaction.count({ where: { orderId: older, status: "PENDING" } })).toBe(0);
    const newerPending = await prisma.transaction.findFirstOrThrow({ where: { orderId: newer, status: "PENDING" } });
    expect(newerPending.amount).toBe(15_000);
    expect(await customerDebt("998940000040")).toBe(15_000);

    const tooMuch = await validate([{ phone: "940000040", amount: 15_001 }]);
    expect(tooMuch.body.rows[0].errorCode).toBe("OVERPAID");
  });

  it("refunds exactly what was actually paid when a part-paid order is cancelled", async () => {
    const orderId = await placeOrder("+998940000050", 6);
    await commit([{ orderRef: orderId, amount: 25_000 }]);
    const afterPayment = await balance();

    const cancel = await request(app).patch(`/api/orders/${orderId}/status`).set(auth()).send({ status: "CANCELLED" });
    expect(cancel.status).toBe(200);

    expect(await balance()).toBe(afterPayment - 25_000);
    expect(await prisma.transaction.count({ where: { orderId, status: "PENDING" } })).toBe(0);
    const refund = await prisma.transaction.findFirstOrThrow({ where: { orderId, type: "EXPENSE" } });
    expect(refund).toMatchObject({ amount: 25_000, cashRegisterId: registerId });

    const closed = await validate([{ orderRef: orderId, amount: 1000 }]);
    expect(closed.body.rows[0].errorCode).toBe("ORDER_CLOSED");
  });

  it("never matches another shop's orders or customers, and is closed to cashiers", async () => {
    const orderId = await placeOrder("+998940000060", 1);

    const foreign = await request(app)
      .post("/api/finance/payments-import/validate")
      .set(auth(otherSeller.accessToken))
      .send({ rows: [{ orderRef: orderId, amount: 1000 }, { phone: "940000060", amount: 1000 }] });
    expect(foreign.status).toBe(200);
    expect(foreign.body.rows[0].errorCode).toBe("ORDER_NOT_FOUND");
    expect(foreign.body.rows[1].errorCode).toBe("CUSTOMER_NOT_FOUND");

    const foreignRegister = (await request(app).get("/api/cash-registers").set(auth(otherSeller.accessToken))).body.items[0].id;
    const wrongRegister = await request(app)
      .post("/api/finance/payments-import/commit")
      .set(auth())
      .send({ rows: [{ orderRef: orderId, amount: 1000 }], cashRegisterId: foreignRegister });
    expect(wrongRegister.status).toBe(404);

    const unauthenticated = await request(app).post("/api/finance/payments-import/validate").send({ rows: [{ orderRef: orderId, amount: 1 }] });
    expect(unauthenticated.status).toBe(401);
  });

  it("rejects files that aren't spreadsheets or hold no rows", async () => {
    const garbage = await request(app)
      .post("/api/finance/payments-import/parse")
      .set(auth())
      .attach("file", Buffer.from("not a spreadsheet"), "payments.xlsx");
    expect(garbage.status).toBe(400);
    expect(garbage.body.error.code).toBe("INVALID_FILE");

    const empty = await request(app)
      .post("/api/finance/payments-import/parse")
      .set(auth())
      .attach("file", await buildSheet([]), "payments.xlsx");
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe("EMPTY_FILE");

    const noFile = await request(app).post("/api/finance/payments-import/parse").set(auth());
    expect(noFile.status).toBe(400);
  });
});
