import { apiRequest } from "./client";
import type { AnalyticsResult, DailySummary, FinanceTransaction, Paginated, PendingTransaction, PnLResult, TransactionType } from "../types/api";

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

export function listPendingTransactions(search?: string): Promise<{ items: PendingTransaction[] }> {
  return apiRequest("/api/finance/transactions/pending", { query: { search } });
}

export function confirmTransaction(id: string): Promise<{ transaction: FinanceTransaction }> {
  return apiRequest(`/api/finance/transactions/${id}/confirm`, { method: "POST" });
}

export function getDailySummary(date?: string): Promise<DailySummary> {
  return apiRequest("/api/finance/daily-summary", { query: { date } });
}
