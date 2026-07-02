/**
 * RBAC permission matrix — HTTP integration tests against a running Next app.
 * Prerequisites:
 *   1. npm run dev (or TEST_BASE_URL)
 *   2. psql $DATABASE_URL -f tests/fixtures/rbac_test_users.sql
 */
import { describe, it, before } from "node:test";
import assert from "node:assert";
import {
  BASE,
  RBAC_PASSWORD,
  checkCan,
  expectAllowed,
  expectForbidden,
  isServerReachable,
  loadPermissionRoutes,
  loadTestIds,
  loginAs,
  permissionKey,
  fetchWithAuth,
} from "../helpers/rbac.mjs";

const routes = loadPermissionRoutes();
const ids = loadTestIds();
let serverUp = false;

function uniqueByPermission(entries) {
  const seen = new Set();
  const out = [];
  for (const e of entries) {
    const key = permissionKey(e.resource, e.action);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

const uniqueRoutes = uniqueByPermission(routes);

before(async () => {
  serverUp = await isServerReachable();
  if (!serverUp) {
    console.warn(`Skipping RBAC API matrix: server not reachable at ${BASE}`);
  }
});

describe("RBAC permission matrix", () => {
  for (const entry of uniqueRoutes) {
    const key = permissionKey(entry.resource, entry.action);

    it(`forbids ${key} for ${entry.denyUser}`, async () => {
      if (!serverUp) return;
      const login = await loginAs(entry.denyUser, RBAC_PASSWORD);
      if (login.status !== 200 || !login.token) {
        console.warn(`Skipping forbid ${key}: login failed for ${entry.denyUser} (${login.status})`);
        return;
      }
      await expectForbidden(login.token, entry, ids);
    });

    it(`allows ${key} for ${entry.allowUser}`, async () => {
      if (!serverUp) return;
      const login = await loginAs(entry.allowUser, RBAC_PASSWORD);
      if (login.status !== 200 || !login.token) {
        console.warn(`Skipping allow ${key}: login failed for ${entry.allowUser} (${login.status})`);
        return;
      }
      await expectAllowed(login.token, entry, ids);
    });
  }
});

describe("RBAC admin API", () => {
  it("GET /api/admin/permissions requires admin", async () => {
    if (!serverUp) return;
    const admin = await loginAs("rbac-admin@test.local");
    const ops = await loginAs("rbac-ops@test.local");
    if (!admin.token || !ops.token) {
      console.warn("Skipping admin API test: login failed");
      return;
    }
    const ok = await fetchWithAuth(admin.token, "GET", "/api/admin/permissions");
    assert.notStrictEqual(ok.status, 403);
    const denied = await fetchWithAuth(ops.token, "GET", "/api/admin/permissions");
    assert.strictEqual(denied.status, 403);
  });

  it("PUT admin role permissions returns 400", async () => {
    if (!serverUp) return;
    const admin = await loginAs("rbac-admin@test.local");
    if (!admin.token) return;
    const res = await fetchWithAuth(
      admin.token,
      "PUT",
      "/api/admin/roles/admin/permissions",
      { permissions: [{ resource: "listings", action: "read" }] }
    );
    assert.strictEqual(res.status, 400);
  });
});

describe("RBAC /api/auth/can smoke", () => {
  for (const entry of uniqueRoutes) {
    const key = permissionKey(entry.resource, entry.action);
    it(`${key} can check allow/deny`, async () => {
      if (!serverUp) return;
      const allowLogin = await loginAs(entry.allowUser);
      const denyLogin = await loginAs(entry.denyUser);
      if (!allowLogin.token || !denyLogin.token) return;
      const allow = await checkCan(allowLogin.token, entry.resource, entry.action);
      const deny = await checkCan(denyLogin.token, entry.resource, entry.action);
      if (entry.resource === "*" && entry.action === "*") {
        assert.strictEqual(allow.allowed, true);
        assert.strictEqual(deny.allowed, false);
        return;
      }
      assert.strictEqual(allow.allowed, true, `allow user should have ${key}`);
      assert.strictEqual(deny.allowed, false, `deny user should lack ${key}`);
    });
  }
});
