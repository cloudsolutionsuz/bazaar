import ExcelJS from "exceljs";
import { AppError } from "../../middleware/errorHandler";
import { cellText } from "../../utils/excelCell";
import { createAgentSchema } from "./agents.schema";
import { createAgent, listAgents } from "./agents.service";

const MAX_IMPORT_ROWS = 500;

// The import template's columns, in order. `aliases` lets a sheet typed up
// by hand (or exported from here and edited) still be recognized.
const COLUMNS = [
  { field: "fullName", header: "F.I.O", aliases: ["f.i.o", "fio", "f.i.sh", "ism", "фио", "ф.и.о", "full name", "name"] },
  { field: "phone", header: "Telefon", aliases: ["telefon", "telefon raqam", "phone", "телефон"] },
  { field: "telegram", header: "Telegram", aliases: ["telegram"] },
  { field: "instagram", header: "Instagram", aliases: ["instagram"] },
  { field: "youtube", header: "YouTube", aliases: ["youtube"] },
  { field: "tiktok", header: "TikTok", aliases: ["tiktok", "tik-tok", "tik tok"] },
  { field: "login", header: "Login", aliases: ["login", "логин"] },
  { field: "password", header: "Parol", aliases: ["parol", "password", "пароль"] },
  { field: "bonusType", header: "Bonus turi", aliases: ["bonus turi", "bonus type", "тип бонуса"] },
  { field: "bonusValue", header: "Bonus", aliases: ["bonus", "bonus miqdori", "бонус"] },
] as const;

type ImportField = (typeof COLUMNS)[number]["field"];

const PERCENT_WORDS = ["%", "foiz", "foizda", "percent", "процент", "проц"];
const FIXED_WORDS = ["summa", "summada", "so'm", "som", "sum", "fixed", "сумма", "сум"];

// "%" / "foiz" -> PERCENT, "summa" / "so'm" -> FIXED. Empty means percent,
// the usual way a bonus is given; anything unrecognized is left as typed so
// validation reports it instead of a bonus type being silently guessed.
function parseBonusType(raw: string): string {
  const text = raw.toLowerCase();
  if (text === "" || PERCENT_WORDS.some((word) => text.includes(word))) return "PERCENT";
  if (FIXED_WORDS.some((word) => text.includes(word))) return "FIXED";
  return raw;
}

function parseBonusValue(raw: string): number {
  const digits = raw.replace(/[\s%]/g, "");
  return /^\d+$/.test(digits) ? Number(digits) : Number.NaN;
}

export async function exportAgentsToExcel(tenantId: string): Promise<Buffer> {
  const agents = await listAgents(tenantId);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Agentlar");
  sheet.addRow([
    "F.I.O",
    "Telefon",
    "Telegram",
    "Instagram",
    "YouTube",
    "TikTok",
    "Login",
    "Havola",
    "Bonus turi",
    "Bonus",
    "Buyurtmalar soni",
    "Buyurtmalar summasi",
    "Hisoblangan bonus",
    "To'langan bonus",
    "To'lanadigan bonus",
    "Holati",
  ]).font = { bold: true };

  for (const agent of agents) {
    sheet.addRow([
      agent.fullName,
      `+${agent.phone}`,
      agent.telegram ?? "",
      agent.instagram ?? "",
      agent.youtube ?? "",
      agent.tiktok ?? "",
      agent.login,
      agent.link,
      agent.bonusType === "PERCENT" ? "%" : "summa",
      agent.bonusValue,
      agent.orderCount,
      agent.ordersAmount,
      agent.bonusAccrued,
      agent.bonusPaid,
      agent.bonusBalance,
      agent.isActive ? "Faol" : "Faol emas",
    ]);
  }
  sheet.columns.forEach((col) => {
    col.width = 22;
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function buildAgentsImportTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Agentlar");
  sheet.addRow(COLUMNS.map((c) => c.header)).font = { bold: true };
  sheet.addRow(["Aliyev Vali Karimovich", "901234567", "@vali", "https://instagram.com/vali", "", "", "vali.agent", "parol123", "%", 5]);
  sheet.columns.forEach((col) => {
    col.width = 24;
    // Text format keeps Excel from mangling phones, logins and passwords
    // (dropped leading zeros, 1.2E+11 notation).
    col.numFmt = "@";
  });

  const notes = workbook.addWorksheet("Izohlar");
  notes.addRow(["Ustun", "Majburiy", "Tavsif"]).font = { bold: true };
  notes.addRow(["F.I.O", "ha", "Agentning to'liq ismi"]);
  notes.addRow(["Telefon", "ha", "9 ta raqam (901234567) yoki 998 bilan"]);
  notes.addRow(["Telegram / Instagram / YouTube / TikTok", "yo'q", "Sahifa havolasi yoki @username"]);
  notes.addRow(["Login", "ha", "3-50 ta belgi: lotin harflari, raqamlar, nuqta, chiziqcha. Takrorlanmasligi kerak"]);
  notes.addRow(["Parol", "ha", "Kamida 6 ta belgi"]);
  notes.addRow(["Bonus turi", "yo'q", "% (foizda) yoki summa (so'mda). Bo'sh bo'lsa - %"]);
  notes.addRow(["Bonus", "ha", "Foiz bo'lsa 0-100, summa bo'lsa so'mda butun son"]);
  notes.addRow([]);
  notes.addRow(["Namuna qatorini (2-qator) o'chirib, o'z agentlaringizni kiriting. Havola har bir agentga avtomatik yaratiladi."]);
  notes.columns.forEach((col) => {
    col.width = 44;
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export interface AgentImportError {
  row: number;
  // Which column was wrong (null when the whole row is the problem).
  field: ImportField | null;
  code: "INVALID" | "LOGIN_TAKEN" | "DUPLICATE_LOGIN" | "FAILED";
}

export interface AgentImportResult {
  created: number;
  errors: AgentImportError[];
}

// Rows are independent: every valid row becomes an agent, every bad one is
// reported with its sheet row number so it can be fixed and uploaded again
// (re-uploading the rows that already went in fails on LOGIN_TAKEN rather
// than creating duplicates).
export async function importAgentsFromExcel(tenantId: string, buffer: Buffer): Promise<AgentImportResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    // exceljs's bundled types lag behind current @types/node Buffer generics.
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch {
    throw new AppError(400, "INVALID_FILE", "The file is not a valid .xlsx spreadsheet");
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new AppError(400, "INVALID_FILE", "No worksheet found in the uploaded file");
  }

  // row.values is 1-based (index 0 is always empty), matching column numbers.
  const headers = (sheet.getRow(1).values as unknown[]).map((h) => cellText(h).toLowerCase());
  const found = COLUMNS.map((column) => headers.findIndex((h) => h !== "" && (column.aliases as readonly string[]).includes(h)));
  // A sheet with recognizable headers is read by name, and a column it
  // doesn't have is simply empty. Only a sheet with no recognizable header
  // at all is read by the template's column positions.
  const byPosition = found.every((index) => index === -1);
  const columnOf = new Map<ImportField, number>();
  COLUMNS.forEach((column, index) => {
    columnOf.set(column.field, byPosition ? index + 1 : found[index]);
  });

  const result: AgentImportResult = { created: 0, errors: [] };
  const loginsInFile = new Set<string>();
  let dataRows = 0;

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const values = sheet.getRow(rowNumber).values as unknown[];
    if (!values || values.length === 0) continue;
    const read = (field: ImportField) => {
      const index = columnOf.get(field) as number;
      return index === -1 ? "" : cellText(values[index]);
    };
    if (COLUMNS.every((column) => read(column.field) === "")) continue; // blank line

    dataRows += 1;
    if (dataRows > MAX_IMPORT_ROWS) {
      throw new AppError(400, "TOO_MANY_ROWS", `A single import can hold at most ${MAX_IMPORT_ROWS} agents`);
    }

    const parsed = createAgentSchema.safeParse({
      fullName: read("fullName"),
      phone: read("phone"),
      telegram: read("telegram") || null,
      instagram: read("instagram") || null,
      youtube: read("youtube") || null,
      tiktok: read("tiktok") || null,
      login: read("login"),
      password: read("password"),
      bonusType: parseBonusType(read("bonusType")),
      bonusValue: parseBonusValue(read("bonusValue")),
    });
    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path[0];
      const known = COLUMNS.some((column) => column.field === field);
      result.errors.push({ row: rowNumber, field: known ? (field as ImportField) : null, code: "INVALID" });
      continue;
    }

    if (loginsInFile.has(parsed.data.login)) {
      result.errors.push({ row: rowNumber, field: "login", code: "DUPLICATE_LOGIN" });
      continue;
    }
    loginsInFile.add(parsed.data.login);

    try {
      await createAgent(tenantId, parsed.data);
      result.created += 1;
    } catch (err) {
      const taken = err instanceof AppError && err.code === "LOGIN_TAKEN";
      result.errors.push({ row: rowNumber, field: taken ? "login" : null, code: taken ? "LOGIN_TAKEN" : "FAILED" });
    }
  }

  if (dataRows === 0) {
    throw new AppError(400, "EMPTY_FILE", "No agent rows found in the file");
  }
  return result;
}
