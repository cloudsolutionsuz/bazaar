import { apiRequest } from "./client";
import type { DashboardSummary } from "../types/api";

export function getSummary(): Promise<DashboardSummary> {
  return apiRequest("/api/dashboard/summary");
}
