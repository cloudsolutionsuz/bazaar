import { z } from "zod";

export const createTransactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  category: z.string().min(1).max(100),
  amount: z.number().int().positive(),
  description: z.string().max(500).optional(),
  cashRegisterId: z.string().uuid(),
  supplierId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
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

// horizonDays is an internal UI toggle (30 or 60), not a public contract -
// the controller clamps anything else to 30 rather than 400ing on it.
export const forecastQuerySchema = z.object({
  horizonDays: z.coerce.number().int().optional(),
});

// Deliberately loose: a bad phone or amount is a per-row error the admin
// fixes in the preview table, not a reason to reject the whole request.
export const paymentImportRowSchema = z.object({
  phone: z.string().max(40).optional(),
  orderRef: z.string().max(64).optional(),
  amount: z.number().nullable().optional(),
  description: z.string().max(500).optional(),
});

const paymentImportRowsSchema = z.array(paymentImportRowSchema).min(1).max(1000);

export const validatePaymentsImportSchema = z.object({
  rows: paymentImportRowsSchema,
});

export const commitPaymentsImportSchema = z.object({
  rows: paymentImportRowsSchema,
  cashRegisterId: z.string().uuid(),
});

export type PaymentImportRowInput = z.infer<typeof paymentImportRowSchema>;
export type ValidatePaymentsImportInput = z.infer<typeof validatePaymentsImportSchema>;
export type CommitPaymentsImportInput = z.infer<typeof commitPaymentsImportSchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
export type ReportQuery = z.infer<typeof reportQuerySchema>;
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
export type ListPendingTransactionsQuery = z.infer<typeof listPendingTransactionsQuerySchema>;
export type DailySummaryQuery = z.infer<typeof dailySummaryQuerySchema>;
export type ConfirmTransactionInput = z.infer<typeof confirmTransactionSchema>;
export type BalanceQuery = z.infer<typeof balanceQuerySchema>;
export type ForecastQuery = z.infer<typeof forecastQuerySchema>;
