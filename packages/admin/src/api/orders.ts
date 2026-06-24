import { apiRequest } from "./client";
import type { Order, OrderStatus, Paginated } from "../types/api";

export interface ListOrdersParams {
  status?: OrderStatus;
  from?: string;
  to?: string;
  minAmount?: number;
  maxAmount?: number;
  page?: number;
  pageSize?: number;
}

export function listOrders(params: ListOrdersParams = {}): Promise<Paginated<Order>> {
  return apiRequest("/api/orders", { query: params });
}

export function getOrder(id: string): Promise<{ order: Order }> {
  return apiRequest(`/api/orders/${id}`);
}

export interface CreateOrderInput {
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

export function createOrder(input: CreateOrderInput): Promise<{ order: Order }> {
  return apiRequest("/api/orders", { method: "POST", body: input });
}

export function updateOrderStatus(id: string, status: OrderStatus): Promise<{ order: Order }> {
  return apiRequest(`/api/orders/${id}/status`, { method: "PATCH", body: { status } });
}

export function exportOrders(): Promise<Blob> {
  return apiRequest("/api/orders/export", { responseType: "blob" });
}

// Mirrors the backend state machine (src/modules/orders/orders.service.ts)
// so the UI never offers a transition the API would reject.
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "REFUNDED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};
