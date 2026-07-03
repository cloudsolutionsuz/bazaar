import { apiRequest } from "./client";
import { getSessionId } from "../utils/session";
import type { Banner, Category, ChatMessage, OrderResult, Paginated, Product, ProductReviewsResult, TenantMeta } from "../types/api";

export function listCategories(): Promise<{ categories: Category[] }> {
  return apiRequest("/api/storefront/categories");
}

export interface ListProductsParams {
  categoryId?: string;
  brand?: string;
  search?: string;
  sort?: "newest" | "price_asc" | "price_desc";
  minPrice?: number;
  maxPrice?: number;
  discountedOnly?: boolean;
  promotedOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export function listProducts(params: ListProductsParams = {}): Promise<Paginated<Product>> {
  return apiRequest("/api/storefront/products", { query: params });
}

export function listBrands(): Promise<{ brands: string[] }> {
  return apiRequest("/api/storefront/brands");
}

export function getProduct(id: string): Promise<{ product: Product }> {
  return apiRequest(`/api/storefront/products/${id}`);
}

export interface CheckoutInput {
  customerName: string;
  customerPhone: string;
  additionalPhones?: string[];
  addressRegion: string;
  addressDistrict: string;
  addressMahalla: string;
  addressNote?: string;
  paymentMethod?: string;
  promoCode?: string;
  loyaltyPointsToRedeem?: number;
  items: { variantId: string; quantity: number }[];
}

export interface LoyaltyBalance {
  loyaltyEnabled: boolean;
  loyaltyPoints: number;
  loyaltyMinRedeem: number;
  loyaltyPointsRate: number;
}

export function getLoyaltyBalance(phone: string): Promise<LoyaltyBalance> {
  return apiRequest("/api/storefront/loyalty", { query: { phone } });
}

export function getProductReviews(productId: string): Promise<ProductReviewsResult> {
  return apiRequest(`/api/storefront/products/${productId}/reviews`);
}

export interface SubmitReviewInput {
  customerPhone: string;
  customerName: string;
  rating: number;
  text?: string;
}

export function submitProductReview(productId: string, input: SubmitReviewInput): Promise<{ review: object }> {
  return apiRequest(`/api/storefront/products/${productId}/reviews`, { method: "POST", body: input });
}

export function validatePromoCode(
  code: string,
  amount: number,
): Promise<{ promoCodeId: string; discountAmount: number }> {
  return apiRequest("/api/promo-codes/validate", { query: { code, amount } });
}

export function placeOrder(input: CheckoutInput): Promise<{ order: OrderResult }> {
  return apiRequest("/api/storefront/orders", { method: "POST", body: input });
}

// Fire-and-forget: a tracking failure should never affect the shopper's
// experience, so callers don't need to (and shouldn't) await or handle this.
export function trackPageView(path: string): void {
  apiRequest("/api/storefront/analytics/track", {
    method: "POST",
    body: { sessionId: getSessionId(), path },
  }).catch(() => {});
}

export function getMyOrders(phone: string): Promise<{ orders: OrderResult[] }> {
  return apiRequest("/api/storefront/orders/by-phone", { query: { phone } });
}

export function listBanners(): Promise<{ banners: Banner[] }> {
  return apiRequest("/api/storefront/banners");
}

export function getMeta(): Promise<TenantMeta> {
  return apiRequest("/api/storefront/meta");
}

export function getChatMessages(phone: string): Promise<{ messages: ChatMessage[] }> {
  return apiRequest("/api/storefront/chat", { query: { phone } });
}

export function sendChatMessage(phone: string, name: string, text: string): Promise<{ message: ChatMessage }> {
  return apiRequest("/api/storefront/chat", { method: "POST", body: { phone, name, text } });
}

export function getPushVapidKey(): Promise<{ publicKey: string | null }> {
  return apiRequest("/api/storefront/push/vapid-key");
}

export function subscribeToPush(phone: string, name: string, sub: PushSubscriptionJSON): Promise<{ ok: boolean }> {
  return apiRequest("/api/storefront/push/subscribe", {
    method: "POST",
    body: {
      phone,
      name,
      endpoint: sub.endpoint,
      p256dh: sub.keys?.p256dh,
      auth: sub.keys?.auth,
    },
  });
}
