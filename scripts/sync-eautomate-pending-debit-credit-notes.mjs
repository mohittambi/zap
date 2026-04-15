#!/usr/bin/env node
/**
 * Fetches eautomate POST /purchase_orders/grn/debit_credit_notes/paginated (filter body)
 * and replaces inbound_pending_debit_credit_notes. Uses GET /vendors/all to build vendor_id
 * allowlist when skipping unknown vendors (default for API mode).
 *
 * Env: DATABASE_URL (required)
 *      EAUTOMATE_BASE_URL, EAUTOMATE_COOKIE / EAUTOMATE_BEARER_TOKEN
 *
 * Usage: node scripts/sync-eautomate-pending-debit-credit-notes.mjs --all [--strict-vendors] [--vendor-ids-from-db]
 *        node scripts/sync-eautomate-pending-debit-credit-notes.mjs --file <path/to/json>
 *        node scripts/sync-eautomate-pending-debit-credit-notes.mjs --stdin
 *    or: npm run sync:grns:pending-debit-credit
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { fetchEautomate } from "./lib/eautomateAuthFetch.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FILTER_BODY = JSON.stringify({
  grnId: "",
  poNumber: "",
  vendorInvoiceNumber: "",
  vendorIds: [],
  vendorNames: [],
});

try {
  const dotenv = await import("dotenv");
  const root = path.join(__dirname, "..");
  dotenv.default.config({ path: path.join(root, ".env.local") });
  dotenv.default.config({ path: path.join(root, ".env") });
} catch {
  /* optional */
}

function num(v, fallback = null) {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseTimestamptz(value) {
  if (value == null || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  if (y < 1 || y > 9999) return null;
  return d.toISOString();
}

async function fetchVendorsAllIds(base) {
  const url = `${base.replace(/\/$/, "")}/public/api/vendors/all`;
  const res = await fetchEautomate(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${url}${text ? ` — ${text.slice(0, 200)}` : ""}`);
  }
  const data = await res.json();
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.content)
      ? data.content
      : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.vendors)
          ? data.vendors
          : [];
  const set = new Set();
  for (const r of rows) {
    const id = num(r?.id ?? r?.vendor_id, null);
    if (id != null) set.add(id);
  }
  return set;
}

async function fetchDebitCreditNotesPaginated(base, page, perPage) {
  const u = new URL(
    `${base}/public/api/purchase_orders/grn/debit_credit_notes/paginated`
  );
  u.searchParams.set("search_keyword", "");
  u.searchParams.set("page", String(page));
  u.searchParams.set("count", String(perPage));
  const res = await fetchEautomate(u.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: FILTER_BODY,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let hint = "";
    if (
      res.status === 401 &&
      !process.env.EAUTOMATE_BEARER_TOKEN &&
      !process.env.EAUTOMATE_COOKIE
    ) {
      hint =
        " (set EAUTOMATE_COOKIE or EAUTOMATE_BEARER_TOKEN if the API requires auth)";
    }
    throw new Error(`HTTP ${res.status} ${u}${hint}${text ? ` — ${text.slice(0, 200)}` : ""}`);
  }
  return res.json();
}

function extractRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

async function collectAllPagesFromApi(base) {
  const perPage = 100;
  const out = [];
  let page = 1;
  for (;;) {
    const data = await fetchDebitCreditNotesPaginated(base, page, perPage);
    const content = extractRows(data);
    if (!Array.isArray(content) || content.length === 0) break;
    out.push(...content);
    if (content.length < perPage) break;
    page += 1;
    if (page > 1000) {
      console.warn("Stopped after 1000 pages (safety cap)");
      break;
    }
  }
  return out;
}

function sliceStr(v, max) {
  if (v == null || v === "") return null;
  return String(v).slice(0, max);
}

async function insertNoteRow(client, row) {
  const noteId = num(row.id, null);
  const grnId = num(row.grn_id, null);
  if (noteId == null || grnId == null) return false;

  const actualBoxes =
    row.actual_box_count_recieved != null
      ? num(row.actual_box_count_recieved, 0)
      : num(row.actual_box_count_received, 0);

  await client.query(
    `INSERT INTO inbound_pending_debit_credit_notes (
      note_id, grn_id, credit_debit_note_type, credit_debit_note_status, credit_debit_note_number,
      credit_debit_note_number_assignment_status, credit_debit_note_upload_status, credit_debit_note_uploaded_by,
      reverse_credit_debit_note_number, reverse_credit_debit_note_upload_status, reverse_credit_debit_note_uploaded_by,
      created_by, created_at, updated_at, po_id, grn_status, grn_audit_status, grn_audit_by,
      vendor_invoice_number, box_count_invoice, actual_box_count_recieved, vendor_id, vendor_name, raw, synced_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::timestamptz, $14::timestamptz, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24::jsonb, NOW()
    )`,
    [
      noteId,
      grnId,
      sliceStr(row.credit_debit_note_type, 120),
      sliceStr(row.credit_debit_note_status, 80),
      row.credit_debit_note_number != null ? String(row.credit_debit_note_number) : null,
      sliceStr(row.credit_debit_note_number_assignment_status, 80),
      sliceStr(row.credit_debit_note_upload_status, 80),
      sliceStr(row.credit_debit_note_uploaded_by, 100),
      row.reverse_credit_debit_note_number != null
        ? String(row.reverse_credit_debit_note_number)
        : null,
      sliceStr(row.reverse_credit_debit_note_upload_status, 80),
      sliceStr(row.reverse_credit_debit_note_uploaded_by, 100),
      sliceStr(row.created_by, 100),
      parseTimestamptz(row.created_at),
      parseTimestamptz(row.updated_at),
      num(row.po_id, null),
      sliceStr(row.grn_status, 80),
      sliceStr(row.grn_audit_status, 80),
      sliceStr(row.grn_audit_by, 100),
      sliceStr(row.vendor_invoice_number, 200),
      num(row.box_count_invoice, null),
      actualBoxes,
      num(row.vendor_id, null),
      sliceStr(row.vendor_name, 200),
      row,
    ]
  );
  return true;
}

function parseArgs(argv) {
  let filePath;
  let syncAll = false;
  let useStdin = false;
  let skipMissingVendors = false;
  let strictVendors = false;
  let vendorIdsFromDb = false;

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--all") syncAll = true;
    else if (a === "--stdin") useStdin = true;
    else if (a === "--strict-vendors") strictVendors = true;
    else if (a === "--skip-missing-vendors") skipMissingVendors = true;
    else if (a === "--vendor-ids-from-db") vendorIdsFromDb = true;
    else if (a === "--file") {
      const next = argv[i + 1];
      if (!next) throw new Error("--file requires a path");
      filePath = path.resolve(next);
      i += 1;
    }
  }

  return { filePath, syncAll, useStdin, skipMissingVendors, strictVendors, vendorIdsFromDb };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  if (/YOUR_USERNAME|YOUR_PASSWORD/i.test(url)) {
    console.error(
      "DATABASE_URL still uses a placeholder. Set a real PostgreSQL connection string."
    );
    process.exit(1);
  }

  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  const { filePath, syncAll, useStdin, skipMissingVendors, strictVendors, vendorIdsFromDb } =
    opts;

  const modeCount = [syncAll, filePath != null, useStdin].filter(Boolean).length;
  if (modeCount !== 1) {
    console.error(
      "Usage: node scripts/sync-eautomate-pending-debit-credit-notes.mjs --all [--strict-vendors] [--vendor-ids-from-db]\n       node scripts/sync-eautomate-pending-debit-credit-notes.mjs --file <json> [--skip-missing-vendors]\n       node scripts/sync-eautomate-pending-debit-credit-notes.mjs --stdin [--skip-missing-vendors]"
    );
    process.exit(1);
  }

  const fromEautomateApi = filePath == null && !useStdin;
  const effectiveSkipMissingVendors = strictVendors
    ? false
    : fromEautomateApi
      ? true
      : skipMissingVendors;

  let rows;
  /** @type {Set<number> | null} */
  let apiVendorIds = null;
  if (filePath != null) {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
    rows = extractRows(raw);
    if (!Array.isArray(rows)) {
      throw new Error("Fixture must be an array or { content | data: array }");
    }
  } else if (useStdin) {
    const raw = JSON.parse(fs.readFileSync(0, "utf8"));
    rows = extractRows(raw);
    if (!Array.isArray(rows)) {
      throw new Error("stdin JSON must be an array or { content | data: array }");
    }
  } else {
    const base = (process.env.EAUTOMATE_BASE_URL || "https://web.eautomate.in").replace(
      /\/$/,
      ""
    );
    console.log(`Fetching /vendors/all from ${base}…`);
    apiVendorIds = await fetchVendorsAllIds(base);
    console.log(`Vendor allowlist: ${apiVendorIds.size} id(s) from eautomate`);
    console.log(`Fetching debit/credit notes paginated from ${base}…`);
    rows = await collectAllPagesFromApi(base);
    console.log(`Fetched ${rows.length} row(s) from API`);
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  let inserted = 0;
  let skippedNoVendor = 0;
  try {
    await client.query("BEGIN");

    let vendorIdSet = null;
    if (effectiveSkipMissingVendors) {
      if (fromEautomateApi && vendorIdsFromDb) {
        const vr = await client.query(`SELECT id FROM vendors`);
        vendorIdSet = new Set(vr.rows.map((r) => Number(r.id)));
      } else if (fromEautomateApi && apiVendorIds != null) {
        vendorIdSet = apiVendorIds;
      } else {
        const vr = await client.query(`SELECT id FROM vendors`);
        vendorIdSet = new Set(vr.rows.map((r) => Number(r.id)));
      }
    }

    await client.query(`TRUNCATE inbound_pending_debit_credit_notes`);

    for (const row of rows) {
      const vid = num(row.vendor_id, null);
      if (effectiveSkipMissingVendors && vid != null && !vendorIdSet.has(vid)) {
        skippedNoVendor += 1;
        continue;
      }
      const ok = await insertNoteRow(client, row);
      if (ok) inserted += 1;
    }

    await client.query("COMMIT");
    const parts = [
      `Inserted ${inserted} pending debit/credit note row(s)${
        syncAll ? " (API)" : filePath != null ? ` from ${path.basename(filePath)}` : useStdin ? " (stdin)" : ""
      }`,
    ];
    if (skippedNoVendor > 0) {
      parts.push(
        `skipped ${skippedNoVendor} row(s) (vendor_id not in allowlist — use --strict-vendors to ingest all, or sync vendors)`
      );
    }
    console.log(parts.join("; "));
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
