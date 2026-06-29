import { apiRequest } from "./client";

export interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function ask(question: string, history?: AiChatMessage[]): Promise<{ answer: string }> {
  return apiRequest("/api/ai-advisor/ask", { method: "POST", body: { question, history } });
}
