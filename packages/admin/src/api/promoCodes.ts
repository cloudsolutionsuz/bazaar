import { apiRequest } from "./client";
import type { Paginated, PromoCode } from "../types/api";

export interface CreatePromoCodeInput {
  code: string;
  discountPercent?: number;
  discountFixed?: number;
  maxUses?: number;
  minOrderAmount?: number;
  expiresAt?: string;
}

export function listPromoCodes(params: { page?: number; pageSize?: number } = {}): Promise<Paginated<PromoCode>> {
  return apiRequest("/api/promo-codes", { query: params });
}

export function createPromoCode(input: CreatePromoCodeInput): Promise<{ promoCode: PromoCode }> {
  return apiRequest("/api/promo-codes", { method: "POST", body: input });
}

export function deactivatePromoCode(id: string): Promise<{ promoCode: PromoCode }> {
  return apiRequest(`/api/promo-codes/${id}`, { method: "DELETE" });
}
