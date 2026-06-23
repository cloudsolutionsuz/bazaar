import { apiRequest } from "./client";
import type { Plan } from "../types/api";

export function listPlans(): Promise<{ plans: Plan[] }> {
  return apiRequest("/api/plans");
}

export interface PlanInput {
  code: string;
  name: string;
  priceSum: number;
  maxProducts?: number | null;
  maxOrdersPerMonth?: number | null;
  maxEmployees?: number | null;
}

export function createPlan(input: PlanInput): Promise<{ plan: Plan }> {
  return apiRequest("/api/plans", { method: "POST", body: input });
}

export function updatePlan(id: string, input: Partial<PlanInput>): Promise<{ plan: Plan }> {
  return apiRequest(`/api/plans/${id}`, { method: "PATCH", body: input });
}
