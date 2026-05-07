/**
 * Integration tests for the inbound GRN debit-note lifecycle.
 * Requires a running Next.js server: npm run dev
 * Set TEST_BASE_URL to point at a deployed URL if needed.
 *
 * Tests are designed to be non-destructive where possible.
 * GRN close and debit-note generation DO mutate state — run against
 * a test / staging DB (TEST_DATABASE_URL).
 */
import { describe, it, before } from "node:test";
import assert from "node:assert";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
let token = "";

// ── helpers ──────────────────────────────────────────────────────────────────

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

// ── setup ────────────────────────────────────────────────────────────────────

before(async () => { token = await getToken(); });

// ── auth guard ───────────────────────────────────────────────────────────────

describe("Debit-note auth guard", () => {
  it("GET /api/inbound/grns/1/debit-note returns 401 without auth", async () => {
    const r = await fetch(`${BASE}/api/inbound/grns/1/debit-note`);
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 401);
  });
});

// ── GRN close ─────────────────────────────────────────────────────────────────

describe("GRN close", () => {
  it("POST /close on non-existent GRN returns 404", async () => {
    if (!token) return skip("login failed");
    const r = await api("/api/inbound/grns/999999999/close", { method: "POST" });
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 404);
  });

  it("POST /close on already-CLOSED GRN returns 409", async () => {
    if (!token) return skip("login failed");
    // Find a CLOSED GRN to test idempotency guard
    const listR = await api("/api/inbound/grns?status=CLOSED&page=1&count=1");
    if (listR.status !== 200) return skip("cannot list GRNs");
    const list = await listR.json();
    const grn = list.content?.[0] ?? list[0];
    if (!grn) return skip("no CLOSED GRN in DB");

    const r = await api(`/api/inbound/grns/${grn.grn_id}/close`, { method: "POST" });
    assert.strictEqual(r.status, 409);
  });
});

// ── Debit note generation ─────────────────────────────────────────────────────

describe("Debit note — GET existing", () => {
  it("GET /debit-note on non-existent GRN returns 404", async () => {
    if (!token) return skip("login failed");
    const r = await api("/api/inbound/grns/999999999/debit-note");
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 404);
  });

  it("GET /debit-note?preview=1 returns lines array", async () => {
    if (!token) return skip("login failed");
    // Find any GRN with audit data
    const listR = await api("/api/inbound/grns?page=1&count=5");
    if (listR.status !== 200) return skip("cannot list GRNs");
    const list = await listR.json();
    const grns = list.content ?? list ?? [];
    if (!grns.length) return skip("no GRNs in DB");

    for (const grn of grns) {
      const r = await api(`/api/inbound/grns/${grn.grn_id}/debit-note?preview=1`);
      if (r.status === 200) {
        const body = await r.json();
        assert.ok(Array.isArray(body.lines), "preview should have lines array");
        return;
      }
    }
    skip("no GRN with audit data found");
  });
});

// ── DN number assignment validation ──────────────────────────────────────────

describe("DN number assignment", () => {
  it("PATCH with empty dn_number returns 400", async () => {
    if (!token) return skip("login failed");
    // Find any GRN that has a debit note
    const listR = await api("/api/inbound/grns?page=1&count=10");
    if (listR.status !== 200) return skip("cannot list GRNs");
    const list = await listR.json();
    const grns = list.content ?? list ?? [];

    for (const grn of grns) {
      const noteR = await api(`/api/inbound/grns/${grn.grn_id}/debit-note`);
      if (noteR.status === 200) {
        const r = await api(`/api/inbound/grns/${grn.grn_id}/debit-note`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dn_number: "   " }),
        });
        assert.strictEqual(r.status, 400);
        return;
      }
    }
    skip("no GRN with debit note found");
  });

  it("PATCH on CLOSED debit note returns 409", async () => {
    if (!token) return skip("login failed");
    const listR = await api("/api/inbound/grns?page=1&count=20");
    if (listR.status !== 200) return skip("cannot list GRNs");
    const list = await listR.json();
    const grns = list.content ?? list ?? [];

    for (const grn of grns) {
      const noteR = await api(`/api/inbound/grns/${grn.grn_id}/debit-note`);
      if (noteR.status === 200) {
        const note = await noteR.json();
        if (note.status === "CLOSED") {
          const r = await api(`/api/inbound/grns/${grn.grn_id}/debit-note`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dn_number: "TEST-DN-999" }),
          });
          assert.strictEqual(r.status, 409);
          return;
        }
      }
    }
    skip("no CLOSED debit note found");
  });
});

// ── closeDnDemand precondition check ─────────────────────────────────────────

describe("closeDnDemand preconditions", () => {
  it("PATCH { close: true } on DRAFT note (no DN number) returns 400", async () => {
    if (!token) return skip("login failed");
    const listR = await api("/api/inbound/grns?page=1&count=20");
    if (listR.status !== 200) return skip("cannot list GRNs");
    const list = await listR.json();
    const grns = list.content ?? list ?? [];

    for (const grn of grns) {
      const noteR = await api(`/api/inbound/grns/${grn.grn_id}/debit-note`);
      if (noteR.status === 200) {
        const note = await noteR.json();
        if (note.status === "DRAFT" && !note.dn_number) {
          const r = await api(`/api/inbound/grns/${grn.grn_id}/debit-note`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ close: true }),
          });
          assert.strictEqual(r.status, 400);
          return;
        }
      }
    }
    skip("no DRAFT debit note without DN number found");
  });

  it("PATCH { close: true } on already-CLOSED note returns 409", async () => {
    if (!token) return skip("login failed");
    const listR = await api("/api/inbound/grns?page=1&count=20");
    if (listR.status !== 200) return skip("cannot list GRNs");
    const list = await listR.json();
    const grns = list.content ?? list ?? [];

    for (const grn of grns) {
      const noteR = await api(`/api/inbound/grns/${grn.grn_id}/debit-note`);
      if (noteR.status === 200) {
        const note = await noteR.json();
        if (note.status === "CLOSED") {
          const r = await api(`/api/inbound/grns/${grn.grn_id}/debit-note`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ close: true }),
          });
          assert.strictEqual(r.status, 409);
          return;
        }
      }
    }
    skip("no CLOSED debit note found");
  });
});

// ── CN copy — upload preconditions ────────────────────────────────────────────

describe("CN copy upload preconditions", () => {
  it("POST cn-copy on a DRAFT note (no DN number) returns 400", async () => {
    if (!token) return skip("login failed");
    const listR = await api("/api/inbound/grns?page=1&count=20");
    if (listR.status !== 200) return skip("cannot list GRNs");
    const list = await listR.json();
    const grns = list.content ?? list ?? [];

    for (const grn of grns) {
      const noteR = await api(`/api/inbound/grns/${grn.grn_id}/debit-note`);
      if (noteR.status === 200) {
        const note = await noteR.json();
        if (note.status === "DRAFT" && !note.dn_number) {
          const fd = new FormData();
          fd.append("file", new Blob(["test"], { type: "application/pdf" }), "test.pdf");
          const r = await api(`/api/inbound/grns/${grn.grn_id}/debit-note/cn-copy`, {
            method: "POST",
            body: fd,
          });
          // 400 (no DN number) or 501 (storage not configured) are both valid
          assert.ok(r.status === 400 || r.status === 501, `expected 400 or 501, got ${r.status}`);
          return;
        }
      }
    }
    skip("no DRAFT debit note without DN number found");
  });

  it("POST cn-copy on a CLOSED note returns 409", async () => {
    if (!token) return skip("login failed");
    const listR = await api("/api/inbound/grns?page=1&count=20");
    if (listR.status !== 200) return skip("cannot list GRNs");
    const list = await listR.json();
    const grns = list.content ?? list ?? [];

    for (const grn of grns) {
      const noteR = await api(`/api/inbound/grns/${grn.grn_id}/debit-note`);
      if (noteR.status === 200) {
        const note = await noteR.json();
        if (note.status === "CLOSED") {
          const fd = new FormData();
          fd.append("file", new Blob(["test"], { type: "application/pdf" }), "test.pdf");
          const r = await api(`/api/inbound/grns/${grn.grn_id}/debit-note/cn-copy`, {
            method: "POST",
            body: fd,
          });
          assert.strictEqual(r.status, 409);
          return;
        }
      }
    }
    skip("no CLOSED debit note found");
  });
});

// ── CN copy download ──────────────────────────────────────────────────────────

describe("CN copy download", () => {
  it("GET cn-copy on a note with no upload returns 404", async () => {
    if (!token) return skip("login failed");
    const listR = await api("/api/inbound/grns?page=1&count=20");
    if (listR.status !== 200) return skip("cannot list GRNs");
    const list = await listR.json();
    const grns = list.content ?? list ?? [];

    for (const grn of grns) {
      const noteR = await api(`/api/inbound/grns/${grn.grn_id}/debit-note`);
      if (noteR.status === 200) {
        const note = await noteR.json();
        if (!note.cn_copy_file_path) {
          const r = await api(`/api/inbound/grns/${grn.grn_id}/debit-note/cn-copy`);
          assert.strictEqual(r.status, 404);
          return;
        }
      }
    }
    skip("no debit note without CN copy found");
  });

  it("GET cn-copy on a CLOSED note with upload returns 200 or 501", async () => {
    if (!token) return skip("login failed");
    const listR = await api("/api/inbound/grns?page=1&count=20");
    if (listR.status !== 200) return skip("cannot list GRNs");
    const list = await listR.json();
    const grns = list.content ?? list ?? [];

    for (const grn of grns) {
      const noteR = await api(`/api/inbound/grns/${grn.grn_id}/debit-note`);
      if (noteR.status === 200) {
        const note = await noteR.json();
        if (note.cn_copy_file_path) {
          const r = await api(`/api/inbound/grns/${grn.grn_id}/debit-note/cn-copy`);
          // 200 = storage configured, 501 = storage not configured in test env
          assert.ok(r.status === 200 || r.status === 501, `expected 200 or 501, got ${r.status}`);
          if (r.status === 200) {
            const body = await r.json();
            assert.ok(body.url, "should return signed url");
          }
          return;
        }
      }
    }
    skip("no CLOSED debit note with CN copy found");
  });
});

// ── Tally CSV export ──────────────────────────────────────────────────────────

describe("Tally CSV export", () => {
  it("GET /debit-note/export on existing note returns CSV", async () => {
    if (!token) return skip("login failed");
    const listR = await api("/api/inbound/grns?page=1&count=20");
    if (listR.status !== 200) return skip("cannot list GRNs");
    const list = await listR.json();
    const grns = list.content ?? list ?? [];

    for (const grn of grns) {
      const noteR = await api(`/api/inbound/grns/${grn.grn_id}/debit-note`);
      if (noteR.status === 200) {
        const r = await api(`/api/inbound/grns/${grn.grn_id}/debit-note/export?token=${encodeURIComponent(token)}`);
        if (r.status === 503) return skip("server unreachable");
        assert.strictEqual(r.status, 200);
        const ct = r.headers.get("content-type") ?? "";
        assert.ok(ct.includes("csv") || ct.includes("text"), `unexpected content-type: ${ct}`);
        assert.ok(r.headers.get("content-disposition"), "should have Content-Disposition");
        return;
      }
    }
    skip("no GRN with debit note found");
  });
});

// ── Invoice Excel export ──────────────────────────────────────────────────────

describe("Invoice Excel export", () => {
  it("GET /invoice-export returns 200 xlsx", async () => {
    if (!token) return skip("login failed");
    const listR = await api("/api/inbound/grns?page=1&count=20");
    if (listR.status !== 200) return skip("cannot list GRNs");
    const list = await listR.json();
    const grns = list.content ?? list ?? [];

    for (const grn of grns) {
      const r = await api(`/api/inbound/grns/${grn.grn_id}/invoice-export`);
      if (r.status === 200) {
        const ct = r.headers.get("content-type") ?? "";
        assert.ok(ct.includes("spreadsheetml") || ct.includes("xlsx"), `unexpected content-type: ${ct}`);
        assert.ok(r.headers.get("content-disposition"), "should have Content-Disposition");
        return;
      }
    }
    skip("no GRN with invoice export data found");
  });
});
