import { apiRequest } from "./client";
import type { AnalyticsResult, FinanceTransaction, Paginated, PnLResult, TransactionType } from "../types/api";

export function getBalance(): Promise<{ balance: number }> {
  return apiRequest("/api/finance/balance");
}

export interface ListTransactionsParams {
  type?: TransactionType;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export function listTransactions(params: ListTransactionsParams = {}): Promise<Paginated<FinanceTransaction>> {
  return apiRequest("/api/finance/transactions", { query: params });
}

export interface CreateTransactionInput {
  type: TransactionType;
  category: string;
  amount: number;
  description?: string;
}

export function createTransaction(input: CreateTransactionInput): Promise<{ transaction: FinanceTransaction }> {
  return apiRequest("/api/finance/transactions", { method: "POST", body: input });
}

export function getPnL(from: string, to: string): Promise<PnLResult> {
  return apiRequest("/api/finance/pnl", { query: { from, to } });
}

export function getAnalytics(from: string, to: string, granularity: "day" | "week" | "month"): Promise<AnalyticsResult> {
  return apiRequest("/api/finance/analytics", { query: { from, to, granularity } });
}
