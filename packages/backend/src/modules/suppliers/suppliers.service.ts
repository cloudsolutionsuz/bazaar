import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { AppError } from "../../middleware/errorHandler";
import * as financeService from "../finance/finance.service";
import type {
  CreateSupplierInput,
  CreateSupplierPaymentInput,
  ListSuppliersQuery,
  SupplierStatementQuery,
  UpdateSupplierInput,
} from "./suppliers.schema";

// Debt owed to a supplier is never stored - it's replayed from receipts
// (debit) minus supplier returns and payments (credit), the same
// "don't store derived numbers" convention as Kassa's balance and the
// inventory stock report. quantity*purchasePrice can't be done as a DB-level
// sum (Prisma aggregates can't multiply two columns), so this fetches the raw
// rows and reduces in JS - the same approach computeFifoCogs/getPnL already
// use for the same reason.
async function computeSupplierBalances(tenantId: string, supplierIds: string[]): Promise<Map<string, number>> {
  const balances = new Map<string, number>();
  if (supplierIds.length === 0) return balances;

  const [movements, payments] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where: { tenantId, supplierId: { in: supplierIds }, type: { in: ["RECEIPT", "SUPPLIER_RETURN"] } },
      select: { supplierId: true, type: true, quantity: true, purchasePrice: true },
    }),
    prisma.transaction.findMany({
      where: { tenantId, supplierId: { in: supplierIds }, type: "EXPENSE", status: "CONFIRMED" },
      select: { supplierId: true, amount: true },
    }),
  ]);

  for (const m of movements) {
    if (!m.supplierId) continue;
    const cost = Math.abs(m.quantity) * (m.purchasePrice ?? 0);
    const delta = m.type === "RECEIPT" ? cost : -cost;
    balances.set(m.supplierId, (balances.get(m.supplierId) ?? 0) + delta);
  }
  for (const p of payments) {
    if (!p.supplierId) continue;
    balances.set(p.supplierId, (balances.get(p.supplierId) ?? 0) - p.amount);
  }

  return balances;
}

export async function listSuppliers(tenantId: string, query: ListSuppliersQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  const where: Prisma.SupplierWhereInput = {
    tenantId,
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { phone: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({ where, orderBy: { name: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.supplier.count({ where }),
  ]);

  const balances = await computeSupplierBalances(tenantId, suppliers.map((s) => s.id));
  const items = suppliers.map((s) => ({ ...s, balance: balances.get(s.id) ?? 0 }));

  return { items, total, page, pageSize };
}

export function createSupplier(tenantId: string, input: CreateSupplierInput) {
  return prisma.supplier.create({ data: { tenantId, ...input } });
}

async function getSupplierOrThrow(tenantId: string, supplierId: string) {
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, tenantId } });
  if (!supplier) {
    throw new AppError(404, "NOT_FOUND", "Supplier not found");
  }
  return supplier;
}

export async function updateSupplier(tenantId: string, supplierId: string, input: UpdateSupplierInput) {
  await getSupplierOrThrow(tenantId, supplierId);
  return prisma.supplier.update({ where: { id: supplierId }, data: input });
}

export async function deleteSupplier(tenantId: string, supplierId: string): Promise<void> {
  await getSupplierOrThrow(tenantId, supplierId);

  const [movementCount, paymentCount] = await Promise.all([
    prisma.inventoryMovement.count({ where: { supplierId } }),
    prisma.transaction.count({ where: { supplierId } }),
  ]);
  if (movementCount > 0 || paymentCount > 0) {
    throw new AppError(409, "SUPPLIER_HAS_MOVEMENTS", "Cannot delete a supplier referenced by existing receipts, returns, or payments");
  }

  await prisma.supplier.delete({ where: { id: supplierId } });
}

interface StatementEntry {
  date: Date;
  type: "RECEIPT" | "SUPPLIER_RETURN" | "PAYMENT";
  description: string;
  debit: number;
  credit: number;
}

async function buildSupplierLedger(tenantId: string, supplierId: string): Promise<StatementEntry[]> {
  const [movements, payments] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where: { tenantId, supplierId, type: { in: ["RECEIPT", "SUPPLIER_RETURN"] } },
      include: { variant: { include: { product: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.transaction.findMany({
      where: { tenantId, supplierId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const entries: StatementEntry[] = movements.map((m) => {
    const cost = Math.abs(m.quantity) * (m.purchasePrice ?? 0);
    const description = `${m.variant.product.name} × ${Math.abs(m.quantity)}${m.note ? ` (${m.note})` : ""}`;
    return m.type === "RECEIPT"
      ? { date: m.createdAt, type: "RECEIPT", description, debit: cost, credit: 0 }
      : { date: m.createdAt, type: "SUPPLIER_RETURN", description, debit: 0, credit: cost };
  });

  for (const p of payments) {
    entries.push({
      date: p.createdAt,
      type: "PAYMENT",
      description: p.description ?? p.category,
      debit: 0,
      credit: p.amount,
    });
  }

  entries.sort((a, b) => a.date.getTime() - b.date.getTime());
  return entries;
}

// "Акт сверки" - opening balance (everything before `from`, 0 if `from` is
// omitted) plus a chronological ledger for the requested range, each entry
// carrying the running balance after it - the same before-range-aggregate +
// in-range-replay pattern as the inventory daily report and Kassa's daily
// summary.
export async function getSupplierStatement(tenantId: string, supplierId: string, query: SupplierStatementQuery) {
  const supplier = await getSupplierOrThrow(tenantId, supplierId);
  const ledger = await buildSupplierLedger(tenantId, supplierId);

  let openingBalance = 0;
  const inRange: StatementEntry[] = [];
  for (const entry of ledger) {
    const beforeRange = query.from && entry.date < query.from;
    const afterRange = query.to && entry.date > query.to;
    if (beforeRange) {
      openingBalance += entry.debit - entry.credit;
    } else if (!afterRange) {
      inRange.push(entry);
    }
  }

  let running = openingBalance;
  const entries = inRange.map((entry) => {
    running += entry.debit - entry.credit;
    return { ...entry, balanceAfter: running };
  });

  return { supplier, openingBalance, entries, closingBalance: running };
}

export async function createSupplierPayment(tenantId: string, userId: string, supplierId: string, input: CreateSupplierPaymentInput) {
  await getSupplierOrThrow(tenantId, supplierId);

  return financeService.createTransaction(tenantId, userId, {
    type: "EXPENSE",
    category: "Оплата поставщику",
    amount: input.amount,
    description: input.description,
    cashRegisterId: input.cashRegisterId,
    supplierId,
  });
}

export async function exportSupplierStatementToExcel(
  tenantId: string,
  supplierId: string,
  query: SupplierStatementQuery,
): Promise<Buffer> {
  const statement = await getSupplierStatement(tenantId, supplierId, query);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Statement");
  sheet.addRow([`Supplier: ${statement.supplier.name}`]);
  sheet.addRow(["Date", "Type", "Description", "Debit", "Credit", "Balance"]);
  sheet.addRow(["", "", "Opening balance", "", "", statement.openingBalance]);

  for (const entry of statement.entries) {
    sheet.addRow([entry.date.toISOString(), entry.type, entry.description, entry.debit || "", entry.credit || "", entry.balanceAfter]);
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
