import { apiRequest } from "./client";
import type { DailyReportRow, InventoryMovement, InventoryMovementType, Paginated, Product, ProductVariant } from "../types/api";

export interface CreateReceiptInput {
  variantId: string;
  quantity: number;
  purchasePrice?: number;
  supplierId?: string;
  note?: string;
}

export function createReceipt(input: CreateReceiptInput): Promise<{ movement: InventoryMovement }> {
  return apiRequest("/api/inventory/receipts", { method: "POST", body: input });
}

export interface CreateWriteOffInput {
  variantId: string;
  quantity: number;
  unitCost?: number;
  note: string;
}

export function createWriteOff(input: CreateWriteOffInput): Promise<{ movement: InventoryMovement }> {
  return apiRequest("/api/inventory/write-offs", { method: "POST", body: input });
}

export interface CreateStocktakeInput {
  variantId: string;
  actualQuantity: number;
  note?: string;
}

export function createStocktake(input: CreateStocktakeInput): Promise<{ movement: InventoryMovement }> {
  return apiRequest("/api/inventory/stocktakes", { method: "POST", body: input });
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

export function getDailyReport(date?: string): Promise<{ rows: DailyReportRow[] }> {
  return apiRequest("/api/inventory/daily-report", { query: { date } });
}

export function exportInventory(): Promise<Blob> {
  return apiRequest("/api/inventory/export", { responseType: "blob" });
}
