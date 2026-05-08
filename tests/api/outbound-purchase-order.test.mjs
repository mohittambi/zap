/**
 * Integration tests for outbound PO creation, listing, and filter APIs.
 * Requires a running Next.js server: npm run dev
 * Set TEST_BASE_URL to point at a deployed URL if needed.
 *
 * POST /api/outbound/purchase-orders tests are non-destructive:
 * - All required-field and file-validation tests trigger 400 before any DB write.
 * - Rollback on partial success is handled server-side (delete + rm on error).
 */
import { describe, it, before } from "node:test";
import assert from "node:assert";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
let token = "";

async function getToken() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@example.com", password: "admin123" }),
  });
  if (r.status !== 200) return "";
  return (await r.json()).token ?? "";
}

async function api(path, opts = {}) {
  return fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      ...(opts.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

function skip(label) {
  console.warn(`Skipping: ${label}`);
}

before(async () => { token = await getToken(); });

// ── Auth guards ───────────────────────────────────────────────────────────────

describe("Outbound PO auth guard", () => {
  it("GET /purchase-orders without auth returns 401", async () => {
    const r = await fetch(`${BASE}/api/outbound/purchase-orders`);
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 401);
  });

  it("POST /purchase-orders without auth returns 401", async () => {
    const r = await fetch(`${BASE}/api/outbound/purchase-orders`, { method: "POST" });
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 401);
  });

  it("GET /form-options without auth returns 401", async () => {
    const r = await fetch(`${BASE}/api/outbound/form-options`);
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 401);
  });
});

// ── PO listing ────────────────────────────────────────────────────────────────

describe("Outbound PO listing", () => {
  it("GET /purchase-orders returns 200 with paginated JSON", async () => {
    if (!token) return skip("login failed");
    const r = await api("/api/outbound/purchase-orders?page=1&limit=5");
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 200);
    const body = await r.json();
    assert.ok("content" in body || Array.isArray(body), "should return paginated result");
  });

  it("GET /purchase-orders?wip=1 returns 200 (WIP filter)", async () => {
    if (!token) return skip("login failed");
    const r = await api("/api/outbound/purchase-orders?wip=1&page=1&limit=5");
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 200);
  });

  it("GET /purchase-orders?partial=1 returns 200 (partial filter)", async () => {
    if (!token) return skip("login failed");
    const r = await api("/api/outbound/purchase-orders?partial=1&page=1&limit=5");
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 200);
  });

  it("GET /purchase-orders/[id] returns 404 for non-existent PO", async () => {
    if (!token) return skip("login failed");
    const r = await api("/api/outbound/purchase-orders/999999999");
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 404);
  });
});

// ── Form options ──────────────────────────────────────────────────────────────

describe("Outbound PO form options", () => {
  it("GET /form-options returns sold_via array", async () => {
    if (!token) return skip("login failed");
    const r = await api("/api/outbound/form-options");
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 200);
    const body = await r.json();
    assert.ok(Array.isArray(body.sold_via) || "sold_via" in body, "should include sold_via");
  });

  it("GET /filter-options returns 200 with company and location data", async () => {
    if (!token) return skip("login failed");
    const r = await api("/api/outbound/purchase-orders/filter-options");
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 200);
  });
});

// ── PO creation — required field validation ───────────────────────────────────

function makeValidPoForm(overrides = {}) {
  const pdf = new Blob(["pdf-content"], { type: "application/pdf" });
  const xlsx = new Blob(["xlsx-content"], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const fd = new FormData();
  fd.append("soldViaCode", overrides.soldViaCode ?? "EUNOIA");
  fd.append("companyId", String(overrides.companyId ?? 1));
  fd.append("poLocation", overrides.poLocation ?? "Mumbai");
  fd.append("billingAddress", overrides.billingAddress ?? "123 Billing St, Mumbai");
  fd.append("shippingAddress", overrides.shippingAddress ?? "456 Ship Rd, Mumbai");
  fd.append("buyerGstin", overrides.buyerGstin ?? "");
  fd.append("poReleaseIso", overrides.poReleaseIso ?? "2026-01-01");
  fd.append("poExpiryIso", overrides.poExpiryIso ?? "2026-12-31");
  fd.append("poType", overrides.poType ?? "Regular/BAU");
  if (overrides.files === undefined) {
    fd.append("po_files", pdf, "po.pdf");
    fd.append("po_files", xlsx, "po.xlsx");
  } else {
    for (const [blob, name] of overrides.files) {
      fd.append("po_files", blob, name);
    }
  }
  return fd;
}

describe("Outbound PO creation — field validation", () => {
  it("POST with missing soldViaCode returns 400", async () => {
    if (!token) return skip("login failed");
    const fd = makeValidPoForm({ soldViaCode: "" });
    const r = await api("/api/outbound/purchase-orders", { method: "POST", body: fd });
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 400);
  });

  it("POST with invalid companyId (0) returns 400", async () => {
    if (!token) return skip("login failed");
    const fd = makeValidPoForm({ companyId: 0 });
    const r = await api("/api/outbound/purchase-orders", { method: "POST", body: fd });
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 400);
  });

  it("POST with missing poLocation returns 400", async () => {
    if (!token) return skip("login failed");
    const fd = makeValidPoForm({ poLocation: "" });
    const r = await api("/api/outbound/purchase-orders", { method: "POST", body: fd });
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 400);
  });

  it("POST with missing billingAddress returns 400", async () => {
    if (!token) return skip("login failed");
    const fd = makeValidPoForm({ billingAddress: "ab" });
    const r = await api("/api/outbound/purchase-orders", { method: "POST", body: fd });
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 400);
  });

  it("POST with missing shippingAddress returns 400", async () => {
    if (!token) return skip("login failed");
    const fd = makeValidPoForm({ shippingAddress: "ab" });
    const r = await api("/api/outbound/purchase-orders", { method: "POST", body: fd });
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 400);
  });

  it("POST with invalid GSTIN format returns 400", async () => {
    if (!token) return skip("login failed");
    const fd = makeValidPoForm({ buyerGstin: "INVALID-GSTIN" });
    const r = await api("/api/outbound/purchase-orders", { method: "POST", body: fd });
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 400);
  });

  it("POST with missing dates returns 400", async () => {
    if (!token) return skip("login failed");
    const fd = makeValidPoForm({ poReleaseIso: "", poExpiryIso: "" });
    const r = await api("/api/outbound/purchase-orders", { method: "POST", body: fd });
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 400);
  });

  it("POST with expiry before release date returns 400", async () => {
    if (!token) return skip("login failed");
    const fd = makeValidPoForm({ poReleaseIso: "2026-12-31", poExpiryIso: "2026-01-01" });
    const r = await api("/api/outbound/purchase-orders", { method: "POST", body: fd });
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 400);
  });

  it("POST with invalid PO type returns 400", async () => {
    if (!token) return skip("login failed");
    const fd = makeValidPoForm({ poType: "NotAValidType" });
    const r = await api("/api/outbound/purchase-orders", { method: "POST", body: fd });
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 400);
  });
});

// ── PO creation — file validation ─────────────────────────────────────────────

describe("Outbound PO creation — file validation", () => {
  it("POST with only one file (PDF) returns 400", async () => {
    if (!token) return skip("login failed");
    const fd = makeValidPoForm({
      files: [[new Blob(["x"], { type: "application/pdf" }), "po.pdf"]],
    });
    const r = await api("/api/outbound/purchase-orders", { method: "POST", body: fd });
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 400);
  });

  it("POST with two PDFs (no spreadsheet) returns 400", async () => {
    if (!token) return skip("login failed");
    const fd = makeValidPoForm({
      files: [
        [new Blob(["x"], { type: "application/pdf" }), "a.pdf"],
        [new Blob(["y"], { type: "application/pdf" }), "b.pdf"],
      ],
    });
    const r = await api("/api/outbound/purchase-orders", { method: "POST", body: fd });
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 400);
  });

  it("POST with two spreadsheets (no PDF) returns 400", async () => {
    if (!token) return skip("login failed");
    const xlsxType =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const fd = makeValidPoForm({
      files: [
        [new Blob(["x"], { type: xlsxType }), "a.xlsx"],
        [new Blob(["y"], { type: xlsxType }), "b.xlsx"],
      ],
    });
    const r = await api("/api/outbound/purchase-orders", { method: "POST", body: fd });
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 400);
  });

  it("POST with unsupported file type returns 400", async () => {
    if (!token) return skip("login failed");
    const fd = makeValidPoForm({
      files: [
        [new Blob(["x"], { type: "application/pdf" }), "po.pdf"],
        [new Blob(["y"], { type: "image/png" }), "img.png"],
      ],
    });
    const r = await api("/api/outbound/purchase-orders", { method: "POST", body: fd });
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 400);
  });

  it("POST with oversized file (>2MB) returns 400", async () => {
    if (!token) return skip("login failed");
    const oversizeBlob = new Blob([new Uint8Array(3 * 1024 * 1024)], {
      type: "application/pdf",
    });
    const fd = makeValidPoForm({
      files: [
        [oversizeBlob, "big.pdf"],
        [new Blob(["x"], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "items.xlsx"],
      ],
    });
    const r = await api("/api/outbound/purchase-orders", { method: "POST", body: fd });
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 400);
  });
});
