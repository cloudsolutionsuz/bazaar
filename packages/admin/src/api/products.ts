import { apiRequest } from "./client";
import type { Paginated, Product, ProductStatus, ProductVariant } from "../types/api";

export interface ListProductsParams {
  status?: ProductStatus;
  categoryId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function listProducts(params: ListProductsParams = {}): Promise<Paginated<Product>> {
  return apiRequest("/api/products", { query: params });
}

export function getProduct(id: string): Promise<{ product: Product }> {
  return apiRequest(`/api/products/${id}`);
}

export interface VariantInput {
  name?: string;
  sku: string;
  priceOverride?: number;
  costPrice?: number;
  stockQuantity?: number;
  lowStockThreshold?: number;
  supplierId?: string;
}

export interface CreateProductInput {
  name: string;
  description?: string;
  descriptionRu?: string;
  descriptionUz?: string;
  price: number;
  discountPercent?: number;
  brand?: string;
  color?: string;
  code?: string;
  currency?: string;
  categoryId?: string;
  status?: ProductStatus;
  variants?: VariantInput[];
}

export function createProduct(input: CreateProductInput): Promise<{ product: Product }> {
  return apiRequest("/api/products", { method: "POST", body: input });
}

export type UpdateProductInput = Partial<Omit<CreateProductInput, "variants">>;

export function updateProduct(id: string, input: UpdateProductInput): Promise<{ product: Product }> {
  return apiRequest(`/api/products/${id}`, { method: "PATCH", body: input });
}

export function deleteProduct(id: string): Promise<void> {
  return apiRequest(`/api/products/${id}`, { method: "DELETE", responseType: "none" });
}

export function createVariant(productId: string, input: VariantInput): Promise<{ variant: ProductVariant }> {
  return apiRequest(`/api/products/${productId}/variants`, { method: "POST", body: input });
}

export type UpdateVariantInput = Partial<Omit<VariantInput, "stockQuantity">>;

export function updateVariant(productId: string, variantId: string, input: UpdateVariantInput): Promise<{ variant: ProductVariant }> {
  return apiRequest(`/api/products/${productId}/variants/${variantId}`, { method: "PATCH", body: input });
}

export function deleteVariant(productId: string, variantId: string): Promise<void> {
  return apiRequest(`/api/products/${productId}/variants/${variantId}`, { method: "DELETE", responseType: "none" });
}

export function uploadImages(productId: string, files: File[]): Promise<{ product: Product }> {
  const form = new FormData();
  for (const file of files) form.append("images", file);
  return apiRequest(`/api/products/${productId}/images`, { method: "POST", body: form });
}

export function deleteImage(productId: string, imageId: string): Promise<void> {
  return apiRequest(`/api/products/${productId}/images/${imageId}`, { method: "DELETE", responseType: "none" });
}

export function reorderImages(productId: string, imageIds: string[]): Promise<void> {
  return apiRequest(`/api/products/${productId}/images/reorder`, { method: "PATCH", body: { imageIds }, responseType: "none" });
}

export function exportProducts(): Promise<Blob> {
  return apiRequest("/api/products/export", { responseType: "blob" });
}

export function downloadImportTemplate(): Promise<Blob> {
  return apiRequest("/api/products/import-template", { responseType: "blob" });
}

export interface ImportResult {
  created: number;
  errors: { row: number; message: string }[];
}

export function importProducts(file: File): Promise<ImportResult> {
  const form = new FormData();
  form.append("file", file);
  return apiRequest("/api/products/import", { method: "POST", body: form });
}
