import { apiRequest } from "./client";
import type {
  AnalyticsResult,
  DailySummary,
  FinanceTransaction,
  Paginated,
  PendingTransaction,
  PnLResult,
  SalesForecastResult,
  TransactionType,
} from "../types/api";

export function getBalance(cashRegisterId?: string): Promise<{ balance: number }> {
  return apiRequest("/api/finance/balance", { query: { cashRegisterId } });
}

export interface ListTransactionsParams {
  type?: TransactionType;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  cashRegisterId?: string;
}

export function listTransactions(params: ListTransactionsParams = {}): Promise<Paginated<FinanceTransaction>> {
  return apiRequest("/api/finance/transactions", { query: params });
}

export interface CreateTransactionInput {
  type: TransactionType;
  category: string;
  amount: number;
  description?: string;
  cashRegisterId: string;
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

export function exportAnalytics(from: string, to: string, granularity: "day" | "week" | "month"): Promise<Blob> {
  return apiRequest("/api/finance/analytics/export", { query: { from, to, granularity }, responseType: "blob" });
}

export function exportPnL(from: string, to: string): Promise<Blob> {
  return apiRequest("/api/finance/pnl/export", { query: { from, to }, responseType: "blob" });
}

export function getForecast(horizonDays: 30 | 60): Promise<SalesForecastResult> {
  return apiRequest("/api/finance/forecast", { query: { horizonDays } });
}

export function listPendingTransactions(search?: string): Promise<{ items: PendingTransaction[] }> {
  return apiRequest("/api/finance/transactions/pending", { query: { search } });
}

export function confirmTransaction(id: string, cashRegisterId: string): Promise<{ transaction: FinanceTransaction }> {
  return apiRequest(`/api/finance/transactions/${id}/confirm`, { method: "POST", body: { cashRegisterId } });
}

export function getDailySummary(date?: string, cashRegisterId?: string): Promise<DailySummary> {
  return apiRequest("/api/finance/daily-summary", { query: { date, cashRegisterId } });
}
