import { apiRequest } from "./client";
import { getSessionId } from "../utils/session";
import type { Banner, Category, OrderResult, Paginated, Product, TenantMeta } from "../types/api";

export function listCategories(): Promise<{ categories: Category[] }> {
  return apiRequest("/api/storefront/categories");
}

export interface ListProductsParams {
  categoryId?: string;
  search?: string;
  sort?: "newest" | "price_asc" | "price_desc";
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  pageSize?: number;
}

export function listProducts(params: ListProductsParams = {}): Promise<Paginated<Product>> {
  return apiRequest("/api/storefront/products", { query: params });
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
  items: { variantId: string; quantity: number }[];
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
