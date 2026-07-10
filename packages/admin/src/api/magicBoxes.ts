import { apiRequest } from "./client";

export interface MagicBoxRequiredItem {
  id: string;
  variantId: string;
  quantity: number;
  variant: {
    id: string;
    name: string | null;
    sku: string;
    product: { id: string; name: string; images: { url: string }[] };
  };
}

export interface MagicBox {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  items: MagicBoxRequiredItem[];
}

export function listMagicBoxes(): Promise<{ items: MagicBox[] }> {
  return apiRequest("/api/magic-boxes");
}

export function createMagicBox(data: {
  name: string;
  description?: string;
  items: { variantId: string; quantity: number }[];
}): Promise<{ box: MagicBox }> {
  return apiRequest("/api/magic-boxes", { method: "POST", body: data });
}

export function updateMagicBox(
  id: string,
  data: { name?: string; description?: string; isActive?: boolean; items?: { variantId: string; quantity: number }[] },
): Promise<{ box: MagicBox }> {
  return apiRequest(`/api/magic-boxes/${id}`, { method: "PATCH", body: data });
}

export function deleteMagicBox(id: string): Promise<void> {
  return apiRequest(`/api/magic-boxes/${id}`, { method: "DELETE", responseType: "none" });
}
