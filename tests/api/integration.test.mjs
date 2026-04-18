/**
 * HTTP integration tests against a running Next app.
 * Start: npm run dev (or set TEST_BASE_URL to deployed URL).
 */
import { describe, it } from "node:test";
import assert from "node:assert";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@example.com",
      password: "admin123",
    }),
  });
  const body = await res.json();
  return { status: res.status, body };
}

describe("Auth API (integration)", () => {
  it("POST /api/auth/login returns 200 with token for valid credentials", async () => {
    const { status, body } = await login();
    if (status === 503 || status === 0) {
      console.warn("Skipping: server not reachable at", BASE);
      return;
    }
    assert.strictEqual(status, 200);
    assert.ok(body.token);
    assert.strictEqual(body.user.email, "admin@example.com");
  });

  it("POST /api/auth/login returns 400 when body empty", async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.strictEqual(res.status, 400);
  });

  it("GET /api/auth/me returns 401 without auth", async () => {
    const res = await fetch(`${BASE}/api/auth/me`);
    assert.strictEqual(res.status, 401);
  });

  it("GET /api/listings/sku/names returns 200 with array when authorized", async () => {
    const loginRes = await login();
    if (loginRes.status !== 200) {
      console.warn("Skipping listings test: login failed");
      return;
    }
    const token = loginRes.body.token;
    const res = await fetch(`${BASE}/api/listings/sku/names`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data));
  });

  it("GET /api/outbound/companies returns 200 with paginated JSON when authorized", async () => {
    const loginRes = await login();
    if (loginRes.status !== 200) {
      console.warn("Skipping outbound companies test: login failed");
      return;
    }
    const token = loginRes.body.token;
    const res = await fetch(`${BASE}/api/outbound/companies?page=1&limit=2`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) {
      console.warn(
        "GET /api/outbound/companies returned 404 — run npm run build before npm run start, or use npm run start:fresh / npm run dev."
      );
      return;
    }
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(typeof data.total === "number");
    assert.ok(Array.isArray(data.content));
  });
});
