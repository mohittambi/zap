/**
 * Server-side calls to web.eautomate.in using EAUTOMATE_COOKIE / EAUTOMATE_BEARER_TOKEN.
 * Optional: EAUTOMATE_LOGIN_USER_ID + EAUTOMATE_LOGIN_PASSWORD → POST /public/api/login
 * to populate or refresh EAUTOMATE_COOKIE (see eautomate-session.ts).
 */

import {
  eautomateLoginConfigured,
  refreshEautomateSessionFromLogin,
  warmEautomateCookieFromLogin,
} from "@/server/eautomate-session";

export function getEautomateBaseUrl(): string {
  return (process.env.EAUTOMATE_BASE_URL || "https://web.eautomate.in").replace(
    /\/$/,
    ""
  );
}

export function eautomateProxyHeaders(): Headers {
  const h = new Headers();
  h.set("Accept", "application/json");
  const token = process.env.EAUTOMATE_BEARER_TOKEN?.trim();
  if (token) h.set("Authorization", `Bearer ${token}`);
  const cookie = process.env.EAUTOMATE_COOKIE?.trim();
  if (cookie) h.set("Cookie", cookie);
  return h;
}

export function eautomateConfigured(): boolean {
  return Boolean(
    process.env.EAUTOMATE_COOKIE?.trim() ||
      process.env.EAUTOMATE_BEARER_TOKEN?.trim() ||
      eautomateLoginConfigured()
  );
}

function mergeProxyHeaders(init?: RequestInit): Headers {
  const headers = eautomateProxyHeaders();
  if (init?.headers) {
    new Headers(init.headers).forEach((v, k) => {
      if (v != null && v !== "") headers.set(k, v);
    });
  }
  return headers;
}

/**
 * fetch() to eAutomate with merged auth headers.
 * If login env is set: warms cookie when missing; on 401, attempts one login refresh and retries.
 */
export async function fetchEautomate(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  await warmEautomateCookieFromLogin();

  const exec = () =>
    fetch(input, {
      ...init,
      headers: mergeProxyHeaders(init),
      signal: init?.signal ?? AbortSignal.timeout(30_000),
    });

  let res = await exec();
  if (res.status === 401 && eautomateLoginConfigured()) {
    await res.clone().text().catch(() => "");
    const ok = await refreshEautomateSessionFromLogin();
    if (ok) res = await exec();
  }
  return res;
}
