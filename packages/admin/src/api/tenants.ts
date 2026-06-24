import { apiRequest } from "./client";
import type { Tenant } from "../types/api";

export function updateMySettings(telegramChatId: string | null): Promise<{ tenant: Tenant }> {
  return apiRequest("/api/tenants/me", { method: "PATCH", body: { telegramChatId } });
}
