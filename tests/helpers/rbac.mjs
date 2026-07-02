import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";
export const RBAC_PASSWORD = process.env.RBAC_TEST_PASSWORD || "rbac123";

const tokenCache = new Map();

export function loadPermissionRoutes() {
  const file = path.join(webRoot, "tests/fixtures/rbac-permission-routes.json");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function loadTestIds() {
  const file = path.join(webRoot, "tests/fixtures/rbac_test_ids.json");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function permissionKey(resource, action) {
  return `${resource}:${action}`;
}

export function resolvePath(entry, ids) {
  let p = entry.path ?? "";
  if (entry.fixtureKey && ids[entry.fixtureKey]) {
    p = p.replace(`{{${entry.fixtureKey}}}`, String(ids[entry.fixtureKey]));
  }
  return p;
}

export async function isServerReachable() {
  try {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    return res.status !== 0;
  } catch {
    return false;
  }
}

export async function loginAs(email, password = RBAC_PASSWORD) {
  const cacheKey = `${email}:${password}`;
  if (tokenCache.has(cacheKey)) return tokenCache.get(cacheKey);

  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status !== 200 || !body.token) {
    return { status: res.status, token: null, body };
  }
  const out = { status: res.status, token: body.token, body };
  tokenCache.set(cacheKey, out);
  return out;
}

export async function fetchWithAuth(token, method, urlPath, body) {
  const init = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  return fetch(`${BASE}${urlPath}`, init);
}

export async function checkCan(token, resource, action) {
  const res = await fetchWithAuth(
    token,
    "GET",
    `/api/auth/can?resource=${encodeURIComponent(resource)}&action=${encodeURIComponent(action)}`
  );
  const data = await res.json().catch(() => ({}));
  return { status: res.status, allowed: data.allowed === true };
}

export async function expectForbidden(token, entry, ids = loadTestIds()) {
  if (entry.authCanOnly) {
    const { allowed } = await checkCan(token, entry.resource, entry.action);
    assert.strictEqual(allowed, false, `${permissionKey(entry.resource, entry.action)} should be denied via /auth/can`);
    return;
  }
  const urlPath = resolvePath(entry, ids);
  if (entry.elevated && entry.fixtureKey && !ids[entry.fixtureKey]) {
    return { skipped: true, reason: `missing fixture ${entry.fixtureKey}` };
  }
  const res = await fetchWithAuth(token, entry.method, urlPath, entry.body);
  assert.strictEqual(
    res.status,
    entry.forbiddenStatus ?? 403,
    `${entry.method} ${urlPath} expected 403 for ${permissionKey(entry.resource, entry.action)}, got ${res.status}`
  );
  return { status: res.status };
}

export async function expectAllowed(token, entry, ids = loadTestIds()) {
  if (entry.authCanOnly) {
    const { allowed } = await checkCan(token, entry.resource, entry.action);
    assert.strictEqual(allowed, true, `${permissionKey(entry.resource, entry.action)} should be allowed via /auth/can`);
    return;
  }
  const urlPath = resolvePath(entry, ids);
  if (entry.elevated && entry.fixtureKey && !ids[entry.fixtureKey]) {
    return { skipped: true, reason: `missing fixture ${entry.fixtureKey}` };
  }
  const res = await fetchWithAuth(token, entry.method, urlPath, entry.body);
  assert.notStrictEqual(
    res.status,
    403,
    `${entry.method} ${urlPath} should not be 403 for ${permissionKey(entry.resource, entry.action)}, got ${res.status}`
  );
  return { status: res.status };
}
