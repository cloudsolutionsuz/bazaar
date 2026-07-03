import { apiRequest } from "./client";
import type { DashboardSummary } from "../types/api";

export function getSummary(from?: string, to?: string): Promise<DashboardSummary> {
  return apiRequest("/api/dashboard/summary", { query: { from, to } });
}
