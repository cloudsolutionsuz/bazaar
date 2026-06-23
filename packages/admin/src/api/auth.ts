import { apiRequest, clearTokens, getRefreshToken, setTokens } from "./client";
import type { Tenant, User } from "../types/api";

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  tenant: Tenant | null;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const data = await apiRequest<LoginResponse>("/api/auth/login", { method: "POST", body: { email, password } });
  setTokens(data.accessToken, data.refreshToken);
  return data;
}

export function fetchMe(): Promise<{ user: User; tenant: Tenant | null }> {
  return apiRequest("/api/auth/me");
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    await apiRequest("/api/auth/logout", { method: "POST", body: { refreshToken }, responseType: "none" }).catch(() => {});
  }
  clearTokens();
}
