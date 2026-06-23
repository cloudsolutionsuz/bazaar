import { apiRequest } from "./client";
import type { Plan } from "../types/api";

export function listPlans(): Promise<{ plans: Plan[] }> {
  return apiRequest("/api/plans");
}

export function checkSubdomain(value: string): Promise<{ available: boolean; reason?: string }> {
  return apiRequest("/api/tenants/check-subdomain", { query: { value } });
}

export interface RegisterInput {
  name: string;
  email: string;
  phone?: string;
  password: string;
  shopName: string;
  subdomain: string;
  planCode: string;
}

export function register(input: RegisterInput): Promise<unknown> {
  return apiRequest("/api/auth/register", { method: "POST", body: input });
}

export function verifyEmail(token: string): Promise<{ verified: boolean }> {
  return apiRequest("/api/auth/verify-email", { query: { token } });
}
