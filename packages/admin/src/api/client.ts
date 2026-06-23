import type { ApiErrorBody } from "../types/api";

const ACCESS_TOKEN_KEY = "bazaar_access_token";
const REFRESH_TOKEN_KEY = "bazaar_refresh_token";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return false;

  const data = await res.json();
  setTokens(data.accessToken, data.refreshToken);
  return true;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  // `object` (not a named Record) so callers can pass their own params
  // interfaces without hitting TS's stricter index-signature check for
  // declared interfaces vs literal types.
  query?: object;
  responseType?: "json" | "blob" | "none";
}

function buildUrl(path: string, query?: object): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function rawRequest(path: string, options: RequestOptions, accessToken: string | null): Promise<Response> {
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  return fetch(buildUrl(path, options.query), { method: options.method ?? "GET", headers, body });
}

// Unauthenticated endpoints where a 401 means "wrong credentials", not
// "your session expired" - must never trigger the refresh-and-retry dance.
const UNAUTHENTICATED_PATHS = new Set(["/api/auth/login", "/api/auth/register", "/api/auth/refresh"]);

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let res = await rawRequest(path, options, getAccessToken());

  if (res.status === 401 && !UNAUTHENTICATED_PATHS.has(path)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await rawRequest(path, options, getAccessToken());
    } else {
      clearTokens();
      onUnauthorized?.();
      throw new ApiError(401, "UNAUTHENTICATED", "Сессия истекла, войдите снова");
    }
  }

  if (!res.ok) {
    let code = "UNKNOWN_ERROR";
    let message = `Request failed with status ${res.status}`;
    try {
      const data = (await res.json()) as ApiErrorBody;
      code = data.error?.code ?? code;
      message = data.error?.message ?? message;
    } catch {
      // non-JSON error body, keep defaults
    }
    throw new ApiError(res.status, code, message);
  }

  if (options.responseType === "blob") {
    return (await res.blob()) as unknown as T;
  }
  if (options.responseType === "none" || res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}
