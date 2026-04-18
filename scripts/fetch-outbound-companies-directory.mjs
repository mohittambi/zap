#!/usr/bin/env node
/**
 * Sync (optional) + fetch the same outbound company directory the mobile app uses:
 * `GET /api/outbound/companies` with pagination, including `summary` rollups.
 *
 * Prerequisites:
 *   - Next app reachable (e.g. `npm run dev` or `npm run start`)
 *   - Companies + outbound PO data in Postgres for rollups (run eAutomate syncs as needed)
 *
 * Auth:
 *   - `ZAP_TOKEN` — Bearer JWT (if missing or rejected with 401, password login is used when set)
 *   - `ZAP_EMAIL` + `ZAP_PASSWORD` — POST /api/auth/login (or `AUTH_EMAIL` / `AUTH_PASSWORD`)
 *   - **Local dev only** (`localhost` / `127.0.0.1`): if no token and no env pair above, uses RBAC seed admin
 *     `admin@example.com` / `admin123` (same as `npm run seed` + integration tests). Override with
 *     `ZAP_LOCAL_LOGIN_EMAIL` / `ZAP_LOCAL_LOGIN_PASSWORD` or set `ZAP_EMAIL`+`ZAP_PASSWORD`.
 *
 * Env:
 *   - `ZAP_API_URL` — base URL (default `http://localhost:3000`, alias `TEST_BASE_URL`)
 *
 * Usage:
 *   cd web && node scripts/fetch-outbound-companies-directory.mjs
 *   ZAP_API_URL=https://your-zap.vercel.app ZAP_TOKEN=... node scripts/fetch-outbound-companies-directory.mjs
 *   node scripts/fetch-outbound-companies-directory.mjs --search=acme --count=50
 *   node scripts/fetch-outbound-companies-directory.mjs --sync-first
 *   node scripts/fetch-outbound-companies-directory.mjs --json-out /tmp/outbound-companies.json
 *
 * npm: `npm run fetch:outbound-companies -- --sync-first`
 */
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  const dotenv = await import("dotenv");
  const root = path.join(__dirname, "..");
  dotenv.default.config({ path: path.join(root, ".env.local") });
  dotenv.default.config({ path: path.join(root, ".env") });
} catch {
  /* optional */
}

function parseArgs(argv) {
  let search = "";
  let count = 100;
  let jsonOut = null;
  let syncFirst = false;
  for (const a of argv) {
    if (a.startsWith("--search=")) {
      search = a.slice("--search=".length);
    } else if (a.startsWith("--count=")) {
      count = Math.min(200, Math.max(1, parseInt(a.slice("--count=".length), 10) || 100));
    } else if (a.startsWith("--json-out=")) {
      jsonOut = a.slice("--json-out=".length);
    } else if (a === "--sync-first") {
      syncFirst = true;
    }
  }
  return { search, count, jsonOut, syncFirst };
}

function isLocalApiBase(base) {
  try {
    const u = new URL(base);
    return (
      u.hostname === "localhost" ||
      u.hostname === "127.0.0.1" ||
      u.hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

/**
 * Password login credentials for POST /api/auth/login.
 * Remote URLs require explicit env; localhost falls back to RBAC seed admin (see README / seeds/001_rbac_seed.sql).
 */
function getLoginCredentials(base) {
  let email = process.env.ZAP_EMAIL?.trim() || process.env.AUTH_EMAIL?.trim();
  let password = process.env.ZAP_PASSWORD ?? process.env.AUTH_PASSWORD;
  if (!email || password == null || String(password) === "") {
    const testEmail = process.env.TEST_USER_EMAIL?.trim();
    const testPassword = process.env.TEST_USER_PASSWORD;
    if (testEmail && testPassword != null && String(testPassword) !== "") {
      email = testEmail;
      password = String(testPassword);
    }
  }
  if (!email || password == null || String(password) === "") {
    if (base && isLocalApiBase(base)) {
      email = process.env.ZAP_LOCAL_LOGIN_EMAIL?.trim() || "admin@example.com";
      password = process.env.ZAP_LOCAL_LOGIN_PASSWORD ?? "admin123";
      return {
        email,
        password: String(password),
        usedLocalSeedDefaults: true,
      };
    }
    return null;
  }
  return { email, password: String(password), usedLocalSeedDefaults: false };
}

async function postLogin(base, creds) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: creds.email, password: creds.password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`Login HTTP ${res.status}`, body?.error ?? body);
    process.exit(1);
  }
  if (!body.token) {
    console.error("Login response missing token", body);
    process.exit(1);
  }
  return body.token;
}

/** Prefer env JWT; otherwise password login. */
async function resolveInitialToken(base) {
  const direct = process.env.ZAP_TOKEN?.trim();
  if (direct) {
    return direct;
  }
  const creds = getLoginCredentials(base);
  if (!creds) {
    console.error(
      "Set ZAP_TOKEN, or ZAP_EMAIL + ZAP_PASSWORD (or AUTH_EMAIL + AUTH_PASSWORD) for /api/auth/login. " +
        "(For localhost only, seed admin admin@example.com/admin123 is used automatically — run npm run seed.)"
    );
    process.exit(1);
  }
  if (creds.usedLocalSeedDefaults) {
    console.warn(
      "[fetch-outbound-companies] No ZAP_TOKEN / ZAP_EMAIL in env — using local seed admin (admin@example.com). " +
        "Set ZAP_EMAIL+ZAP_PASSWORD when calling a non-local API."
    );
  }
  return postLogin(base, creds);
}

async function fetchCompaniesPageOnce(base, token, page, perPage, search) {
  const q = new URLSearchParams({
    page: String(page),
    count: String(perPage),
  });
  if (search.trim()) {
    q.set("search", search.trim());
  }
  const res = await fetch(`${base}/api/outbound/companies?${q.toString()}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { status: res.status, ok: false, json: null, parseError: text.slice(0, 400) };
  }
  return { status: res.status, ok: res.ok, json, parseError: null };
}

/**
 * Fetches one page; on 401 attempts password login once (same pattern as eAutomate proxy refresh).
 * @param {{ current: string }} tokenRef
 */
async function fetchCompaniesPage(base, tokenRef, page, perPage, search) {
  let result = await fetchCompaniesPageOnce(base, tokenRef.current, page, perPage, search);
  if (result.parseError != null) {
    console.error(`Non-JSON response HTTP ${result.status}:`, result.parseError);
    process.exit(1);
  }
  if (result.status === 401) {
    const creds = getLoginCredentials(base);
    if (!creds) {
      console.error(
        "[fetch-outbound-companies] HTTP 401 — token invalid or expired. Set ZAP_EMAIL + ZAP_PASSWORD (or AUTH_EMAIL + AUTH_PASSWORD) to obtain a fresh token via /api/auth/login."
      );
      process.exit(1);
    }
    console.warn("[fetch-outbound-companies] HTTP 401 — logging in with password credentials…");
    tokenRef.current = await postLogin(base, creds);
    result = await fetchCompaniesPageOnce(base, tokenRef.current, page, perPage, search);
    if (result.parseError != null) {
      console.error(`Non-JSON response HTTP ${result.status}:`, result.parseError);
      process.exit(1);
    }
    if (result.status === 401) {
      console.error("[fetch-outbound-companies] Still HTTP 401 after login.");
      process.exit(1);
    }
  }
  if (!result.ok) {
    console.error(`HTTP ${result.status}`, result.json?.error ?? result.json);
    process.exit(1);
  }
  return result.json;
}

function runSyncCompaniesFirst(webRoot) {
  console.log("[fetch-outbound-companies] Running npm run sync:outbound-companies …");
  const r = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "sync:outbound-companies"], {
    cwd: webRoot,
    stdio: "inherit",
    env: process.env,
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

async function main() {
  const { search, count, jsonOut, syncFirst } = parseArgs(process.argv.slice(2));
  const base = (
    process.env.ZAP_API_URL ||
    process.env.TEST_BASE_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");

  const webRoot = path.join(__dirname, "..");
  if (syncFirst) {
    runSyncCompaniesFirst(webRoot);
  }

  const tokenRef = { current: await resolveInitialToken(base) };

  const content = [];
  let summary = null;
  let total = 0;
  let page = 1;
  let pagesFetched = 0;

  for (;;) {
    const data = await fetchCompaniesPage(base, tokenRef, page, count, search);
    pagesFetched += 1;
    if (summary == null && data.summary != null) {
      summary = data.summary;
    }
    if (typeof data.total === "number") {
      total = data.total;
    }
    const chunk = Array.isArray(data.content) ? data.content : [];
    content.push(...chunk);
    if (chunk.length === 0) {
      break;
    }
    if (total > 0 && content.length >= total) {
      break;
    }
    if (chunk.length < count) {
      break;
    }
    page += 1;
  }

  const out = {
    meta: {
      base,
      search: search || null,
      per_page: count,
      pages_fetched: pagesFetched,
    },
    summary,
    total,
    company_count_loaded: content.length,
    content,
  };

  console.log("=== Outbound companies directory (API) ===");
  console.log("Base:", base);
  if (search) {
    console.log("Search:", search);
  }
  if (summary && typeof summary === "object") {
    console.log("Summary (rollups, same filters as list):");
    console.log(
      JSON.stringify(
        {
          company_count: summary.company_count,
          ack_pending: summary.ack_pending,
          open_pos: summary.open_pos,
          expired_pos: summary.expired_pos,
          cancelled_pos: summary.cancelled_pos,
          last_po_at: summary.last_po_at,
        },
        null,
        2
      )
    );
  } else {
    console.log("(No `summary` in response — deploy API that returns directory summary.)");
  }
  console.log(`Total companies (reported): ${total}`);
  console.log(`Rows loaded into this run: ${content.length}`);
  if (jsonOut) {
    fs.writeFileSync(jsonOut, JSON.stringify(out, null, 2), "utf8");
    console.log("Wrote:", path.resolve(jsonOut));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
