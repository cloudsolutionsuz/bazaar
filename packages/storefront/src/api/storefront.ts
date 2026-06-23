import { apiRequest } from "./client";
import type { Category, OrderResult, Paginated, Product } from "../types/api";

export function listCategories(): Promise<{ categories: Category[] }> {
  return apiRequest("/api/storefront/categories");
}

export interface ListProductsParams {
  categoryId?: string;
  search?: string;
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
  customerAddress?: string;
  paymentMethod?: string;
  items: { variantId: string; quantity: number }[];
}

export function placeOrder(input: CheckoutInput): Promise<{ order: OrderResult }> {
  return apiRequest("/api/storefront/orders", { method: "POST", body: input });
}
