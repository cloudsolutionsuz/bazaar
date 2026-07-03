import { apiRequest } from "./client";
import type { Customer, CustomerDetail, Paginated } from "../types/api";

export interface ListCustomersParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export function list(params: ListCustomersParams = {}): Promise<Paginated<Customer>> {
  return apiRequest("/api/customers", { query: params });
}

export function getCustomer(id: string): Promise<{ customer: CustomerDetail }> {
  return apiRequest(`/api/customers/${id}`);
}

export function exportCustomers(): Promise<Blob> {
  return apiRequest("/api/customers/export", { responseType: "blob" });
}

export function adjustLoyaltyPoints(id: string, delta: number, reason?: string): Promise<{ customer: object }> {
  return apiRequest(`/api/customers/${id}/loyalty`, { method: "PATCH", body: { delta, reason: reason ?? "" } });
}
