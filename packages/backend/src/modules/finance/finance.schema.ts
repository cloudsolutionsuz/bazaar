import { z } from "zod";

export const createTransactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  category: z.string().min(1).max(100),
  amount: z.number().int().positive(),
  description: z.string().max(500).optional(),
  cashRegisterId: z.string().uuid(),
});

export const listTransactionsQuerySchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  cashRegisterId: z.string().uuid().optional(),
});

export const confirmTransactionSchema = z.object({
  cashRegisterId: z.string().uuid(),
});

export const balanceQuerySchema = z.object({
  cashRegisterId: z.string().uuid().optional(),
});

export const reportQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export const analyticsQuerySchema = reportQuerySchema.extend({
  granularity: z.enum(["day", "week", "month"]).optional(),
});

export const listPendingTransactionsQuerySchema = z.object({
  search: z.string().max(200).optional(),
});

export const dailySummaryQuerySchema = z.object({
  date: z.coerce.date().optional(),
  cashRegisterId: z.string().uuid().optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
export type ReportQuery = z.infer<typeof reportQuerySchema>;
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
export type ListPendingTransactionsQuery = z.infer<typeof listPendingTransactionsQuerySchema>;
export type DailySummaryQuery = z.infer<typeof dailySummaryQuerySchema>;
export type ConfirmTransactionInput = z.infer<typeof confirmTransactionSchema>;
export type BalanceQuery = z.infer<typeof balanceQuerySchema>;
