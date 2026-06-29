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
