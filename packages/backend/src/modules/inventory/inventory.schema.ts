import { z } from "zod";

export const createReceiptSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive(),
  purchasePrice: z.number().int().positive().optional(),
  note: z.string().max(500).optional(),
});

export const listMovementsQuerySchema = z.object({
  variantId: z.string().uuid().optional(),
  type: z.enum(["RECEIPT", "SALE", "RETURN", "ADJUSTMENT"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export type CreateReceiptInput = z.infer<typeof createReceiptSchema>;
export type ListMovementsQuery = z.infer<typeof listMovementsQuerySchema>;
