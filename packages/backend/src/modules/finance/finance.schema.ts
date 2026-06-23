import { z } from "zod";

export const createTransactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  category: z.string().min(1).max(100),
  amount: z.number().int().positive(),
  description: z.string().max(500).optional(),
});

export const listTransactionsQuerySchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const reportQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export const analyticsQuerySchema = reportQuerySchema.extend({
  granularity: z.enum(["day", "week", "month"]).optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
export type ReportQuery = z.infer<typeof reportQuerySchema>;
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
