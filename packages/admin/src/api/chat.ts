import { apiRequest } from "./client";
import type { ChatCustomerRef, ChatMessage, ChatThread } from "../types/api";

export function listThreads(): Promise<{ items: ChatThread[] }> {
  return apiRequest("/api/chat/threads");
}

export function getThreadMessages(customerId: string): Promise<{ customer: ChatCustomerRef; messages: ChatMessage[] }> {
  return apiRequest(`/api/chat/threads/${customerId}/messages`);
}

export function sendMessage(customerId: string, text: string): Promise<{ message: ChatMessage }> {
  return apiRequest(`/api/chat/threads/${customerId}/messages`, { method: "POST", body: { text } });
}

export function getUnreadCount(): Promise<{ count: number }> {
  return apiRequest("/api/chat/unread-count");
}

export function getPushVapidKey(): Promise<{ publicKey: string | null }> {
  return apiRequest("/api/chat/push/vapid-key");
}

export function subscribePush(sub: { endpoint: string; p256dh: string; auth: string }): Promise<{ ok: boolean }> {
  return apiRequest("/api/chat/push/subscribe", { method: "POST", body: sub });
}
