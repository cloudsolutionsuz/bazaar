import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as authApi from "../api/auth";
import { getAccessToken, setUnauthorizedHandler } from "../api/client";
import type { Tenant, User } from "../types/api";

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setTenant(null);
    });
  }, []);

  useEffect(() => {
    async function bootstrap() {
      if (!getAccessToken()) {
        setLoading(false);
        return;
      }
      try {
        const me = await authApi.fetchMe();
        setUser(me.user);
        setTenant(me.tenant);
      } catch {
        // invalid/expired token; api/client already cleared it on a failed refresh
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, []);

  async function login(email: string, password: string): Promise<void> {
    const data = await authApi.login(email, password);
    setUser(data.user);
    setTenant(data.tenant);
  }

  async function logout(): Promise<void> {
    await authApi.logout();
    setUser(null);
    setTenant(null);
  }

  return <AuthContext.Provider value={{ user, tenant, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
