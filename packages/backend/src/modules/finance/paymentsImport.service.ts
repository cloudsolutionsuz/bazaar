import ExcelJS from "exceljs";
import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { AppError } from "../../middleware/errorHandler";
import { toUzPhone } from "../../utils/phone";
import { cellText } from "../../utils/excelCell";
import type { PaymentImportRowInput } from "./finance.schema";

// Bulk "money in" from a spreadsheet. A row names who paid - by order ID,
// by phone, or both - and how much. Nothing here invents debt: a customer
// owes exactly the PENDING income transactions their orders created (see
// orders.service.ts), and a payment either settles one of those in full
// (-> CONFIRMED, same as the manual "confirm" button) or, when it's less
// than what's owed, splits it: the paid part becomes its own CONFIRMED
// transaction and the pending one shrinks by that much. Customer balances
// (customers.service.ts) are derived from CONFIRMED income, so they follow.

export const MAX_IMPORT_ROWS = 1000;
const SALE_CATEGORY = "Продажа";
const DEFAULT_DESCRIPTION = "Excel import";
const CLOSED_ORDER_STATUSES: OrderStatus[] = ["CANCELLED", "REFUNDED"];
// A full UUID, or the short "#1a2b3c4d" prefix the admin and storefront show.
const ORDER_REF_PATTERN = /^[0-9a-f-]{6,36}$/;
const FULL_UUID_LENGTH = 36;
// Long imports confirm rows one by one inside a single transaction.
const COMMIT_TIMEOUT_MS = 120_000;

export type PaymentRowError =
  | "MISSING_IDENTIFIER"
  | "INVALID_PHONE"
  | "INVALID_ORDER_REF"
  | "INVALID_AMOUNT"
  | "ORDER_NOT_FOUND"
  | "ORDER_AMBIGUOUS"
  | "ORDER_CLOSED"
  | "PHONE_MISMATCH"
  | "CUSTOMER_NOT_FOUND"
  | "NO_DEBT"
  | "OVERPAID";

interface Allocation {
  transactionId: string;
  orderId: string | null;
  amount: number;
  // What the pending transaction held just before this allocation - doubles
  // as the optimistic-lock value when the payment is committed.
  pendingBefore: number;
}

export interface PlannedPaymentRow {
  phone: string;
  orderRef: string;
  amount: number | null;
  description: string;
  status: "ok" | "error";
  errorCode: PaymentRowError | null;
  customerName: string | null;
  customerPhone: string | null;
  orderIds: string[];
  debtBefore: number | null;
  debtAfter: number | null;
  allocations: Allocation[];
}

type Db = Prisma.TransactionClient | typeof prisma;

interface OrderRef {
  id: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  additionalPhones: string[];
  status: OrderStatus;
}

interface PendingDebt {
  id: string;
  orderId: string | null;
  customerId: string | null;
  remaining: number;
}

function normalizeOrderRef(raw: string): string {
  return raw.trim().replace(/^#/, "").toLowerCase();
}

async function loadOrders(db: Db, tenantId: string, refs: string[]): Promise<OrderRef[]> {
  if (refs.length === 0) return [];
  const fullIds = refs.filter((ref) => ref.length === FULL_UUID_LENGTH);
  const prefixes = refs.filter((ref) => ref.length < FULL_UUID_LENGTH);
  return db.order.findMany({
    where: {
      tenantId,
      OR: [...(fullIds.length > 0 ? [{ id: { in: fullIds } }] : []), ...prefixes.map((prefix) => ({ id: { startsWith: prefix } }))],
    },
    select: { id: true, customerId: true, customerName: true, customerPhone: true, additionalPhones: true, status: true },
  });
}

function errorRow(base: PlannedPaymentRow, errorCode: PaymentRowError, extra: Partial<PlannedPaymentRow> = {}): PlannedPaymentRow {
  return { ...base, ...extra, status: "error", errorCode };
}

// Takes `amount` out of the given debts, oldest first. Mutates `remaining`
// on purpose: later rows of the same file must see what earlier rows used up.
function allocate(debts: PendingDebt[], amount: number): Allocation[] {
  const allocations: Allocation[] = [];
  let left = amount;
  for (const debt of debts) {
    if (left === 0) break;
    if (debt.remaining === 0) continue;
    const take = Math.min(debt.remaining, left);
    allocations.push({ transactionId: debt.id, orderId: debt.orderId, amount: take, pendingBefore: debt.remaining });
    debt.remaining -= take;
    left -= take;
  }
  return allocations;
}

// Validates every row and works out which pending transactions each payment
// would settle, without writing anything. Rows are processed in file order
// against one shared view of the debts, so two rows paying the same order
// can't both spend the same sum.
export async function planPayments(db: Db, tenantId: string, rows: PaymentImportRowInput[]): Promise<PlannedPaymentRow[]> {
  const prepared = rows.map((row) => {
    const phoneRaw = (row.phone ?? "").trim();
    const orderRef = normalizeOrderRef(row.orderRef ?? "");
    return {
      phoneRaw,
      phone: phoneRaw ? toUzPhone(phoneRaw) : null,
      orderRef,
      amount: row.amount ?? null,
      description: (row.description ?? "").trim(),
    };
  });

  const validRefs = [...new Set(prepared.map((p) => p.orderRef).filter((ref) => ORDER_REF_PATTERN.test(ref)))];
  const phones = [...new Set(prepared.map((p) => p.phone).filter((phone): phone is string => phone !== null))];

  const [orders, customers] = await Promise.all([
    loadOrders(db, tenantId, validRefs),
    phones.length > 0
      ? db.customer.findMany({ where: { tenantId, phone: { in: phones } }, select: { id: true, name: true, phone: true } })
      : [],
  ]);
  const customerByPhone = new Map(customers.map((c) => [c.phone, c]));

  const orderIds = orders.map((o) => o.id);
  const customerIds = customers.map((c) => c.id);
  const pending =
    orderIds.length > 0 || customerIds.length > 0
      ? await db.transaction.findMany({
          where: {
            tenantId,
            type: "INCOME",
            status: "PENDING",
            OR: [
              ...(orderIds.length > 0 ? [{ orderId: { in: orderIds } }] : []),
              ...(customerIds.length > 0 ? [{ customerId: { in: customerIds } }] : []),
            ],
          },
          select: { id: true, orderId: true, customerId: true, amount: true },
          orderBy: { createdAt: "asc" },
        })
      : [];
  const debts: PendingDebt[] = pending.map((t) => ({ id: t.id, orderId: t.orderId, customerId: t.customerId, remaining: t.amount }));

  return prepared.map((p) => {
    const base: PlannedPaymentRow = {
      phone: p.phoneRaw,
      orderRef: p.orderRef,
      amount: p.amount,
      description: p.description,
      status: "ok",
      errorCode: null,
      customerName: null,
      customerPhone: null,
      orderIds: [],
      debtBefore: null,
      debtAfter: null,
      allocations: [],
    };

    if (!p.phoneRaw && !p.orderRef) return errorRow(base, "MISSING_IDENTIFIER");
    if (p.phoneRaw && !p.phone) return errorRow(base, "INVALID_PHONE");
    if (p.orderRef && !ORDER_REF_PATTERN.test(p.orderRef)) return errorRow(base, "INVALID_ORDER_REF");
    if (p.amount === null || !Number.isInteger(p.amount) || p.amount <= 0) return errorRow(base, "INVALID_AMOUNT");

    let rowDebts: PendingDebt[];
    let who: Partial<PlannedPaymentRow>;

    if (p.orderRef) {
      const matches = orders.filter((o) => (p.orderRef.length === FULL_UUID_LENGTH ? o.id === p.orderRef : o.id.startsWith(p.orderRef)));
      if (matches.length === 0) return errorRow(base, "ORDER_NOT_FOUND");
      if (matches.length > 1) return errorRow(base, "ORDER_AMBIGUOUS");
      const order = matches[0];
      who = { customerName: order.customerName, customerPhone: order.customerPhone, orderIds: [order.id] };
      if (p.phone && order.customerPhone !== p.phone && !order.additionalPhones.includes(p.phone)) {
        return errorRow(base, "PHONE_MISMATCH", who);
      }
      if (CLOSED_ORDER_STATUSES.includes(order.status)) return errorRow(base, "ORDER_CLOSED", who);
      rowDebts = debts.filter((d) => d.orderId === order.id);
    } else {
      const customer = customerByPhone.get(p.phone as string);
      if (!customer) return errorRow(base, "CUSTOMER_NOT_FOUND");
      who = { customerName: customer.name, customerPhone: customer.phone };
      rowDebts = debts.filter((d) => d.customerId === customer.id);
    }

    const debtBefore = rowDebts.reduce((sum, d) => sum + d.remaining, 0);
    const amounts = { debtBefore, debtAfter: debtBefore };
    if (debtBefore === 0) return errorRow(base, "NO_DEBT", { ...who, ...amounts });
    if (p.amount > debtBefore) return errorRow(base, "OVERPAID", { ...who, ...amounts });

    const allocations = allocate(rowDebts, p.amount);
    return {
      ...base,
      ...who,
      orderIds: who.orderIds?.length ? who.orderIds : [...new Set(allocations.map((a) => a.orderId).filter((id): id is string => id !== null))],
      debtBefore,
      debtAfter: debtBefore - p.amount,
      allocations,
    };
  });
}

// The preview the admin edits against - allocations are an internal detail.
function toPreview(row: PlannedPaymentRow) {
  const { allocations: _allocations, ...rest } = row;
  return rest;
}

export async function validatePayments(tenantId: string, rows: PaymentImportRowInput[]) {
  const planned = await planPayments(prisma, tenantId, rows);
  return { rows: planned.map(toPreview), errorCount: planned.filter((r) => r.status === "error").length };
}

export async function commitPayments(tenantId: string, userId: string, rows: PaymentImportRowInput[], cashRegisterId: string) {
  const register = await prisma.cashRegister.findFirst({ where: { id: cashRegisterId, tenantId, isActive: true } });
  if (!register) {
    throw new AppError(404, "REGISTER_NOT_FOUND", "Cash register not found or inactive");
  }

  return prisma.$transaction(
    async (tx) => {
      // Re-planned inside the transaction: the preview the admin saw may be
      // stale by now (someone confirmed a payment by hand in the meantime).
      const planned = await planPayments(tx, tenantId, rows);
      if (planned.some((row) => row.status === "error")) {
        throw new AppError(400, "IMPORT_HAS_ERRORS", "Some rows have errors; fix them and try again");
      }

      for (const row of planned) {
        for (const allocation of row.allocations) {
          const settlesInFull = allocation.amount === allocation.pendingBefore;
          // Matching on the amount we planned against makes a concurrent
          // change to this transaction fail the import instead of being
          // silently overwritten.
          const guard = { id: allocation.transactionId, tenantId, status: "PENDING" as const, amount: allocation.pendingBefore };
          const updated = settlesInFull
            ? await tx.transaction.updateMany({
                where: guard,
                // Keep the note typed for this payment; without one the row stays as it was.
                data: { status: "CONFIRMED", cashRegisterId, ...(row.description ? { description: row.description } : {}) },
              })
            : await tx.transaction.updateMany({ where: guard, data: { amount: { decrement: allocation.amount } } });
          if (updated.count !== 1) {
            throw new AppError(409, "IMPORT_CONFLICT", "Payments changed while importing; check the rows and try again");
          }

          if (!settlesInFull) {
            const source = await tx.transaction.findUniqueOrThrow({
              where: { id: allocation.transactionId },
              select: { orderId: true, customerId: true },
            });
            await tx.transaction.create({
              data: {
                tenantId,
                type: "INCOME",
                status: "CONFIRMED",
                category: SALE_CATEGORY,
                amount: allocation.amount,
                description: row.description || DEFAULT_DESCRIPTION,
                orderId: source.orderId,
                customerId: source.customerId,
                cashRegisterId,
                createdByUserId: userId,
              },
            });
          }
        }
      }

      return {
        imported: planned.length,
        totalAmount: planned.reduce((sum, row) => sum + (row.amount ?? 0), 0),
      };
    },
    { timeout: COMMIT_TIMEOUT_MS },
  );
}

const TEMPLATE_HEADERS = ["Telefon", "Buyurtma ID", "Summa", "Izoh"];

// Header aliases so a sheet typed up by hand in any of the three languages
// still imports; anything unrecognized falls back to the template's order.
const HEADER_ALIASES: Record<keyof PaymentImportRowInput, string[]> = {
  phone: ["telefon", "phone", "телефон", "telefon raqam", "telefon raqami"],
  orderRef: ["buyurtma id", "buyurtma", "order id", "order", "заказ", "id заказа", "id"],
  amount: ["summa", "amount", "сумма"],
  description: ["izoh", "description", "комментарий", "примечание"],
};

export async function buildPaymentsTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("To'lovlar");
  sheet.addRow(TEMPLATE_HEADERS).font = { bold: true };
  sheet.addRow(["901234567", "1a2b3c4d", 150000, "Namuna - o'chirib tashlang"]);
  // Text format keeps Excel from turning phones/IDs into numbers (dropping
  // leading zeros or switching to 1.2E+11 notation).
  sheet.getColumn(1).numFmt = "@";
  sheet.getColumn(2).numFmt = "@";
  sheet.columns.forEach((col) => {
    col.width = 28;
  });

  const notes = workbook.addWorksheet("Izohlar");
  notes.addRow(["Ustun", "Majburiy", "Tavsif"]).font = { bold: true };
  notes.addRow(["Telefon", "Telefon yoki Buyurtma ID dan biri", "Mijozning telefon raqami: 9 ta raqam (901234567) yoki 998 bilan"]);
  notes.addRow(["Buyurtma ID", "Telefon yoki Buyurtma ID dan biri", "Buyurtma raqami: buyurtmalar ro'yxatidagi #1a2b3c4d ko'rinishidagi ID"]);
  notes.addRow(["Summa", "ha", "To'langan summa, butun son (masalan 150000). Qarzdan ko'p bo'lmasligi kerak"]);
  notes.addRow(["Izoh", "yo'q", "Ixtiyoriy izoh"]);
  notes.addRow([]);
  notes.addRow(["Faqat telefon ko'rsatilsa, pul mijozning eng eski qarzlaridan boshlab yopiladi."]);
  notes.columns.forEach((col) => {
    col.width = 40;
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

// "150 000", "150,000.00" and 150000 all mean the same sum. Deliberately
// strict beyond that: a value that could be read two ways ("150.000",
// "1,50") comes back null and is reported as INVALID_AMOUNT for a human to
// fix, rather than being guessed into the wrong amount of money.
function cellAmount(value: unknown): number | null {
  const text = cellText(value);
  if (!text) return null;
  const compact = text.replace(/[\s\u00a0']/g, "").replace(/[.,]0{1,2}$/, "");
  const digits = /^\d{1,3}(,\d{3})+$/.test(compact) ? compact.replace(/,/g, "") : compact;
  if (!/^\d+$/.test(digits)) return null;
  const amount = Number(digits);
  return Number.isSafeInteger(amount) ? amount : null;
}

export async function parsePaymentsFile(buffer: Buffer): Promise<PaymentImportRowInput[]> {
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
  const column = (field: keyof PaymentImportRowInput, fallback: number): number => {
    const found = headers.findIndex((h) => h !== "" && HEADER_ALIASES[field].includes(h));
    return found === -1 ? fallback : found;
  };
  const columns = { phone: column("phone", 1), orderRef: column("orderRef", 2), amount: column("amount", 3), description: column("description", 4) };

  const rows: PaymentImportRowInput[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const values = sheet.getRow(rowNumber).values as unknown[];
    if (!values || values.length === 0) continue;

    const phone = cellText(values[columns.phone]);
    const orderRef = cellText(values[columns.orderRef]);
    const amountText = cellText(values[columns.amount]);
    if (!phone && !orderRef && !amountText) continue; // blank line

    rows.push({
      phone: phone.slice(0, 40),
      orderRef: orderRef.slice(0, 64),
      amount: cellAmount(values[columns.amount]),
      description: cellText(values[columns.description]).slice(0, 500),
    });
    if (rows.length > MAX_IMPORT_ROWS) {
      throw new AppError(400, "TOO_MANY_ROWS", `A single import can hold at most ${MAX_IMPORT_ROWS} rows`);
    }
  }

  if (rows.length === 0) {
    throw new AppError(400, "EMPTY_FILE", "No payment rows found in the file");
  }
  return rows;
}
