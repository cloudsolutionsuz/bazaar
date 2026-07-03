import { apiRequest } from "./client";
import type { AnalyticsResult, BillingTimelineTenant, CustomerPaymentRow, FinanceTransaction, PlatformStats, Paginated, ProductSalesRow, TenantStatus, TenantWithRelations } from "../types/api";

export interface ListTenantsParams {
  status?: TenantStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function listTenants(params: ListTenantsParams = {}): Promise<Paginated<TenantWithRelations>> {
  return apiRequest("/api/platform/tenants", { query: params });
}

export function getTenant(id: string): Promise<{ tenant: TenantWithRelations }> {
  return apiRequest(`/api/platform/tenants/${id}`);
}

export function updateTenantPlan(id: string, planId: string): Promise<{ tenant: TenantWithRelations }> {
  return apiRequest(`/api/platform/tenants/${id}/plan`, { method: "PATCH", body: { planId } });
}

export function updateTenantVip(id: string, isVip: boolean): Promise<{ tenant: TenantWithRelations }> {
  return apiRequest(`/api/platform/tenants/${id}/vip`, { method: "PATCH", body: { isVip } });
}

export function getStats(): Promise<PlatformStats> {
  return apiRequest("/api/platform/stats");
}

export function getBillingTimeline(params: ListTenantsParams = {}): Promise<Paginated<BillingTimelineTenant>> {
  return apiRequest("/api/platform/billing-timeline", { query: params });
}

export function getTenantReports(id: string, from?: string, to?: string): Promise<{ analytics: AnalyticsResult; payments: FinanceTransaction[] }> {
  return apiRequest(`/api/platform/tenants/${id}/reports`, { query: { from, to } });
}

export function getTenantProductsReport(id: string, from: string, to: string): Promise<{ products: ProductSalesRow[] }> {
  return apiRequest(`/api/platform/tenants/${id}/reports/products`, { query: { from, to } });
}

export function getTenantPaymentsReport(id: string, from: string, to: string): Promise<{ items: CustomerPaymentRow[] }> {
  return apiRequest(`/api/platform/tenants/${id}/reports/payments`, { query: { from, to } });
}
