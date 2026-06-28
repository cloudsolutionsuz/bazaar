import { apiRequest } from "./client";
import type { CashRegister } from "../types/api";

export function listCashRegisters(): Promise<{ items: CashRegister[] }> {
  return apiRequest("/api/cash-registers");
}

export function createCashRegister(name: string): Promise<{ cashRegister: CashRegister }> {
  return apiRequest("/api/cash-registers", { method: "POST", body: { name } });
}

export interface UpdateCashRegisterInput {
  name?: string;
  isDefault?: boolean;
  isActive?: boolean;
}

export function updateCashRegister(id: string, input: UpdateCashRegisterInput): Promise<{ cashRegister: CashRegister }> {
  return apiRequest(`/api/cash-registers/${id}`, { method: "PATCH", body: input });
}
