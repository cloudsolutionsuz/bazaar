import { apiRequest } from "./client";
import type { Tenant } from "../types/api";

export interface UpdateMySettingsInput {
  telegramChatId?: string | null;
  themeColor?: string | null;
  description?: string | null;
}

export function updateMySettings(input: UpdateMySettingsInput): Promise<{ tenant: Tenant }> {
  return apiRequest("/api/tenants/me", { method: "PATCH", body: input });
}

export function uploadLogo(file: File): Promise<{ tenant: Tenant }> {
  const form = new FormData();
  form.append("image", file);
  return apiRequest("/api/tenants/me/logo", { method: "POST", body: form });
}
