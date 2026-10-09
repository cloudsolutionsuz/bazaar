import { apiRequest } from "./client";
import type { OrderStatus } from "../types/api";

export type AgentBonusType = "PERCENT" | "FIXED";

export interface Agent {
  id: string;
  fullName: string;
  phone: string;
  telegram: string | null;
  instagram: string | null;
  youtube: string | null;
  tiktok: string | null;
  login: string;
  refCode: string;
  // Ready-to-share storefront link carrying this agent's referral code.
  link: string;
  bonusType: AgentBonusType;
  bonusValue: number;
  isActive: boolean;
  createdAt: string;
  orderCount: number;
  ordersAmount: number;
  bonusAccrued: number;
  bonusPaid: number;
  // Earned but not yet paid out.
  bonusBalance: number;
}

export interface AgentInput {
  fullName: string;
  phone: string;
  telegram: string | null;
  instagram: string | null;
  youtube: string | null;
  tiktok: string | null;
  login: string;
  password: string;
  bonusType: AgentBonusType;
  bonusValue: number;
}

export type UpdateAgentInput = Partial<AgentInput> & { isActive?: boolean };

export function listAgents(): Promise<{ agents: Agent[] }> {
  return apiRequest("/api/agents");
}

export function getMyAgentProfile(): Promise<{ agent: Agent }> {
  return apiRequest("/api/agents/me");
}

export function createAgent(input: AgentInput): Promise<{ agent: Agent }> {
  return apiRequest("/api/agents", { method: "POST", body: input });
}

export function updateAgent(id: string, input: UpdateAgentInput): Promise<{ agent: Agent }> {
  return apiRequest(`/api/agents/${id}`, { method: "PATCH", body: input });
}

export function deleteAgent(id: string): Promise<void> {
  return apiRequest(`/api/agents/${id}`, { method: "DELETE", responseType: "none" });
}

// agentIds omitted = every agent of the shop.
export function bulkSetBonus(input: { bonusType: AgentBonusType; bonusValue: number; agentIds?: string[] }): Promise<{ updated: number }> {
  return apiRequest("/api/agents/bulk-bonus", { method: "PATCH", body: input });
}

export function exportAgents(): Promise<Blob> {
  return apiRequest("/api/agents/export", { responseType: "blob" });
}

export function downloadImportTemplate(): Promise<Blob> {
  return apiRequest("/api/agents/import-template", { responseType: "blob" });
}

export type AgentImportField =
  | "fullName"
  | "phone"
  | "telegram"
  | "instagram"
  | "youtube"
  | "tiktok"
  | "login"
  | "password"
  | "bonusType"
  | "bonusValue";

export interface AgentImportError {
  // Row number as shown in Excel.
  row: number;
  field: AgentImportField | null;
  code: "INVALID" | "LOGIN_TAKEN" | "DUPLICATE_LOGIN" | "FAILED";
}

export interface AgentImportResult {
  created: number;
  errors: AgentImportError[];
}

export function importAgents(file: File): Promise<AgentImportResult> {
  const form = new FormData();
  form.append("file", file);
  return apiRequest("/api/agents/import", { method: "POST", body: form });
}

export interface UnpaidAgentOrder {
  id: string;
  customerName: string;
  totalAmount: number;
  agentBonus: number;
  agentBonusAccruedAt: string | null;
  createdAt: string;
}

export function getUnpaidOrders(agentId: string): Promise<{ items: UnpaidAgentOrder[]; totalAmount: number }> {
  return apiRequest(`/api/agents/${agentId}/unpaid-orders`);
}

export interface AgentPayoutResult {
  payout: { id: string; amount: number; orderCount: number };
}

export function createPayout(agentId: string, orderIds: string[], cashRegisterId: string): Promise<AgentPayoutResult> {
  return apiRequest(`/api/agents/${agentId}/payouts`, { method: "POST", body: { orderIds, cashRegisterId } });
}

export interface AgentPeriodParams {
  from?: string;
  to?: string;
  agentId?: string;
}

export type AgentPaymentFilter = "paid" | "unpaid";

export interface AgentSalesParams extends AgentPeriodParams {
  status?: OrderStatus;
  payment?: AgentPaymentFilter;
  page?: number;
  pageSize?: number;
}

export interface AgentSalesSummary {
  totalCount: number;
  totalAmount: number;
  byStatus: { status: OrderStatus; count: number; amount: number }[];
  archivedCount: number;
  archivedAmount: number;
  bonusAccrued: number;
  paidCount: number;
  paidAmount: number;
  unpaidCount: number;
  unpaidAmount: number;
}

export interface AgentSaleRow {
  id: string;
  createdAt: string;
  customerName: string;
  status: OrderStatus;
  totalAmount: number;
  goodsAmount: number;
  // null until the order is archived - that's when the bonus is earned.
  agentBonus: number | null;
  agentBonusAccruedAt: string | null;
  isPaid: boolean;
  paidAt: string | null;
  agentId: string | null;
  agentName: string | null;
}

export interface AgentSalesResult {
  summary: AgentSalesSummary;
  items: AgentSaleRow[];
  total: number;
  page: number;
  pageSize: number;
}

export function getSales(params: AgentSalesParams): Promise<AgentSalesResult> {
  return apiRequest("/api/agents/sales", { query: params });
}

export interface AgentPayoutRow {
  id: string;
  createdAt: string;
  amount: number;
  agentId: string;
  agentName: string;
  orderCount: number;
}

export function getPayouts(params: AgentPeriodParams): Promise<{ items: AgentPayoutRow[]; count: number; totalAmount: number }> {
  return apiRequest("/api/agents/payouts", { query: params });
}

export interface ReconciliationTotals {
  openingBalance: number;
  archivedCount: number;
  salesAmount: number;
  accrued: number;
  paid: number;
  closingBalance: number;
}

export interface ReconciliationRow extends ReconciliationTotals {
  agentId: string;
  fullName: string;
  phone: string;
}

export function getReconciliation(params: AgentPeriodParams): Promise<{ rows: ReconciliationRow[]; totals: ReconciliationTotals }> {
  return apiRequest("/api/agents/reconciliation", { query: params });
}

export function exportReconciliation(params: AgentPeriodParams): Promise<Blob> {
  return apiRequest("/api/agents/reconciliation/export", { query: params, responseType: "blob" });
}
