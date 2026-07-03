import { apiRequest } from "./client";
import type { Paginated } from "../types/api";

export interface ProductReviewItem {
  id: string;
  productId: string;
  product: { name: string };
  customerPhone: string;
  customerName: string;
  rating: number;
  text: string | null;
  isApproved: boolean;
  createdAt: string;
}

export function listReviews(params: {
  productId?: string;
  approved?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<Paginated<ProductReviewItem>> {
  return apiRequest("/api/reviews", { query: params });
}

export function approveReview(id: string): Promise<{ review: ProductReviewItem }> {
  return apiRequest(`/api/reviews/${id}/approve`, { method: "PATCH" });
}

export function deleteReview(id: string): Promise<void> {
  return apiRequest(`/api/reviews/${id}`, { method: "DELETE", responseType: "none" });
}
