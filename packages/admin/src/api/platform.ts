import { apiRequest } from "./client";
import type { PlatformStats, Paginated, TenantStatus, TenantWithRelations } from "../types/api";

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

export function getStats(): Promise<PlatformStats> {
  return apiRequest("/api/platform/stats");
}
