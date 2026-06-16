export const TOKEN_KEY = "zap_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  const fromLocal = localStorage.getItem(TOKEN_KEY);
  if (fromLocal) return fromLocal;
  // One-time migration from tab-scoped sessionStorage (logged-out new tabs).
  const legacy = sessionStorage.getItem(TOKEN_KEY);
  if (legacy) {
    localStorage.setItem(TOKEN_KEY, legacy);
    sessionStorage.removeItem(TOKEN_KEY);
    return legacy;
  }
  return null;
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  sessionStorage.removeItem(TOKEN_KEY);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

const apiBase = () => {
  const url = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (url) return url.replace(/\/$/, "");
  if (typeof window !== "undefined") return "";
  return "";
};

export function apiUrl(path: string): string {
  const base = apiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!base) return p;
  return `${base}${p}`;
}

/**
 * Fetch JSON from /api with Bearer token when set.
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(apiUrl(path), { ...init, headers });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
