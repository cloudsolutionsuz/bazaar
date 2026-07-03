import { apiRequest } from "./client";
import type { Tenant } from "../types/api";

export interface UpdateMySettingsInput {
  telegramChatId?: string | null;
  themeColor?: string | null;
  description?: string | null;
  inn?: string | null;
  companyName?: string | null;
  contactPhone?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  youtube?: string | null;
  loyaltyEnabled?: boolean;
  loyaltyPointsRate?: number;
  loyaltyMinRedeem?: number;
  minOrderAmount?: number;
  paymentMethods?: string[];
}

export function updateMySettings(input: UpdateMySettingsInput): Promise<{ tenant: Tenant }> {
  return apiRequest("/api/tenants/me", { method: "PATCH", body: input });
}

export function uploadLogo(file: File): Promise<{ tenant: Tenant }> {
  const form = new FormData();
  form.append("image", file);
  return apiRequest("/api/tenants/me/logo", { method: "POST", body: form });
}
