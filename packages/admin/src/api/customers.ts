import { apiRequest } from "./client";
import type { Customer, Paginated } from "../types/api";

export interface ListCustomersParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export function list(params: ListCustomersParams = {}): Promise<Paginated<Customer>> {
  return apiRequest("/api/customers", { query: params });
}
