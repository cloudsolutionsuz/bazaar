import { apiRequest } from "./client";
import type { InventoryMovement, InventoryMovementType, Paginated, Product, ProductVariant } from "../types/api";

export interface CreateReceiptInput {
  variantId: string;
  quantity: number;
  purchasePrice?: number;
  note?: string;
}

export function createReceipt(input: CreateReceiptInput): Promise<{ movement: InventoryMovement }> {
  return apiRequest("/api/inventory/receipts", { method: "POST", body: input });
}

export interface ListMovementsParams {
  variantId?: string;
  type?: InventoryMovementType;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export function listMovements(params: ListMovementsParams = {}): Promise<Paginated<InventoryMovement>> {
  return apiRequest("/api/inventory/movements", { query: params });
}

export function listLowStock(): Promise<{ variants: (ProductVariant & { product: Product })[] }> {
  return apiRequest("/api/inventory/low-stock");
}
