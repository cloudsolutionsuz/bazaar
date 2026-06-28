import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { AppError } from "../../middleware/errorHandler";
import type {
  CreateReceiptInput,
  CreateStocktakeInput,
  CreateSupplierReturnInput,
  CreateWriteOffInput,
  DailyReportQuery,
  ListMovementsQuery,
} from "./inventory.schema";

export async function createReceipt(tenantId: string, userId: string, input: CreateReceiptInput) {
  const variant = await prisma.productVariant.findFirst({ where: { id: input.variantId, tenantId } });
  if (!variant) {
    throw new AppError(404, "NOT_FOUND", "Variant not found");
  }
  if (input.supplierId) {
    const supplier = await prisma.supplier.findFirst({ where: { id: input.supplierId, tenantId } });
    if (!supplier) {
      throw new AppError(400, "INVALID_SUPPLIER", "Supplier not found");
    }
  }

  return prisma.$transaction(async (tx) => {
    const movement = await tx.inventoryMovement.create({
      data: {
        tenantId,
        variantId: variant.id,
        type: "RECEIPT",
        quantity: input.quantity,
        purchasePrice: input.purchasePrice,
        supplierId: input.supplierId,
        note: input.note,
        createdByUserId: userId,
      },
    });

    await tx.productVariant.update({
      where: { id: variant.id },
      data: { stockQuantity: { increment: input.quantity } },
    });

    return movement;
  });
}

// "С логикой" per the user's request: a write-off must record why stock left
// (note is required, unlike a receipt's), can't exceed what's actually on
// hand, and - when a unit cost is given - books a real EXPENSE so damaged/lost
// stock shows up in Kassa/P&L instead of silently vanishing from the count.
export async function createWriteOff(tenantId: string, userId: string, input: CreateWriteOffInput) {
  const variant = await prisma.productVariant.findFirst({ where: { id: input.variantId, tenantId } });
  if (!variant) {
    throw new AppError(404, "NOT_FOUND", "Variant not found");
  }
  if (variant.stockQuantity < input.quantity) {
    throw new AppError(400, "INSUFFICIENT_STOCK", "Cannot write off more than the current stock");
  }

  return prisma.$transaction(async (tx) => {
    const movement = await tx.inventoryMovement.create({
      data: {
        tenantId,
        variantId: variant.id,
        type: "WRITE_OFF",
        quantity: -input.quantity,
        purchasePrice: input.unitCost,
        note: input.note,
        createdByUserId: userId,
      },
    });

    await tx.productVariant.update({
      where: { id: variant.id },
      data: { stockQuantity: { decrement: input.quantity } },
    });

    if (input.unitCost) {
      // No cashier is present at write-off time to pick a till, so it always
      // lands in the tenant's default register.
      const defaultRegister = await tx.cashRegister.findFirst({ where: { tenantId, isDefault: true } });
      await tx.transaction.create({
        data: {
          tenantId,
          type: "EXPENSE",
          category: "Списание",
          amount: input.quantity * input.unitCost,
          cashRegisterId: defaultRegister?.id,
          createdByUserId: userId,
        },
      });
    }

    return movement;
  });
}

// Sending stock back to a supplier - unlike a write-off, this always credits
// the supplier's debt (computed from this movement's cost by
// suppliers.service.ts), so both the supplier and a cost are required. No
// Transaction/Kassa effect here - no cash actually changes hands, only what's
// owed changes, which the supplier statement picks up directly from this
// movement.
export async function createSupplierReturn(tenantId: string, userId: string, input: CreateSupplierReturnInput) {
  const variant = await prisma.productVariant.findFirst({ where: { id: input.variantId, tenantId } });
  if (!variant) {
    throw new AppError(404, "NOT_FOUND", "Variant not found");
  }
  if (variant.stockQuantity < input.quantity) {
    throw new AppError(400, "INSUFFICIENT_STOCK", "Cannot return more than the current stock");
  }
  const supplier = await prisma.supplier.findFirst({ where: { id: input.supplierId, tenantId } });
  if (!supplier) {
    throw new AppError(400, "INVALID_SUPPLIER", "Supplier not found");
  }

  return prisma.$transaction(async (tx) => {
    const movement = await tx.inventoryMovement.create({
      data: {
        tenantId,
        variantId: variant.id,
        type: "SUPPLIER_RETURN",
        quantity: -input.quantity,
        purchasePrice: input.unitCost,
        supplierId: input.supplierId,
        note: input.note,
        createdByUserId: userId,
      },
    });

    await tx.productVariant.update({
      where: { id: variant.id },
      data: { stockQuantity: { decrement: input.quantity } },
    });

    return movement;
  });
}

// A stocktake reconciles the system count to a physical count. The movement
// is always recorded - even a zero delta - so "we checked and it matched" is
// on the record, not just discrepancies. No automatic Kassa/P&L effect: a
// miscount isn't necessarily a real financial loss the way a write-off is.
export async function createStocktake(tenantId: string, userId: string, input: CreateStocktakeInput) {
  const variant = await prisma.productVariant.findFirst({ where: { id: input.variantId, tenantId } });
  if (!variant) {
    throw new AppError(404, "NOT_FOUND", "Variant not found");
  }

  const delta = input.actualQuantity - variant.stockQuantity;

  return prisma.$transaction(async (tx) => {
    const movement = await tx.inventoryMovement.create({
      data: {
        tenantId,
        variantId: variant.id,
        type: "STOCKTAKE",
        quantity: delta,
        note: input.note,
        createdByUserId: userId,
      },
    });

    await tx.productVariant.update({
      where: { id: variant.id },
      data: { stockQuantity: input.actualQuantity },
    });

    return movement;
  });
}

export async function listMovements(tenantId: string, query: ListMovementsQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  const where: Prisma.InventoryMovementWhereInput = {
    tenantId,
    ...(query.variantId ? { variantId: query.variantId } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.from || query.to
      ? { createdAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where,
      include: { variant: { include: { product: true } }, supplier: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.inventoryMovement.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function listLowStock(tenantId: string) {
  const variants = await prisma.productVariant.findMany({
    where: { tenantId, lowStockThreshold: { not: null } },
    include: { product: true },
  });

  return variants.filter((v) => v.lowStockThreshold !== null && v.stockQuantity <= v.lowStockThreshold);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export interface DailyReportRow {
  variantId: string;
  productName: string;
  sku: string;
  openingStock: number;
  receipts: number;
  sales: number;
  writeOffs: number;
  supplierReturns: number;
  stocktakeAdjustments: number;
  closingStock: number;
  actualStock: number | null;
}

// "Остаток на начало/конец дня" + "фактический остаток" - all three are
// derived from replaying movements rather than stored columns, so the report
// works for any past date, not just "right now".
export async function getDailyReport(tenantId: string, query: DailyReportQuery): Promise<DailyReportRow[]> {
  const date = query.date ?? new Date();
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const variants = await prisma.productVariant.findMany({
    where: { tenantId },
    include: { product: true },
    orderBy: { sku: "asc" },
  });

  const openingSums = await prisma.inventoryMovement.groupBy({
    by: ["variantId"],
    where: { tenantId, createdAt: { lt: dayStart } },
    _sum: { quantity: true },
  });
  const openingByVariant = new Map(openingSums.map((s) => [s.variantId, s._sum.quantity ?? 0]));

  const todaysMovements = await prisma.inventoryMovement.findMany({
    where: { tenantId, createdAt: { gte: dayStart, lte: dayEnd } },
    orderBy: { createdAt: "asc" },
  });
  const movementsByVariant = new Map<string, typeof todaysMovements>();
  for (const m of todaysMovements) {
    const list = movementsByVariant.get(m.variantId) ?? [];
    list.push(m);
    movementsByVariant.set(m.variantId, list);
  }

  return variants.map((variant) => {
    const opening = openingByVariant.get(variant.id) ?? 0;
    const movements = movementsByVariant.get(variant.id) ?? [];

    let running = opening;
    let receipts = 0;
    let sales = 0;
    let writeOffs = 0;
    let supplierReturns = 0;
    let stocktakeAdjustments = 0;
    let actualStock: number | null = null;

    for (const m of movements) {
      running += m.quantity;
      if (m.type === "RECEIPT") receipts += m.quantity;
      else if (m.type === "SALE") sales += Math.abs(m.quantity);
      else if (m.type === "WRITE_OFF") writeOffs += Math.abs(m.quantity);
      else if (m.type === "SUPPLIER_RETURN") supplierReturns += Math.abs(m.quantity);
      else if (m.type === "STOCKTAKE") {
        stocktakeAdjustments += m.quantity;
        actualStock = running;
      }
    }

    return {
      variantId: variant.id,
      productName: variant.product.name,
      sku: variant.sku,
      openingStock: opening,
      receipts,
      sales,
      writeOffs,
      supplierReturns,
      stocktakeAdjustments,
      closingStock: running,
      actualStock,
    };
  });
}

export async function exportInventoryToExcel(tenantId: string): Promise<Buffer> {
  const report = await getDailyReport(tenantId, {});

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Inventory");
  sheet.addRow(["Product", "SKU", "Opening Stock", "Receipts", "Sales", "Write-offs", "Supplier Returns", "Closing Stock", "Actual Stock"]);

  for (const row of report) {
    sheet.addRow([
      row.productName,
      row.sku,
      row.openingStock,
      row.receipts,
      row.sales,
      row.writeOffs,
      row.supplierReturns,
      row.closingStock,
      row.actualStock ?? "",
    ]);
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
