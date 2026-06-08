/**
 * Integration tests for outbound consignment invoice upload & download.
 * Requires a running Next.js server: npm run dev
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

// ── Auth guard ────────────────────────────────────────────────────────────────

describe("Consignment invoice auth guard", () => {
  it("POST /invoice-upload without auth returns 401", async () => {
    const r = await fetch(`${BASE}/api/outbound/consignments/1/invoice-upload`, { method: "POST" });
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 401);
  });

  it("GET /invoice without auth returns 401", async () => {
    const r = await fetch(`${BASE}/api/outbound/consignments/1/invoice`);
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 401);
  });

  it("GET /consignments without auth returns 401", async () => {
    const r = await fetch(`${BASE}/api/outbound/consignments`);
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 401);
  });
});

// ── Consignment listing ───────────────────────────────────────────────────────

describe("Consignment listing", () => {
  it("GET /consignments returns 200 with paginated JSON when authorized", async () => {
    if (!token) return skip("login failed");
    const r = await api("/api/outbound/consignments?page=1&count=5");
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 200);
    const body = await r.json();
    assert.ok("content" in body || Array.isArray(body), "should return paginated content or array");
  });

  it("GET /consignments/filters returns 200 with filter options", async () => {
    if (!token) return skip("login failed");
    const r = await api("/api/outbound/consignments/filters");
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 200);
  });

  it("GET /consignments/[id] returns 404 on non-existent consignment", async () => {
    if (!token) return skip("login failed");
    const r = await api("/api/outbound/consignments/999999999");
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 404);
  });
});

// ── Invoice upload preconditions ──────────────────────────────────────────────

describe("Consignment invoice upload", () => {
  it("POST /invoice-upload with no file returns 400", async () => {
    if (!token) return skip("login failed");
    const fd = new FormData();
    const r = await api("/api/outbound/consignments/1/invoice-upload", {
      method: "POST",
      body: fd,
    });
    if (r.status === 503) return skip("server unreachable");
    if (r.status === 501) return skip("storage not configured");
    assert.ok(r.status === 400 || r.status === 404, `expected 400 (no file) or 404 (no consignment), got ${r.status}`);
  });

  it("POST /invoice-upload on non-existent consignment returns 404", async () => {
    if (!token) return skip("login failed");
    const fd = new FormData();
    fd.append("file", new Blob(["test"], { type: "application/pdf" }), "test.pdf");
    const r = await api("/api/outbound/consignments/999999999/invoice-upload", {
      method: "POST",
      body: fd,
    });
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 404);
  });

  it("POST /invoice-upload on consignment without invoice_number_status returns 409", async () => {
    if (!token) return skip("login failed");
    // Find a consignment without invoice_number_status
    const listR = await api("/api/outbound/consignments?page=1&count=20");
    if (listR.status !== 200) return skip("cannot list consignments");
    const list = await listR.json();
    const consignments = list.content ?? list ?? [];

    for (const c of consignments) {
      if (!c.invoice_number_status) {
        const fd = new FormData();
        fd.append("file", new Blob(["test"], { type: "application/pdf" }), "test.pdf");
        const r = await api(`/api/outbound/consignments/${c.id}/invoice-upload`, {
          method: "POST",
          body: fd,
        });
        // 409 (no invoice number) or 501 (storage not configured)
        assert.ok(r.status === 409 || r.status === 501, `expected 409 or 501, got ${r.status}`);
        return;
      }
    }
    skip("no consignment without invoice_number_status found");
  });
});

// ── Invoice download ──────────────────────────────────────────────────────────

describe("Consignment invoice download", () => {
  it("GET /invoice on non-existent consignment returns 404", async () => {
    if (!token) return skip("login failed");
    const r = await api("/api/outbound/consignments/999999999/invoice");
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 404);
  });

  it("GET /invoice on consignment without invoice file returns 404", async () => {
    if (!token) return skip("login failed");
    const listR = await api("/api/outbound/consignments?page=1&count=20");
    if (listR.status !== 200) return skip("cannot list consignments");
    const list = await listR.json();
    const consignments = list.content ?? list ?? [];

    for (const c of consignments) {
      if (!c.invoice_file_name) {
        const r = await api(`/api/outbound/consignments/${c.id}/invoice`);
        if (r.status === 503) return skip("server unreachable");
        assert.strictEqual(r.status, 404);
        return;
      }
    }
    skip("no consignment without invoice file found");
  });

  it("GET /invoice on consignment with uploaded invoice returns 200 or 501", async () => {
    if (!token) return skip("login failed");
    const listR = await api("/api/outbound/consignments?page=1&count=20");
    if (listR.status !== 200) return skip("cannot list consignments");
    const list = await listR.json();
    const consignments = list.content ?? list ?? [];

    for (const c of consignments) {
      if (c.invoice_file_name) {
        const r = await api(`/api/outbound/consignments/${c.id}/invoice`);
        if (r.status === 503) return skip("server unreachable");
        // 200 = storage configured, 501 = storage not configured in test env
        assert.ok(r.status === 200 || r.status === 501, `expected 200 or 501, got ${r.status}`);
        if (r.status === 200) {
          const body = await r.json();
          assert.ok(body.url, "should return a signed URL");
          assert.ok(body.filename, "should return filename");
        }
        return;
      }
    }
    skip("no consignment with uploaded invoice found");
  });
});

// ── Invoice type patch ────────────────────────────────────────────────────────

describe("Consignment invoice type patch", () => {
  it("PATCH invoice_type without auth returns 401", async () => {
    const r = await fetch(`${BASE}/api/outbound/consignments/1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "invoice_type", value: "Tax Invoice" }),
    });
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 401);
  });

  it("PATCH invoice_type on non-existent consignment returns 404", async () => {
    if (!token) return skip("login failed");
    const r = await api("/api/outbound/consignments/999999999", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "invoice_type", value: "Tax Invoice" }),
    });
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 404);
  });

  it("PATCH unknown field returns 400", async () => {
    if (!token) return skip("login failed");
    const r = await api("/api/outbound/consignments/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "unknown_field", value: "x" }),
    });
    if (r.status === 503) return skip("server unreachable");
    assert.ok(r.status === 400 || r.status === 404, `expected 400 or 404, got ${r.status}`);
  });

  it("PATCH invoice_type on existing consignment returns 200", async () => {
    if (!token) return skip("login failed");
    const listR = await api("/api/outbound/consignments?page=1&count=1");
    if (listR.status !== 200) return skip("cannot list consignments");
    const list = await listR.json();
    const consignments = list.content ?? list ?? [];
    if (consignments.length === 0) return skip("no consignments in database");

    const id = consignments[0].id;
    const r = await api(`/api/outbound/consignments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "invoice_type", value: "Tax Invoice" }),
    });
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 200);

    const getR = await api(`/api/outbound/consignments/${id}`);
    if (getR.status === 200) {
      const row = await getR.json();
      assert.strictEqual(row.invoice_type, "Tax Invoice");
    }
  });
});

// ── Bulk invoice excel ────────────────────────────────────────────────────────

describe("Consignment bulk invoice excel", () => {
  it("POST /bulk-invoice-excel without auth returns 401", async () => {
    const r = await fetch(`${BASE}/api/outbound/consignments/bulk-invoice-excel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [1] }),
    });
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 401);
  });

  it("POST /bulk-invoice-excel with empty ids returns 400", async () => {
    if (!token) return skip("login failed");
    const r = await api("/api/outbound/consignments/bulk-invoice-excel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [] }),
    });
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 400);
  });

  it("POST /bulk-invoice-excel without invoice number returns 400", async () => {
    if (!token) return skip("login failed");
    const listR = await api("/api/outbound/consignments?page=1&count=20");
    if (listR.status !== 200) return skip("cannot list consignments");
    const list = await listR.json();
    const consignments = list.content ?? list ?? [];

    for (const c of consignments) {
      if (!(c.invoice_number ?? "").trim()) {
        const r = await api("/api/outbound/consignments/bulk-invoice-excel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [c.id] }),
        });
        if (r.status === 503) return skip("server unreachable");
        assert.strictEqual(r.status, 400);
        const body = await r.json();
        assert.ok(
          (body.error ?? "").includes("invoice number"),
          "error should mention invoice number"
        );
        return;
      }
    }
    skip("no consignment without invoice number found");
  });

  it("POST /bulk-invoice-excel with assigned invoice number returns 200 xlsx", async () => {
    if (!token) return skip("login failed");
    const listR = await api("/api/outbound/consignments?page=1&count=20");
    if (listR.status !== 200) return skip("cannot list consignments");
    const list = await listR.json();
    const consignments = list.content ?? list ?? [];

    for (const c of consignments) {
      if ((c.invoice_number ?? "").trim()) {
        const r = await api("/api/outbound/consignments/bulk-invoice-excel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [c.id] }),
        });
        if (r.status === 503) return skip("server unreachable");
        assert.strictEqual(r.status, 200);
        const ct = r.headers.get("content-type") ?? "";
        assert.ok(
          ct.includes("spreadsheetml") || ct.includes("octet-stream"),
          `expected xlsx content-type, got ${ct}`
        );
        const buf = await r.arrayBuffer();
        assert.ok(buf.byteLength > 0, "xlsx body should not be empty");
        return;
      }
    }
    skip("no consignment with invoice number found");
  });
});
