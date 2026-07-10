import { apiRequest } from "./client";
import type { SupportMessage, SupportChatThread } from "../types/api";

// Tenant-facing
export function getMessages(): Promise<{ messages: SupportMessage[] }> {
  return apiRequest("/api/support/messages");
}

export function sendMessage(text: string): Promise<{ message: SupportMessage }> {
  return apiRequest("/api/support/messages", { method: "POST", body: { text } });
}

export function getUnreadCount(): Promise<{ count: number }> {
  return apiRequest("/api/support/unread");
}

// Super admin-facing
export function listChats(): Promise<{ items: SupportChatThread[] }> {
  return apiRequest("/api/platform/support");
}

export function getSuperAdminUnreadCount(): Promise<{ count: number }> {
  return apiRequest("/api/platform/support/unread");
}

export function getTenantMessages(tenantId: string): Promise<{ messages: SupportMessage[] }> {
  return apiRequest(`/api/platform/support/${tenantId}/messages`);
}

export function replyToTenant(tenantId: string, text: string): Promise<{ message: SupportMessage }> {
  return apiRequest(`/api/platform/support/${tenantId}/messages`, { method: "POST", body: { text } });
}
