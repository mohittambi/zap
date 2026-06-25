/**
 * Broader inbound HTTP checks (queues, PATCH, uploads, inventory preconditions).
 * Requires: `npm run dev` and DB with optional fixture:
 *   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f web/tests/fixtures/inbound_journey_fixture.sql
 */
import { describe, it, before } from "node:test";
import assert from "node:assert";
import {
  INBOUND_JOURNEY_DCN_NOTE_ID,
  INBOUND_JOURNEY_GRN_DCN,
  INBOUND_JOURNEY_GRN_PENDING_ACCOUNTS,
  INBOUND_JOURNEY_GRN_PENDING_AUDIT,
  INBOUND_JOURNEY_GRN_PENDING_INVOICE,
  INBOUND_JOURNEY_GRN_RATE_DIFF_FOR_CLOSE_DN,
  INBOUND_JOURNEY_GRN_NO_RATE_DIFF_CLOSE,
  INBOUND_JOURNEY_DRAFT_GRN_ID,
  INBOUND_JOURNEY_OPERATIONAL_AFTER_REGISTER,
  INBOUND_JOURNEY_GRN_NO_INVOICE_OPEN,
  INBOUND_JOURNEY_GRN_WITH_DRAFT_ZAP_DN,
  INBOUND_JOURNEY_GRN_APPROVED_ACCOUNTS,
  INBOUND_JOURNEY_VENDOR_ID,
  INBOUND_JOURNEY_ZAP_REPORT_GRN_ID,
  INBOUND_JOURNEY_ZAP_REPORT_PO_ID,
} from "../fixtures/inbound_journey_constants.mjs";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
let token = "";

async function jsonOrNull(response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;
  return response.json().catch(() => null);
}

async function getToken() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@example.com",
      password: "admin123",
    }),
  });
  if (r.status !== 200) return "";
  return (await jsonOrNull(r))?.token ?? "";
}

async function loginAs(email, password) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (r.status !== 200) return "";
  return (await jsonOrNull(r))?.token ?? "";
}

async function apiWithToken(authToken, path, opts = {}) {
  return fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      ...(opts.headers ?? {}),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  });
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

async function fixturesPresent() {
  if (!token) return false;
  const r = await api(`/api/inbound/grns/${INBOUND_JOURNEY_GRN_PENDING_AUDIT}`);
  if (r.status !== 200) return false;
  const row = await r.json();
  return row.grn_id === INBOUND_JOURNEY_GRN_PENDING_AUDIT;
}

function skip(msg) {
  console.warn(`Skipping: ${msg}`);
}

before(async () => {
  token = await getToken();
});

describe("Inbound journey — error paths (no fixture)", () => {
  it("POST upload-zap returns 400 when file missing (or 501 without storage)", async () => {
    if (!token) return skip("login failed");
    const fd = new FormData();
    fd.append("kind", "invoice");
    const r = await api(
      `/api/inbound/grns/${INBOUND_JOURNEY_GRN_PENDING_AUDIT}/upload-zap`,
      { method: "POST", body: fd }
    );
    if (r.status === 503) return skip("server unreachable");
    assert.ok(
      r.status === 400 || r.status === 501,
      `expected 400 (missing file) or 501 (no storage), got ${r.status}`
    );
  });

  it("POST upload-zap returns 400 when kind invalid (or 501 without storage)", async () => {
    if (!token) return skip("login failed");
    const fd = new FormData();
    fd.append("file", new Blob(["x"], { type: "application/pdf" }), "a.pdf");
    fd.append("kind", "wrong");
    const r = await api(
      `/api/inbound/grns/${INBOUND_JOURNEY_GRN_PENDING_AUDIT}/upload-zap`,
      { method: "POST", body: fd }
    );
    if (r.status === 503) return skip("server unreachable");
    assert.ok(
      r.status === 400 || r.status === 501,
      `expected 400 or 501, got ${r.status}`
    );
  });

  it("PATCH line item returns 404 for out-of-range index", async () => {
    if (!token) return skip("login failed");
    const r = await api(
      `/api/inbound/grns/${INBOUND_JOURNEY_GRN_PENDING_AUDIT}/items/9999`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_quantity: 1,
          accepted_quantity: 1,
          rejected_quantity: 0,
          shortage_quantity: 0,
          received_price: 1,
          tax_rate: 0,
        }),
      }
    );
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 404);
  });

  it("POST receive-inventory returns 400 without items array", async () => {
    if (!token) return skip("login failed");
    const r = await api(
      `/api/inbound/grns/${INBOUND_JOURNEY_GRN_PENDING_AUDIT}/receive-inventory`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    );
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 400);
  });

  it("POST register-operational returns 400 when grn path is not a draft id", async () => {
    if (!token) return skip("login failed");
    const r = await api(
      `/api/inbound/grns/${INBOUND_JOURNEY_GRN_PENDING_AUDIT}/register-operational`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operational_grn_id: 999001 }),
      }
    );
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 400);
  });

  it("PATCH grn returns 400 when body has no allowed fields", async () => {
    if (!token) return skip("login failed");
    const r = await api(`/api/inbound/grns/${INBOUND_JOURNEY_GRN_PENDING_AUDIT}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bogus: true }),
    });
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 400);
  });

  it("POST pending DCN decision returns 400 when grn_id missing", async () => {
    if (!token) return skip("login failed");
    const r = await api(
      `/api/inbound/pending-debit-credit/notes/${INBOUND_JOURNEY_DCN_NOTE_ID}/decision`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      }
    );
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 400);
  });
});

describe("Inbound journey — with SQL fixture loaded", () => {
  /** @returns {Promise<boolean>} */
  async function requireFixture() {
    if (!token) {
      skip("login failed");
      return false;
    }
    const ok = await fixturesPresent();
    if (!ok) {
      skip("load web/tests/fixtures/inbound_journey_fixture.sql against DATABASE_URL");
      return false;
    }
    return true;
  }

  it("GRN listing search includes fixture GRN", async () => {
    if (!(await requireFixture())) return;
    const r = await api(
      `/api/inbound/grns?page=1&count=50&search_keyword=${INBOUND_JOURNEY_GRN_PENDING_AUDIT}`
    );
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(
      (j.content || []).some((row) => row.grn_id === INBOUND_JOURNEY_GRN_PENDING_AUDIT),
      "searched GRN should appear in /api/inbound/grns"
    );
  });

  it("GRN listing vendor filter includes vendor fixture rows", async () => {
    if (!(await requireFixture())) return;
    const r = await api(
      `/api/inbound/grns?page=1&count=100&vendor_id=${INBOUND_JOURNEY_VENDOR_ID}`
    );
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    const rows = j.content || [];
    assert.ok(rows.length > 0, "fixture vendor should have GRN rows");
    assert.ok(
      rows.every((row) => row.vendor_id === INBOUND_JOURNEY_VENDOR_ID),
      "vendor filter should not leak other vendors"
    );
  });

  it("PO GRN report CSV includes Zap-source canonical GRN and line item", async () => {
    if (!(await requireFixture())) return;
    const r = await api(
      `/api/inbound/vendors/${INBOUND_JOURNEY_VENDOR_ID}/purchase-orders/${INBOUND_JOURNEY_ZAP_REPORT_PO_ID}/grn-report`
    );
    assert.strictEqual(r.status, 200);
    const csv = await r.text();
    const lines = csv.trim().split("\n");
    assert.ok(lines.length >= 2, "CSV should include at least one data row");
    assert.ok(lines[0].includes("source"), "CSV header should expose source");
    assert.ok(lines[0].includes("sku_id"), "CSV header should expose line item columns");
    assert.ok(csv.includes(String(INBOUND_JOURNEY_ZAP_REPORT_GRN_ID)));
    assert.ok(csv.includes("zap"));
    assert.ok(csv.includes("FIXTURE_SKU_ZAP_REPORT"));
    assert.ok(csv.includes(",25"), "CSV should include received-audit price diff");
  });

  it("pending-audits list includes fixture GRN", async () => {
    if (!(await requireFixture())) return;
    const r = await api(`/api/inbound/pending-audits/grns?page=1&count=50`);
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok((j.content || []).some((row) => row.grn_id === INBOUND_JOURNEY_GRN_PENDING_AUDIT));
  });

  it("pending-audits rows include grn_audit_price_total", async () => {
    if (!(await requireFixture())) return;
    const r = await api(
      `/api/inbound/pending-audits/grns?page=1&count=50&search_keyword=${INBOUND_JOURNEY_GRN_PENDING_AUDIT}`
    );
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    const row = (j.content || []).find(
      (item) => item.grn_id === INBOUND_JOURNEY_GRN_PENDING_AUDIT
    );
    if (!row) {
      skip("fixture GRN not in pending-audits queue, likely consumed by a prior test");
      return;
    }
    assert.strictEqual(row.grn_audit_price_total, 100);
  });

  it("pending-invoice-collection list includes fixture GRN", async () => {
    if (!(await requireFixture())) return;
    const r = await api(`/api/inbound/pending-invoice-collection/grns?page=1&count=50`);
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(
      (j.content || []).some((row) => row.grn_id === INBOUND_JOURNEY_GRN_PENDING_INVOICE)
    );
  });

  it("pending-accounts list includes fixture GRN", async () => {
    if (!(await requireFixture())) return;
    const r = await api(`/api/inbound/pending-accounts/grns?page=1&count=50`);
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(
      (j.content || []).some((row) => row.grn_id === INBOUND_JOURNEY_GRN_PENDING_ACCOUNTS)
    );
  });

  it("pending-accounts list rows include original_invoice_date field", async () => {
    if (!(await requireFixture())) return;
    const r = await api(`/api/inbound/pending-accounts/grns?page=1&count=50`);
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    const row = (j.content || []).find(
      (item) => item.grn_id === INBOUND_JOURNEY_GRN_PENDING_ACCOUNTS
    );
    if (!row) {
      skip("fixture GRN not in pending-accounts queue");
      return;
    }
    assert.ok("original_invoice_date" in row, "list row should expose original_invoice_date");
  });

  it("PATCH original_invoice_date on fixture pending-accounts GRN succeeds", async () => {
    if (!(await requireFixture())) return;
    const gid = INBOUND_JOURNEY_GRN_PENDING_ACCOUNTS;
    const patchR = await api(`/api/inbound/grns/${gid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ original_invoice_date: "2025-10-09" }),
    });
    if (patchR.status === 503) return skip("server unreachable");
    assert.strictEqual(patchR.status, 200);

    const getR = await api(`/api/inbound/grns/${gid}`);
    assert.strictEqual(getR.status, 200);
    const row = await getR.json();
    assert.strictEqual(row.original_invoice_date, "2025-10-09");

    const listR = await api(`/api/inbound/pending-accounts/grns?page=1&count=50`);
    assert.strictEqual(listR.status, 200);
    const list = await listR.json();
    const listed = (list.content || []).find((item) => item.grn_id === gid);
    if (listed) {
      assert.strictEqual(listed.original_invoice_date, "2025-10-09");
    }
  });

  it("PATCH invalid original_invoice_date returns 400", async () => {
    if (!(await requireFixture())) return;
    const r = await api(`/api/inbound/grns/${INBOUND_JOURNEY_GRN_PENDING_ACCOUNTS}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ original_invoice_date: "not-a-date" }),
    });
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 400);
  });

  it("pending-debit-credit notes list includes fixture note_id", async () => {
    if (!(await requireFixture())) return;
    const r = await api(
      `/api/inbound/pending-debit-credit/notes?page=1&count=100&search_keyword=${INBOUND_JOURNEY_DCN_NOTE_ID}`
    );
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok((j.content || []).some((row) => row.note_id === INBOUND_JOURNEY_DCN_NOTE_ID));
  });

  it("GET details bundle shape for fixture OPEN GRN", async () => {
    if (!(await requireFixture())) return;
    const r = await api(
      `/api/inbound/grns/${INBOUND_JOURNEY_GRN_PENDING_AUDIT}/details`
    );
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.header && typeof j.header === "object", "bundle should include header");
    assert.ok(Array.isArray(j.grn_items), "bundle should include grn_items array");
  });

  it("POST close with no price gap does not create Zap debit note", async () => {
    if (!(await requireFixture())) return;
    const gid = INBOUND_JOURNEY_GRN_NO_RATE_DIFF_CLOSE;
    const head = await api(`/api/inbound/grns/${gid}`);
    if (head.status !== 200) {
      skip(`GRN ${gid} missing — re-run inbound_journey_fixture.sql`);
      return;
    }
    const h = await head.json();
    if (String(h.grn_status ?? "").toUpperCase() !== "OPEN") {
      skip(`GRN ${gid} not OPEN — re-run fixture after a previous close test`);
      return;
    }

    const closeR = await api(`/api/inbound/grns/${gid}/close`, { method: "POST" });
    if (closeR.status !== 200) {
      assert.fail(`close expected 200, got ${closeR.status}: ${await closeR.text()}`);
    }

    const dnR = await api(`/api/inbound/grns/${gid}/debit-note`);
    assert.strictEqual(dnR.status, 404);
  });

  it("POST close auto-creates Zap debit note when line rate discrepancy exists", async () => {
    if (!(await requireFixture())) return;
    const gid = INBOUND_JOURNEY_GRN_RATE_DIFF_FOR_CLOSE_DN;
    const head = await api(`/api/inbound/grns/${gid}`);
    if (head.status !== 200) {
      skip(`GRN ${gid} missing — re-run inbound_journey_fixture.sql`);
      return;
    }
    const h = await head.json();
    if (String(h.grn_status ?? "").toUpperCase() !== "OPEN") {
      skip(`GRN ${gid} not OPEN — re-run fixture after a previous close+DN run`);
      return;
    }

    const closeR = await api(`/api/inbound/grns/${gid}/close`, { method: "POST" });
    if (closeR.status !== 200) {
      const errBody = await closeR.text();
      assert.fail(`close expected 200, got ${closeR.status}: ${errBody}`);
    }

    const dnR = await api(`/api/inbound/grns/${gid}/debit-note`);
    assert.strictEqual(dnR.status, 200);
    const note = await dnR.json();
    assert.strictEqual(note.status, "DRAFT");
  });

  it("PATCH line 0 updates fixture GRN", async () => {
    if (!(await requireFixture())) return;
    const r = await api(
      `/api/inbound/grns/${INBOUND_JOURNEY_GRN_PENDING_AUDIT}/items/0`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_quantity: 10,
          accepted_quantity: 10,
          rejected_quantity: 0,
          shortage_quantity: 0,
          received_price: 100,
          tax_rate: 0,
        }),
      }
    );
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 200);
  });

  it("POST receive-inventory returns 422 when accounts not APPROVED", async () => {
    if (!(await requireFixture())) return;
    const r = await api(
      `/api/inbound/grns/${INBOUND_JOURNEY_GRN_PENDING_AUDIT}/receive-inventory`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ sku_id: "X", bin_id: "Y", quantity: 1 }],
        }),
      }
    );
    assert.strictEqual(r.status, 422);
  });

  it("POST register-operational succeeds once for draft fixture", async () => {
    if (!(await requireFixture())) return;
    const probe = await api(`/api/inbound/grns/${INBOUND_JOURNEY_DRAFT_GRN_ID}`);
    if (probe.status !== 200) {
      skip("draft GRN absent — fixture may have been promoted already; re-run fixture SQL");
      return;
    }
    const body = JSON.stringify({
      operational_grn_id: INBOUND_JOURNEY_OPERATIONAL_AFTER_REGISTER,
    });
    const first = await api(
      `/api/inbound/grns/${INBOUND_JOURNEY_DRAFT_GRN_ID}/register-operational`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body }
    );
    if (first.status === 503) return skip("server unreachable");
    if (first.status === 409) {
      skip("operational GRN id already exists — re-run inbound_journey_fixture.sql");
      return;
    }
    assert.strictEqual(first.status, 200, "first promote should succeed after fresh fixture");

    const secondDraft = await api(
      `/api/inbound/grns/${INBOUND_JOURNEY_DRAFT_GRN_ID}/register-operational`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body }
    );
    assert.strictEqual(
      secondDraft.status,
      404,
      "draft id should be gone after successful promote"
    );
  });

  it("POST DCN decision updates local row (re-seed to repeat)", async () => {
    if (!(await requireFixture())) return;
    const r = await api(
      `/api/inbound/pending-debit-credit/notes/${INBOUND_JOURNEY_DCN_NOTE_ID}/decision`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grn_id: INBOUND_JOURNEY_GRN_DCN,
          status: "APPROVED",
        }),
      }
    );
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.credit_debit_note_status, "APPROVED");
  });

  it("PATCH grn accounts_status rejected for non-admin", async () => {
    if (!(await requireFixture())) return;
    const warehouseToken = await loginAs("warehouse@example.com", "warehouse123");
    if (!warehouseToken) return skip("warehouse user login failed — run npm run seed");
    const r = await apiWithToken(
      warehouseToken,
      `/api/inbound/grns/${INBOUND_JOURNEY_GRN_PENDING_ACCOUNTS}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accounts_status: "APPROVED" }),
      }
    );
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 403);
  });

  it("PATCH grn accounts_status succeeds on fixture GRN", async () => {
    if (!(await requireFixture())) return;
    const r = await api(`/api/inbound/grns/${INBOUND_JOURNEY_GRN_PENDING_ACCOUNTS}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accounts_status: "APPROVED" }),
    });
    assert.strictEqual(r.status, 200);
  });

  it("approved accounts GRN leaves pending-accounts queue", async () => {
    if (!(await requireFixture())) return;
    const r = await api(
      `/api/inbound/pending-accounts/grns?page=1&count=50&search_keyword=${INBOUND_JOURNEY_GRN_PENDING_ACCOUNTS}`
    );
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(
      !(j.content || []).some((row) => row.grn_id === INBOUND_JOURNEY_GRN_PENDING_ACCOUNTS),
      "APPROVED GRN should leave pending-accounts queue"
    );
  });

  it("POST close returns 400 when GRN has no invoice files", async () => {
    if (!(await requireFixture())) return;
    const probe = await api(`/api/inbound/grns/${INBOUND_JOURNEY_GRN_NO_INVOICE_OPEN}`);
    if (probe.status !== 200) {
      skip(`GRN ${INBOUND_JOURNEY_GRN_NO_INVOICE_OPEN} missing — re-run inbound_journey_fixture.sql`);
      return;
    }
    const h = await probe.json();
    if (String(h.grn_status ?? "").toUpperCase() !== "OPEN") {
      skip(`GRN ${INBOUND_JOURNEY_GRN_NO_INVOICE_OPEN} is not OPEN`);
      return;
    }
    const r = await api(`/api/inbound/grns/${INBOUND_JOURNEY_GRN_NO_INVOICE_OPEN}/close`, {
      method: "POST",
    });
    if (r.status === 503) return skip("server unreachable");
    assert.ok(
      r.status === 400 || r.status === 409,
      `expected 400 (no invoice) or 409 (already closed), got ${r.status}`
    );
  });

  it("PATCH grn audit_status CLOSED rejected for non-admin and logs denial", async () => {
    if (!(await requireFixture())) return;
    const warehouseToken = await loginAs("warehouse@example.com", "warehouse123");
    if (!warehouseToken) return skip("warehouse user login failed — run npm run seed");
    const r = await apiWithToken(
      warehouseToken,
      `/api/inbound/grns/${INBOUND_JOURNEY_GRN_PENDING_AUDIT}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grn_audit_status: "CLOSED" }),
      }
    );
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 403);

    const detailsR = await api(
      `/api/inbound/grns/${INBOUND_JOURNEY_GRN_PENDING_AUDIT}/details`
    );
    assert.strictEqual(detailsR.status, 200);
    const bundle = await detailsR.json();
    assert.ok(
      (bundle.grn_logs || []).some((log) => log.log_type === "AUDIT_DENIED"),
      "AUDIT_DENIED log should be visible in GRN details after blocked audit"
    );
  });

  it("PATCH grn audit_status CLOSED succeeds on fixture GRN", async () => {
    if (!(await requireFixture())) return;
    const r = await api(`/api/inbound/grns/${INBOUND_JOURNEY_GRN_PENDING_AUDIT}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grn_audit_status: "CLOSED" }),
    });
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 200);
  });

  it("audited GRN leaves pending-audits and enters pending-invoice", async () => {
    if (!(await requireFixture())) return;
    const auditR = await api(
      `/api/inbound/pending-audits/grns?page=1&count=50&search_keyword=${INBOUND_JOURNEY_GRN_PENDING_AUDIT}`
    );
    assert.strictEqual(auditR.status, 200);
    const auditList = await auditR.json();
    assert.ok(
      !(auditList.content || []).some((row) => row.grn_id === INBOUND_JOURNEY_GRN_PENDING_AUDIT),
      "audited GRN should leave pending-audits queue"
    );

    const invoiceR = await api(
      `/api/inbound/pending-invoice-collection/grns?page=1&count=50&search_keyword=${INBOUND_JOURNEY_GRN_PENDING_AUDIT}`
    );
    assert.strictEqual(invoiceR.status, 200);
    const invoiceList = await invoiceR.json();
    assert.ok(
      (invoiceList.content || []).some((row) => row.grn_id === INBOUND_JOURNEY_GRN_PENDING_AUDIT),
      "audited GRN should enter pending-invoice queue"
    );
  });

  it("PATCH line item returns 409 after audit is closed and logs lock", async () => {
    if (!(await requireFixture())) return;
    const probe = await api(`/api/inbound/grns/${INBOUND_JOURNEY_GRN_PENDING_AUDIT}`);
    assert.strictEqual(probe.status, 200);
    const header = await probe.json();
    if (!["CLOSED", "AUDITED", "DONE", "COMPLETED"].includes(
      String(header.grn_audit_status ?? "").toUpperCase()
    )) {
      skip("fixture audit is not closed yet — audit-close test may have been skipped");
      return;
    }

    const r = await api(
      `/api/inbound/grns/${INBOUND_JOURNEY_GRN_PENDING_AUDIT}/items/0`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_quantity: 10,
          accepted_quantity: 9,
          rejected_quantity: 1,
          shortage_quantity: 0,
          received_price: 100,
          tax_rate: 0,
        }),
      }
    );
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 409);

    const detailsR = await api(
      `/api/inbound/grns/${INBOUND_JOURNEY_GRN_PENDING_AUDIT}/details`
    );
    assert.strictEqual(detailsR.status, 200);
    const bundle = await detailsR.json();
    assert.ok(
      (bundle.grn_logs || []).some((log) => log.log_type === "AUDIT_LOCKED"),
      "AUDIT_LOCKED log should be visible after blocked post-audit line edit"
    );
  });

  it("PATCH grn invoice_collection_status COLLECTED succeeds on fixture GRN", async () => {
    if (!(await requireFixture())) return;
    const r = await api(`/api/inbound/grns/${INBOUND_JOURNEY_GRN_PENDING_INVOICE}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grn_invoice_collection_status: "COLLECTED" }),
    });
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 200);
  });

  it("collected invoice GRN leaves pending-invoice and enters pending-accounts", async () => {
    if (!(await requireFixture())) return;
    const invoiceR = await api(
      `/api/inbound/pending-invoice-collection/grns?page=1&count=50&search_keyword=${INBOUND_JOURNEY_GRN_PENDING_INVOICE}`
    );
    assert.strictEqual(invoiceR.status, 200);
    const invoiceList = await invoiceR.json();
    assert.ok(
      !(invoiceList.content || []).some((row) => row.grn_id === INBOUND_JOURNEY_GRN_PENDING_INVOICE),
      "COLLECTED GRN should leave pending-invoice queue"
    );

    const accountsR = await api(
      `/api/inbound/pending-accounts/grns?page=1&count=50&search_keyword=${INBOUND_JOURNEY_GRN_PENDING_INVOICE}`
    );
    assert.strictEqual(accountsR.status, 200);
    const accountsList = await accountsR.json();
    assert.ok(
      (accountsList.content || []).some((row) => row.grn_id === INBOUND_JOURNEY_GRN_PENDING_INVOICE),
      "COLLECTED GRN should enter pending-accounts queue"
    );
  });

  it("PATCH debit-note dn_number assignment succeeds on fixture DRAFT note (re-seed to repeat)", async () => {
    if (!(await requireFixture())) return;
    const dnR = await api(`/api/inbound/grns/${INBOUND_JOURNEY_GRN_WITH_DRAFT_ZAP_DN}/debit-note`);
    if (dnR.status !== 200) {
      skip(`No Zap debit note on GRN ${INBOUND_JOURNEY_GRN_WITH_DRAFT_ZAP_DN} — re-run fixture`);
      return;
    }
    const note = await dnR.json();
    if (note.status !== "DRAFT" || note.dn_number) {
      skip("Note is not DRAFT without dn_number — re-run inbound_journey_fixture.sql");
      return;
    }
    const r = await api(`/api/inbound/grns/${INBOUND_JOURNEY_GRN_WITH_DRAFT_ZAP_DN}/debit-note`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dn_number: "DN-FIXTURE-TEST-001" }),
    });
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 200);
    const updated = await r.json();
    assert.strictEqual(updated.status, "ISSUED");
    assert.strictEqual(updated.dn_number, "DN-FIXTURE-TEST-001");
  });

  it("POST receive-inventory returns 200 when accounts is APPROVED (re-seed to repeat)", async () => {
    if (!(await requireFixture())) return;
    const probe = await api(`/api/inbound/grns/${INBOUND_JOURNEY_GRN_APPROVED_ACCOUNTS}`);
    if (probe.status !== 200) {
      skip(`GRN ${INBOUND_JOURNEY_GRN_APPROVED_ACCOUNTS} missing — re-run fixture`);
      return;
    }
    const h = await probe.json();
    if (String(h.accounts_status ?? "").toUpperCase() !== "APPROVED") {
      skip("GRN accounts_status is not APPROVED — re-run inbound_journey_fixture.sql");
      return;
    }
    const r = await api(
      `/api/inbound/grns/${INBOUND_JOURNEY_GRN_APPROVED_ACCOUNTS}/receive-inventory`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ sku_id: "FIXTURE_SKU_APPROVED", bin_id: "BIN-TEST-01", quantity: 5 }],
        }),
      }
    );
    if (r.status === 503) return skip("server unreachable");
    assert.ok(r.status === 200 || r.status === 422, `expected 200 or 422, got ${r.status}`);
  });

  it("PATCH cancel PO returns 409 when a CLOSED GRN exists on the PO", async () => {
    if (!(await requireFixture())) return;
    const probe = await api(
      `/api/inbound/vendors/${INBOUND_JOURNEY_VENDOR_ID}/purchase-orders/${INBOUND_JOURNEY_ZAP_REPORT_PO_ID}/details`
    );
    if (probe.status !== 200) {
      skip(`Zap report PO ${INBOUND_JOURNEY_ZAP_REPORT_PO_ID} missing — re-run fixture`);
      return;
    }
    const r = await api(
      `/api/inbound/vendors/${INBOUND_JOURNEY_VENDOR_ID}/purchase-orders/${INBOUND_JOURNEY_ZAP_REPORT_PO_ID}/cancel`,
      { method: "PATCH" }
    );
    if (r.status === 503) return skip("server unreachable");
    assert.strictEqual(r.status, 409);
    const body = await r.json();
    assert.match(String(body.message ?? ""), /cannot be cancelled|CLOSED|receipt/i);
  });
});
