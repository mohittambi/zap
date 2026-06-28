/**
 * Insights / Decision Intelligence API tests.
 * Requires: npm run dev and migrated DB (074_decision_intelligence.sql).
 * Run: TEST_BASE_URL=http://localhost:3001 npm run test:api -- tests/api/insights-integration.test.mjs
 */
import { describe, it, before } from "node:test";
import assert from "node:assert";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
let adminToken = "";
let viewerToken = "";

async function jsonOrNull(response) {
  const ct = response.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return null;
  return response.json().catch(() => null);
}

async function login(email, password) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (r.status !== 200) return "";
  return (await jsonOrNull(r))?.token ?? "";
}

async function api(path, opts = {}, token = adminToken) {
  return fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      ...(opts.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

before(async () => {
  adminToken = await login("admin@example.com", "admin123");
  viewerToken = await login("viewer@example.com", "viewer123");
});

describe("Insights API", () => {
  it("GET /api/insights returns 401 without auth", async () => {
    const r = await api("/api/insights", {}, "");
    if (r.status === 503) return;
    assert.strictEqual(r.status, 401);
  });

  it("GET /api/insights returns 403 for non-admin viewer", async () => {
    if (!viewerToken) return;
    const r = await api("/api/insights", {}, viewerToken);
    if (r.status === 503) return;
    assert.strictEqual(r.status, 403);
  });

  it("GET /api/insights worklist shape for admin", async () => {
    if (!adminToken) return;
    const r = await api("/api/insights?page=1&count=10");
    if (r.status === 503) return;
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(Array.isArray(j.content));
    assert.ok(typeof j.total === "number");
  });

  it("GET /api/insights/summary shape for admin", async () => {
    if (!adminToken) return;
    const r = await api("/api/insights/summary");
    if (r.status === 503) return;
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.insight_counts);
    assert.ok(j.home_kpis);
  });

  it("GET /api/insights/segmentation returns matrix and segments", async () => {
    if (!adminToken) return;
    const r = await api("/api/insights/segmentation?limit=5");
    if (r.status === 503) return;
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.matrix);
    assert.ok(Array.isArray(j.segments));
  });

  it("GET /api/insights/forecast/[skuId] returns forecast bundle shape", async () => {
    if (!adminToken) return;
    const listR = await api("/api/insights?page=1&count=1");
    if (listR.status !== 200) return;
    const list = await listR.json();
    const skuInsight = (list.content ?? []).find((row) => row.entity?.type === "SKU");
    const skuId = skuInsight?.entity?.id;
    if (!skuId) return;

    const r = await api(`/api/insights/forecast/${encodeURIComponent(skuId)}`);
    if (r.status === 503) return;
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.forecast);
    assert.ok(typeof j.forecast.method === "string");
    assert.ok(j.smart_reorder);
  });

  it("POST /api/insights/digest rejects wrong bearer", async () => {
    const r = await fetch(`${BASE}/api/insights/digest`, {
      method: "POST",
      headers: { Authorization: "Bearer wrong-token" },
    });
    if (r.status === 503) return;
    assert.ok(r.status === 401 || r.status === 403);
  });

  it("feedback suppression removes dismissed insight from worklist", async () => {
    if (!adminToken) return;
    const listR = await api("/api/insights?page=1&count=5");
    if (listR.status !== 200) return;
    const list = await listR.json();
    const first = list.content?.[0];
    if (!first?.insight_key) return;

    const fbR = await api("/api/insights/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        insight_key: first.insight_key,
        action: "DISMISSED",
      }),
    });
    assert.strictEqual(fbR.status, 200);

    const afterR = await api("/api/insights?page=1&count=50");
    const after = await afterR.json();
    assert.ok(
      !(after.content ?? []).some((row) => row.insight_key === first.insight_key),
      "dismissed insight should be suppressed"
    );
  });
});
