"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  clearStoredToken,
  setStoredToken,
  getStoredToken,
  apiFetch,
  TOKEN_KEY,
} from "@/lib/api-browser";

export type AuthPermission = { resource: string; action: string };

export type AuthUser = {
  id: number;
  email: string;
  roles: string[];
  permissions?: AuthPermission[];
};

function userHasPermission(
  user: AuthUser | null,
  resource: string,
  action: string
): boolean {
  if (!user?.permissions?.length) return false;
  const perms = user.permissions;
  if (perms.some((p) => p.resource === "*" && p.action === "*")) return true;
  return perms.some((p) => p.resource === resource && p.action === action);
}

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
  hasPermission: (resource: string, action: string) => boolean;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const refreshUser = React.useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await apiFetch<AuthUser>("/api/auth/me");
      setUser(me);
    } catch {
      clearStoredToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  React.useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== TOKEN_KEY) return;
      if (!event.newValue) {
        setUser(null);
        router.replace("/login");
        return;
      }
      void refreshUser();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refreshUser, router]);

  React.useEffect(() => {
    if (loading) return;
    if (!pathname) return;
    const publicPaths = ["/login", "/api-docs"];
    const isPublic = publicPaths.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );
    if (!user && !isPublic) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/listings")}`);
    }
  }, [user, loading, pathname, router]);

  const login = React.useCallback(
    async (email: string, password: string) => {
      const res = await fetch(
        typeof window !== "undefined"
          ? `${window.location.origin}/api/auth/login`
          : "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }
      );
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Login failed");
      }
      const data = (await res.json()) as { token: string; user: AuthUser };
      setStoredToken(data.token);
      setUser(data.user);
    },
    []
  );

  const logout = React.useCallback(() => {
    clearStoredToken();
    setUser(null);
    router.replace("/login");
  }, [router]);

  const hasPermission = React.useCallback(
    (resource: string, action: string) => userHasPermission(user, resource, action),
    [user]
  );

  const isAdmin =
    (user?.roles?.includes("admin") ?? false) ||
    userHasPermission(user, "*", "*");

  const value: AuthContextValue = React.useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      refreshUser,
      isAdmin,
      hasPermission,
    }),
    [user, loading, login, logout, refreshUser, isAdmin, hasPermission]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
