import { z } from "zod";

export const createReceiptSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive(),
  purchasePrice: z.number().int().positive().optional(),
  supplierId: z.string().uuid().optional(),
  note: z.string().max(500).optional(),
});

export const movementTypeValues = [
  "RECEIPT",
  "SALE",
  "RETURN",
  "ADJUSTMENT",
  "WRITE_OFF",
  "STOCKTAKE",
  "SUPPLIER_RETURN",
] as const;

export const listMovementsQuerySchema = z.object({
  variantId: z.string().uuid().optional(),
  type: z.enum(movementTypeValues).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const createWriteOffSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitCost: z.number().int().positive().optional(),
  note: z.string().min(1).max(500),
});

export const createStocktakeSchema = z.object({
  variantId: z.string().uuid(),
  actualQuantity: z.number().int().min(0),
  note: z.string().max(500).optional(),
});

// Unlike a write-off, a supplier return always needs both a supplier (whose
// debt it credits) and a cost (without one there's nothing to credit).
export const createSupplierReturnSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive(),
  supplierId: z.string().uuid(),
  unitCost: z.number().int().positive(),
  note: z.string().max(500).optional(),
});

export const dailyReportQuerySchema = z.object({
  date: z.coerce.date().optional(),
});

export type CreateReceiptInput = z.infer<typeof createReceiptSchema>;
export type ListMovementsQuery = z.infer<typeof listMovementsQuerySchema>;
export type CreateWriteOffInput = z.infer<typeof createWriteOffSchema>;
export type CreateStocktakeInput = z.infer<typeof createStocktakeSchema>;
export type DailyReportQuery = z.infer<typeof dailyReportQuerySchema>;
export type CreateSupplierReturnInput = z.infer<typeof createSupplierReturnSchema>;
