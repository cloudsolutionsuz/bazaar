import { apiRequest } from "./client";
import type { FinanceTransaction, Paginated, Supplier, SupplierStatement, SupplierWithBalance } from "../types/api";

export interface ListSuppliersParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export function listSuppliers(params: ListSuppliersParams = {}): Promise<Paginated<SupplierWithBalance>> {
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

export interface SupplierStatementParams {
  from?: string;
  to?: string;
}

export function getSupplierStatement(id: string, params: SupplierStatementParams = {}): Promise<SupplierStatement> {
  return apiRequest(`/api/suppliers/${id}/statement`, { query: params });
}

export function exportSupplierStatement(id: string, params: SupplierStatementParams = {}): Promise<Blob> {
  return apiRequest(`/api/suppliers/${id}/statement/export`, { query: params, responseType: "blob" });
}

export interface CreateSupplierPaymentInput {
  amount: number;
  cashRegisterId: string;
  description?: string;
}

export function createSupplierPayment(id: string, input: CreateSupplierPaymentInput): Promise<{ transaction: FinanceTransaction }> {
  return apiRequest(`/api/suppliers/${id}/payments`, { method: "POST", body: input });
}
