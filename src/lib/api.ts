/**
 * API client for the Zap API (same Next.js app: /api/*).
 * Optional NEXT_PUBLIC_API_URL when the UI is hosted separately from the API.
 */

/** Origin for server-side fetch (RSC, Route Handlers calling own API). */
function getServerOrigin(): string {
  const env = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

const getBaseUrl = (): string => {
  const url = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (url) return url.replace(/\/$/, "");
  if (globalThis.window !== undefined) {
    return "";
  }
  return getServerOrigin();
};

/**
 * Base URL for /api routes. Browser: same-origin `/api` when env unset.
 * Server: full origin + `/api`.
 */
export const apiBaseUrl = (): string => {
  const base = getBaseUrl();
  if (!base) return "/api";
  return `${base}/api`;
};

export type AuthMode =
  | { type: "bearer"; token: string }
  | { type: "apiKey"; key: string };

export function getAuthHeaders(auth: AuthMode | null): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (auth) {
    if (auth.type === "bearer") {
      headers["Authorization"] = `Bearer ${auth.token}`;
    } else {
      headers["X-API-Key"] = auth.key;
    }
  }
  return headers;
}

type RequestOptions = RequestInit & { auth?: AuthMode | null };

export async function apiGet<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { auth, ...init } = options;
  const url = `${apiBaseUrl()}/${path.replace(/^\//, "")}`;
  const res = await fetch(url, {
    ...init,
    method: "GET",
    headers: getAuthHeaders(auth ?? null),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T = unknown>(
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<T> {
  const { auth, ...init } = options;
  const url = `${apiBaseUrl()}/${path.replace(/^\//, "")}`;
  const res = await fetch(url, {
    ...init,
    method: "POST",
    headers: getAuthHeaders(auth ?? null),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}
