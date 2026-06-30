import { apiRequest } from "./client";
import type { Paginated, Promotion, PromotionDetail } from "../types/api";

export interface ListPromotionsParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export function listPromotions(params: ListPromotionsParams = {}): Promise<Paginated<Promotion>> {
  return apiRequest("/api/promotions", { query: params });
}

export function getPromotion(id: string): Promise<{ promotion: PromotionDetail }> {
  return apiRequest(`/api/promotions/${id}`);
}

export interface PromotionInput {
  name: string;
  discountPercent?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
}

export function createPromotion(input: PromotionInput): Promise<{ promotion: Promotion }> {
  return apiRequest("/api/promotions", { method: "POST", body: input });
}

export function updatePromotion(id: string, input: Partial<PromotionInput>): Promise<{ promotion: Promotion }> {
  return apiRequest(`/api/promotions/${id}`, { method: "PATCH", body: input });
}

export function deletePromotion(id: string): Promise<void> {
  return apiRequest(`/api/promotions/${id}`, { method: "DELETE", responseType: "none" });
}

export interface ProductSelector {
  productIds?: string[];
  categoryId?: string;
  brand?: string;
  supplierId?: string;
}

export function attachProducts(promotionId: string, selector: ProductSelector): Promise<{ promotion: PromotionDetail }> {
  return apiRequest(`/api/promotions/${promotionId}/products`, { method: "POST", body: selector });
}

export function detachProduct(promotionId: string, productId: string): Promise<void> {
  return apiRequest(`/api/promotions/${promotionId}/products/${productId}`, { method: "DELETE", responseType: "none" });
}

export function applyBulkDiscount(
  selector: ProductSelector & { discountPercent: number | null },
): Promise<{ updated: number }> {
  return apiRequest("/api/promotions/bulk-discount", { method: "POST", body: selector });
}
