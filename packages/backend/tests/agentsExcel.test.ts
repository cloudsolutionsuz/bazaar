import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import ExcelJS from "exceljs";
import { createApp } from "../src/app";
import { prisma } from "../src/db/prisma";
import { registerAndLoginSeller, type TestSeller } from "./helpers/registerTenant";
import { deleteTenantCompletely } from "./helpers/cleanupTenant";

const describeWithDb = process.env.SKIP_DB_TESTS ? describe.skip : describe;

const TEMPLATE_HEADERS = ["F.I.O", "Telefon", "Telegram", "Instagram", "YouTube", "TikTok", "Login", "Parol", "Bonus turi", "Bonus"];

async function buildSheet(rows: unknown[][], headers: string[] = TEMPLATE_HEADERS): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Agentlar");
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function binary(req: request.Test) {
  return req.buffer(true).parse((res, callback) => {
    const chunks: Buffer[] = [];
    res.on("data", (chunk: Buffer) => chunks.push(chunk));
    res.on("end", () => callback(null, Buffer.concat(chunks)));
  });
}

describeWithDb("agents Excel import/export (integration)", () => {
  const app = createApp();
  let seller: TestSeller;
  let otherSeller: TestSeller;
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

  function auth(token = seller.accessToken) {
    return { Authorization: `Bearer ${token}` };
  }

  function upload(file: Buffer, token = seller.accessToken) {
    return request(app).post("/api/agents/import").set(auth(token)).attach("file", file, "agentlar.xlsx");
  }

  beforeAll(async () => {
    seller = await registerAndLoginSeller(app);
    otherSeller = await registerAndLoginSeller(app);
  });

  afterAll(async () => {
    await deleteTenantCompletely(seller.tenantId);
    await deleteTenantCompletely(otherSeller.tenantId);
    await prisma.$disconnect();
  });

  it("serves a template whose sample row imports as-is", async () => {
    const template = await binary(request(app).get("/api/agents/import-template").set(auth(otherSeller.accessToken)));
    expect(template.status).toBe(200);
    expect(template.headers["content-type"]).toContain("spreadsheetml");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(template.body as Buffer);
    expect((workbook.worksheets[0].getRow(1).values as unknown[]).slice(1)).toEqual(TEMPLATE_HEADERS);
  });

  it("creates an agent per valid row and reports every bad row with its Excel row number", async () => {
    const file = await buildSheet([
      ["Aliyev Vali", "901110001", "@vali", "https://instagram.com/vali", "", "", `Imp.A.${suffix}`, "parol123", "%", 5],
      ["Karimov Anvar", 998901110002, "", "", "", "", `imp.b.${suffix}`, "parol123", "summa", "7 000"],
      ["Default Percent", "+998 90 111 00 03", "", "", "", "", `imp.c.${suffix}`, "parol123", "", 10],
      [],
      ["Bad Phone", "12345", "", "", "", "", `imp.d.${suffix}`, "parol123", "%", 5],
      ["Short Pass", "901110005", "", "", "", "", `imp.e.${suffix}`, "123", "%", 5],
      ["Over Percent", "901110006", "", "", "", "", `imp.f.${suffix}`, "parol123", "%", 150],
      ["Bad Type", "901110007", "", "", "", "", `imp.g.${suffix}`, "parol123", "tovar", 5],
      ["Dup In File", "901110008", "", "", "", "", `imp.a.${suffix}`, "parol123", "%", 5],
      ["", "901110009", "", "", "", "", `imp.h.${suffix}`, "parol123", "%", 5],
      ["Bad Login", "901110010", "", "", "", "", "has space", "parol123", "%", 5],
    ]);

    const res = await upload(file);
    expect(res.status).toBe(200);
    expect(res.body.created).toBe(3);
    expect(res.body.errors).toEqual([
      { row: 6, field: "phone", code: "INVALID" },
      { row: 7, field: "password", code: "INVALID" },
      { row: 8, field: "bonusValue", code: "INVALID" },
      { row: 9, field: "bonusType", code: "INVALID" },
      { row: 10, field: "login", code: "DUPLICATE_LOGIN" },
      { row: 11, field: "fullName", code: "INVALID" },
      { row: 12, field: "login", code: "INVALID" },
    ]);

    const list = await request(app).get("/api/agents").set(auth());
    const byLogin = new Map(list.body.agents.map((a: { login: string }) => [a.login, a]));
    expect(byLogin.size).toBe(3);
    expect(byLogin.get(`imp.a.${suffix}`)).toMatchObject({ fullName: "Aliyev Vali", phone: "998901110001", telegram: "@vali", bonusType: "PERCENT", bonusValue: 5 });
    expect(byLogin.get(`imp.b.${suffix}`)).toMatchObject({ phone: "998901110002", bonusType: "FIXED", bonusValue: 7000 });
    expect(byLogin.get(`imp.c.${suffix}`)).toMatchObject({ phone: "998901110003", bonusType: "PERCENT", bonusValue: 10 });
    expect((byLogin.get(`imp.a.${suffix}`) as { link: string }).link).toContain("?ref=");

    // An imported agent can log in with the password from the sheet.
    const login = await request(app).post("/api/auth/login").send({ email: `imp.a.${suffix}`, password: "parol123" });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe("AGENT");
  });

  it("does not duplicate agents when the same file is uploaded again", async () => {
    const file = await buildSheet([["Aliyev Vali", "901110001", "", "", "", "", `imp.a.${suffix}`, "parol123", "%", 5]]);
    const res = await upload(file);
    expect(res.body).toEqual({ created: 0, errors: [{ row: 2, field: "login", code: "LOGIN_TAKEN" }] });
    expect(await prisma.agent.count({ where: { tenantId: seller.tenantId } })).toBe(3);
  });

  it("reads columns by header name, whatever their order", async () => {
    const file = await buildSheet([[`imp.z.${suffix}`, "parol123", 3, "Reordered Agent", "901110020"]], ["Login", "Parol", "Bonus", "F.I.O", "Telefon"]);
    const res = await upload(file);
    expect(res.body).toEqual({ created: 1, errors: [] });
    const agent = await prisma.agent.findFirstOrThrow({ where: { tenantId: seller.tenantId, fullName: "Reordered Agent" } });
    expect(agent).toMatchObject({ phone: "998901110020", bonusType: "PERCENT", bonusValue: 3 });
  });

  it("exports the shop's agents - and only that shop's - to Excel", async () => {
    const res = await binary(request(app).get("/api/agents/export").set(auth()));
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("spreadsheetml");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(res.body as Buffer);
    const sheet = workbook.worksheets[0];
    expect(sheet.rowCount).toBe(1 + 4);
    const logins = [2, 3, 4, 5].map((n) => String(sheet.getRow(n).getCell(7).value));
    expect(logins).toContain(`imp.a.${suffix}`);
    // The export never carries passwords.
    expect((sheet.getRow(1).values as unknown[]).map(String)).not.toContain("Parol");

    const foreign = await binary(request(app).get("/api/agents/export").set(auth(otherSeller.accessToken)));
    const foreignBook = new ExcelJS.Workbook();
    await foreignBook.xlsx.load(foreign.body as Buffer);
    expect(foreignBook.worksheets[0].rowCount).toBe(1);
  });

  it("rejects non-spreadsheets, empty sheets and agent logins", async () => {
    const garbage = await upload(Buffer.from("not a spreadsheet"));
    expect(garbage.status).toBe(400);
    expect(garbage.body.error.code).toBe("INVALID_FILE");

    const empty = await upload(await buildSheet([]));
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe("EMPTY_FILE");

    const noFile = await request(app).post("/api/agents/import").set(auth());
    expect(noFile.status).toBe(400);

    const agentLogin = await request(app).post("/api/auth/login").send({ email: `imp.a.${suffix}`, password: "parol123" });
    const agentToken = agentLogin.body.accessToken;
    expect((await request(app).get("/api/agents/export").set(auth(agentToken))).status).toBe(403);
    expect((await upload(await buildSheet([]), agentToken)).status).toBe(403);
  });
});
