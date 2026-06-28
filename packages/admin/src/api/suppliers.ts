import { apiRequest } from "./client";
import type { Paginated, Supplier } from "../types/api";

export interface ListSuppliersParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export function listSuppliers(params: ListSuppliersParams = {}): Promise<Paginated<Supplier>> {
  return apiRequest("/api/suppliers", { query: params });
}

export interface SupplierInput {
  name: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
  note?: string;
}

export function createSupplier(input: SupplierInput): Promise<{ supplier: Supplier }> {
  return apiRequest("/api/suppliers", { method: "POST", body: input });
}

export function updateSupplier(id: string, input: Partial<SupplierInput>): Promise<{ supplier: Supplier }> {
  return apiRequest(`/api/suppliers/${id}`, { method: "PATCH", body: input });
}

export function deleteSupplier(id: string): Promise<void> {
  return apiRequest(`/api/suppliers/${id}`, { method: "DELETE", responseType: "none" });
}
