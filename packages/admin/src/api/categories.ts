import { apiRequest } from "./client";
import type { Category } from "../types/api";

export function listCategories(): Promise<{ categories: Category[] }> {
  return apiRequest("/api/categories");
}

export function createCategory(input: { name: string; slug?: string }): Promise<{ category: Category }> {
  return apiRequest("/api/categories", { method: "POST", body: input });
}

export function updateCategory(id: string, input: { name?: string; slug?: string }): Promise<{ category: Category }> {
  return apiRequest(`/api/categories/${id}`, { method: "PATCH", body: input });
}

export function deleteCategory(id: string): Promise<void> {
  return apiRequest(`/api/categories/${id}`, { method: "DELETE", responseType: "none" });
}
