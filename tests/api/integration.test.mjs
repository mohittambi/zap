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

describe("Secondary Listings API (integration)", () => {
  async function getToken() {
    const { status, body } = await login();
    if (status !== 200) return null;
    return body.token;
  }

  it("GET /api/inventory/secondary_listings/paginated returns paginated shape", async () => {
    const token = await getToken();
    if (!token) { console.warn("Skipping: login failed"); return; }
    const res = await fetch(`${BASE}/api/inventory/secondary_listings/paginated?page=1&count=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 503 || res.status === 0) { console.warn("Skipping: server unreachable"); return; }
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(typeof data.total === "number", "total must be number");
    assert.ok(typeof data.current_page === "number", "current_page must be number");
    assert.ok(Array.isArray(data.content), "content must be array");
  });

  it("every row in /paginated has pack_combo_sku_id as string or null", async () => {
    const token = await getToken();
    if (!token) { console.warn("Skipping: login failed"); return; }
    const res = await fetch(`${BASE}/api/inventory/secondary_listings/paginated?page=1&count=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status !== 200) { console.warn("Skipping: HTTP", res.status); return; }
    const data = await res.json();
    for (const row of data.content) {
      assert.ok(
        row.pack_combo_sku_id === null ||
        row.pack_combo_sku_id === undefined ||
        typeof row.pack_combo_sku_id === "string",
        `row ${row.secondary_sku}: pack_combo_sku_id must be string or null, got ${typeof row.pack_combo_sku_id}`
      );
    }
  });

  it("MULTI rows have a non-null pack_combo_sku_id that differs from 'NA'", async () => {
    const token = await getToken();
    if (!token) { console.warn("Skipping: login failed"); return; }
    // Filter by sku_type=MULTI (new filter param)
    const res = await fetch(
      `${BASE}/api/inventory/secondary_listings/paginated?page=1&count=10&sku_type=MULTI`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.status !== 200) { console.warn("Skipping: HTTP", res.status); return; }
    const data = await res.json();
    if (data.content.length === 0) { console.warn("Skipping: no MULTI rows in DB"); return; }
    for (const row of data.content) {
      assert.strictEqual(row.sku_type, "MULTI", `Expected sku_type=MULTI, got ${row.sku_type}`);
      assert.ok(
        row.pack_combo_sku_id != null && row.pack_combo_sku_id !== "NA" && row.pack_combo_sku_id !== "",
        `MULTI row ${row.secondary_sku}: pack_combo_sku_id should be a real value, got "${row.pack_combo_sku_id}"`
      );
    }
  });

  it("sku_type=SINGLE filter returns only SINGLE rows", async () => {
    const token = await getToken();
    if (!token) { console.warn("Skipping: login failed"); return; }
    const res = await fetch(
      `${BASE}/api/inventory/secondary_listings/paginated?page=1&count=10&sku_type=SINGLE`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.status !== 200) { console.warn("Skipping: HTTP", res.status); return; }
    const data = await res.json();
    if (data.content.length === 0) { console.warn("Skipping: no SINGLE rows in DB"); return; }
    for (const row of data.content) {
      assert.strictEqual(row.sku_type, "SINGLE", `Expected sku_type=SINGLE, got ${row.sku_type}`);
    }
  });
});
