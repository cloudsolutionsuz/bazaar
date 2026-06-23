import { apiRequest } from "./client";
import type { User } from "../types/api";

export function listEmployees(): Promise<{ employees: User[] }> {
  return apiRequest("/api/employees");
}

export interface InviteEmployeeInput {
  name: string;
  email: string;
  role: "MANAGER" | "CASHIER";
}

export function inviteEmployee(input: InviteEmployeeInput): Promise<{ employee: User }> {
  return apiRequest("/api/employees/invite", { method: "POST", body: input });
}

export function updateEmployeeRole(id: string, role: "MANAGER" | "CASHIER"): Promise<{ employee: User }> {
  return apiRequest(`/api/employees/${id}`, { method: "PATCH", body: { role } });
}

export function removeEmployee(id: string): Promise<void> {
  return apiRequest(`/api/employees/${id}`, { method: "DELETE", responseType: "none" });
}
