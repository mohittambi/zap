import { persistEautomateAuthAfterLoginIfEnabled } from "./persist-eautomate-dotenv.mjs";

/**
 * Shared eAutomate HTTP for Node sync scripts: auth headers + optional login refresh.
 * Keep behavior aligned with src/server/eautomate-session.ts and eautomate-proxy.ts.
 *
 * Env: EAUTOMATE_COOKIE, EAUTOMATE_BEARER_TOKEN, EAUTOMATE_BASE_URL,
 *      EAUTOMATE_LOGIN_USER_ID, EAUTOMATE_LOGIN_PASSWORD,
 *      EAUTOMATE_LOGIN_URL | EAUTOMATE_LOGIN_PATH
 */
function baseUrl() {
  return (process.env.EAUTOMATE_BASE_URL || "https://web.eautomate.in").replace(/\/$/, "");
}

function loginConfigured() {
  return Boolean(
    process.env.EAUTOMATE_LOGIN_USER_ID?.trim() && process.env.EAUTOMATE_LOGIN_PASSWORD
  );
}

function resolveLoginUrl() {
  const full = process.env.EAUTOMATE_LOGIN_URL?.trim();
  if (full) return full.replace(/\/$/, "");
  const path = process.env.EAUTOMATE_LOGIN_PATH?.trim() || "/public/api/login";
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl()}${p}`;
}

function cookieFromTokens(access, idTok) {
  return `access_token=${access}; id_token=${idTok}`;
}

export async function refreshEautomateSessionFromLogin() {
  const userId = process.env.EAUTOMATE_LOGIN_USER_ID?.trim();
  const password = process.env.EAUTOMATE_LOGIN_PASSWORD;
  if (!userId || !password) return false;

  const url = resolveLoginUrl();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, password }),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[eautomate-auth] login HTTP ${res.status}: ${text.slice(0, 400)}`);
    return false;
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    console.error("[eautomate-auth] login response is not JSON");
    return false;
  }
  const access = typeof json.token === "string" ? json.token : null;
  const idTok = typeof json.id_token === "string" ? json.id_token : null;
  if (!access || !idTok) {
    console.error("[eautomate-auth] login JSON missing token or id_token");
    return false;
  }
  process.env.EAUTOMATE_COOKIE = cookieFromTokens(access, idTok);
  persistEautomateAuthAfterLoginIfEnabled();
  return true;
}

export async function warmEautomateCookieFromLogin() {
  if (!loginConfigured()) return;
  const has =
    process.env.EAUTOMATE_COOKIE?.trim() || process.env.EAUTOMATE_BEARER_TOKEN?.trim();
  if (!has) await refreshEautomateSessionFromLogin();
}

function mergeHeaders(init = {}) {
  const h = new Headers();
  h.set("Accept", "application/json");
  const token = process.env.EAUTOMATE_BEARER_TOKEN;
  if (token) h.set("Authorization", `Bearer ${token}`);
  const cookie = process.env.EAUTOMATE_COOKIE;
  if (cookie) h.set("Cookie", cookie);
  const extra = init.headers;
  if (extra) {
    if (typeof Headers !== "undefined" && extra instanceof Headers) {
      extra.forEach((v, k) => {
        if (v != null && v !== "") h.set(k, v);
      });
    } else if (Array.isArray(extra)) {
      for (const [k, v] of extra) {
        if (v != null && v !== "") h.set(k, String(v));
      }
    } else if (typeof extra === "object") {
      for (const [k, v] of Object.entries(extra)) {
        if (v != null && v !== "") h.set(k, String(v));
      }
    }
  }
  return h;
}

/**
 * @param {string} url
 * @param {RequestInit} [init]
 */
export async function fetchEautomate(url, init = {}) {
  await warmEautomateCookieFromLogin();
  const run = () =>
    fetch(url, {
      ...init,
      headers: mergeHeaders(init),
    });
  let res = await run();
  if (res.status === 401 && loginConfigured()) {
    await res.clone().text().catch(() => "");
    if (await refreshEautomateSessionFromLogin()) res = await run();
  }
  return res;
}
