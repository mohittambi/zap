/**
 * eAutomate session refresh via POST /public/api/login (userId + password).
 * Sets process.env.EAUTOMATE_COOKIE to access_token + id_token for subsequent API calls.
 *
 * Env:
 *   EAUTOMATE_LOGIN_USER_ID — e.g. Sales.saumya.agarwal
 *   EAUTOMATE_LOGIN_PASSWORD
 *   EAUTOMATE_LOGIN_URL — optional full URL (default {EAUTOMATE_BASE_URL}/public/api/login)
 *   EAUTOMATE_LOGIN_PATH — optional path if base is standard (default /public/api/login)
 *   EAUTOMATE_WRITE_AUTH_TO_ENV_LOCAL=1 — after successful login, upsert EAUTOMATE_COOKIE (and login vars) into .env.local
 *   EAUTOMATE_ENV_FILE — optional path to env file (default <cwd>/.env.local)
 */

function eautomateBase(): string {
  return (process.env.EAUTOMATE_BASE_URL || "https://web.eautomate.in").replace(/\/$/, "");
}

export function eautomateLoginConfigured(): boolean {
  return Boolean(
    process.env.EAUTOMATE_LOGIN_USER_ID?.trim() && process.env.EAUTOMATE_LOGIN_PASSWORD
  );
}

export function buildEautomateCookieHeader(accessToken: string, idToken: string): string {
  return `access_token=${accessToken}; id_token=${idToken}`;
}

async function persistAuthToEnvLocalOptional(): Promise<void> {
  if (process.env.EAUTOMATE_WRITE_AUTH_TO_ENV_LOCAL !== "1") return;
  try {
    const { pathToFileURL } = await import("node:url");
    const { join } = await import("node:path");
    const mod = await import(
      pathToFileURL(join(process.cwd(), "scripts/lib/persist-eautomate-dotenv.mjs")).href
    );
    mod.persistEautomateAuthAfterLoginIfEnabled();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[eautomate-session] Could not persist auth to .env.local:", msg);
  }
}

function resolveLoginUrl(): string {
  const full = process.env.EAUTOMATE_LOGIN_URL?.trim();
  if (full) return full.replace(/\/$/, "");
  const path = process.env.EAUTOMATE_LOGIN_PATH?.trim() || "/public/api/login";
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${eautomateBase()}${p}`;
}

/**
 * POST login and assign EAUTOMATE_COOKIE from response token + id_token.
 * @returns true if cookie was updated
 */
export async function refreshEautomateSessionFromLogin(): Promise<boolean> {
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
    signal: AbortSignal.timeout(15_000),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`[eautomate-session] login HTTP ${res.status}: ${text.slice(0, 400)}`);
    return false;
  }

  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    console.error("[eautomate-session] login response is not JSON");
    return false;
  }

  const o = json as Record<string, unknown>;
  const access = typeof o.token === "string" ? o.token : null;
  const idTok = typeof o.id_token === "string" ? o.id_token : null;
  if (!access || !idTok) {
    console.error("[eautomate-session] login JSON missing token or id_token");
    return false;
  }

  process.env.EAUTOMATE_COOKIE = buildEautomateCookieHeader(access, idTok);
  await persistAuthToEnvLocalOptional();
  return true;
}

/** If login is configured but no cookie/bearer yet, obtain cookie once. */
export async function warmEautomateCookieFromLogin(): Promise<void> {
  if (!eautomateLoginConfigured()) return;
  const has =
    process.env.EAUTOMATE_COOKIE?.trim() || process.env.EAUTOMATE_BEARER_TOKEN?.trim();
  if (!has) await refreshEautomateSessionFromLogin();
}
