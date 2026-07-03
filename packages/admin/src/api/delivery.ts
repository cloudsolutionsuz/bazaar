import { apiRequest } from "./client";
import type { DeliveryZone } from "../types/api";

export interface CreateDeliveryZoneInput {
  name: string;
  regions: string[];
  cost: number;
  freeAbove?: number;
  position?: number;
}

export type UpdateDeliveryZoneInput = Partial<CreateDeliveryZoneInput> & { isActive?: boolean };

export function listDeliveryZones(): Promise<{ zones: DeliveryZone[] }> {
  return apiRequest("/api/delivery");
}

export function createDeliveryZone(input: CreateDeliveryZoneInput): Promise<{ zone: DeliveryZone }> {
  return apiRequest("/api/delivery", { method: "POST", body: input });
}

export function updateDeliveryZone(id: string, input: UpdateDeliveryZoneInput): Promise<{ zone: DeliveryZone }> {
  return apiRequest(`/api/delivery/${id}`, { method: "PATCH", body: input });
}

export function deleteDeliveryZone(id: string): Promise<void> {
  return apiRequest(`/api/delivery/${id}`, { method: "DELETE" });
}
