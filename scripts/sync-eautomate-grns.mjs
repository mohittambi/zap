#!/usr/bin/env node
/**
 * Fetches eautomate POST /purchase_orders/grn/all/paginated and upserts into inbound_grns.
 *
 * Env: DATABASE_URL (required)
 *      EAUTOMATE_BASE_URL (optional, default https://web.eautomate.in)
 *      EAUTOMATE_COOKIE (optional; full Cookie header from browser)
 *      EAUTOMATE_BEARER_TOKEN (optional)
 *
 * Usage: node scripts/sync-eautomate-grns.mjs --all [--strict-vendors]
 *        node scripts/sync-eautomate-grns.mjs --file <path/to/grn-list.json>
 *        node scripts/sync-eautomate-grns.mjs --stdin
 *    or: npm run sync:grns:all
 *
 * Rows whose vendor_id is not in vendors are skipped by default (same as PO sync).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

function eautomateFetchInit() {
  const headers = { Accept: "application/json" };
  const token = process.env.EAUTOMATE_BEARER_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  const cookie = process.env.EAUTOMATE_COOKIE;
  if (cookie) headers.Cookie = cookie;
  return { headers };
}

/** POST with empty JSON body; API uses query params for pagination. */
async function fetchGrnPaginated(base, page, perPage) {
  const u = new URL(`${base}/public/api/purchase_orders/grn/all/paginated`);
  u.searchParams.set("search_keyword", "");
  u.searchParams.set("page", String(page));
  u.searchParams.set("count", String(perPage));
  const init = {
    method: "POST",
    headers: {
      ...eautomateFetchInit().headers,
      "Content-Type": "application/json",
    },
    body: "{}",
  };
  const res = await fetch(u.toString(), init);
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

async function upsertGrn(client, row) {
  const grnId = num(row.grn_id, null);
  const poId = num(row.po_id, null);
  const vendorId = num(row.vendor_id, null);
  if (grnId == null || poId == null || vendorId == null) return false;

  const createdAt = parseTimestamptz(row.created_at) ?? new Date().toISOString();
  const updatedAt = parseTimestamptz(row.updated_at) ?? createdAt;
  const actualBoxes =
    row.actual_box_count_recieved != null
      ? num(row.actual_box_count_recieved, 0)
      : num(row.actual_box_count_received, 0);

  await client.query(
    `INSERT INTO inbound_grns (
      grn_id, po_id, vendor_id, vendor_name,
      grn_status, grn_audit_status, grn_audit_by,
      grn_invoice_collection_status, grn_invoice_collection_by,
      vendor_invoice_number, box_count_invoice, actual_box_count_received,
      grn_sku_count, grn_invoice_quantity, grn_accepted_quantity,
      grn_rejected_quantity, grn_shortage_quantity,
      po_sku_count, po_total_quantity,
      created_by, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7,
      $8, $9,
      $10, $11, $12,
      $13, $14, $15,
      $16, $17,
      $18, $19,
      $20, $21::timestamptz, $22::timestamptz
    )
    ON CONFLICT (grn_id) DO UPDATE SET
      po_id = EXCLUDED.po_id,
      vendor_id = EXCLUDED.vendor_id,
      vendor_name = EXCLUDED.vendor_name,
      grn_status = EXCLUDED.grn_status,
      grn_audit_status = EXCLUDED.grn_audit_status,
      grn_audit_by = EXCLUDED.grn_audit_by,
      grn_invoice_collection_status = EXCLUDED.grn_invoice_collection_status,
      grn_invoice_collection_by = EXCLUDED.grn_invoice_collection_by,
      vendor_invoice_number = EXCLUDED.vendor_invoice_number,
      box_count_invoice = EXCLUDED.box_count_invoice,
      actual_box_count_received = EXCLUDED.actual_box_count_received,
      grn_sku_count = EXCLUDED.grn_sku_count,
      grn_invoice_quantity = EXCLUDED.grn_invoice_quantity,
      grn_accepted_quantity = EXCLUDED.grn_accepted_quantity,
      grn_rejected_quantity = EXCLUDED.grn_rejected_quantity,
      grn_shortage_quantity = EXCLUDED.grn_shortage_quantity,
      po_sku_count = EXCLUDED.po_sku_count,
      po_total_quantity = EXCLUDED.po_total_quantity,
      created_by = EXCLUDED.created_by,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at`,
    [
      grnId,
      poId,
      vendorId,
      row.vendor_name != null ? String(row.vendor_name).slice(0, 200) : null,
      row.grn_status != null ? String(row.grn_status).slice(0, 80) : null,
      row.grn_audit_status != null ? String(row.grn_audit_status).slice(0, 80) : null,
      row.grn_audit_by != null ? String(row.grn_audit_by).slice(0, 100) : null,
      row.grn_invoice_collection_status != null
        ? String(row.grn_invoice_collection_status).slice(0, 80)
        : null,
      row.grn_invoice_collection_by != null
        ? String(row.grn_invoice_collection_by).slice(0, 100)
        : null,
      row.vendor_invoice_number != null
        ? String(row.vendor_invoice_number).slice(0, 200)
        : null,
      num(row.box_count_invoice, 0) ?? 0,
      actualBoxes ?? 0,
      num(row.grn_sku_count, 0) ?? 0,
      num(row.grn_invoice_quantity, 0) ?? 0,
      num(row.grn_accepted_quantity, 0) ?? 0,
      num(row.grn_rejected_quantity, 0) ?? 0,
      num(row.grn_shortage_quantity, 0) ?? 0,
      num(row.po_sku_count, 0) ?? 0,
      num(row.po_total_quantity, 0) ?? 0,
      row.created_by != null ? String(row.created_by).slice(0, 100) : null,
      createdAt,
      updatedAt,
    ]
  );
  return true;
}

async function collectAllPagesFromApi(base) {
  const perPage = 100;
  const out = [];
  let page = 1;
  for (;;) {
    const data = await fetchGrnPaginated(base, page, perPage);
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

function parseArgs(argv) {
  let filePath;
  let syncAll = false;
  let useStdin = false;
  let skipMissingVendors = false;
  let strictVendors = false;

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--all") syncAll = true;
    else if (a === "--stdin") useStdin = true;
    else if (a === "--strict-vendors") strictVendors = true;
    else if (a === "--skip-missing-vendors") skipMissingVendors = true;
    else if (a === "--file") {
      const next = argv[i + 1];
      if (!next) throw new Error("--file requires a path");
      filePath = path.resolve(next);
      i += 1;
    }
  }

  return { filePath, syncAll, useStdin, skipMissingVendors, strictVendors };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  if (/YOUR_USERNAME|YOUR_PASSWORD/i.test(url)) {
    console.error(
      "DATABASE_URL still uses a placeholder (YOUR_USERNAME or YOUR_PASSWORD). Set a real PostgreSQL role name — on macOS Homebrew often your login name from `whoami` (see .env.local.example)."
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

  const { filePath, syncAll, useStdin, skipMissingVendors, strictVendors } = opts;

  const modeCount = [syncAll, filePath != null, useStdin].filter(Boolean).length;
  if (modeCount !== 1) {
    console.error(
      "Usage: node scripts/sync-eautomate-grns.mjs --all [--strict-vendors]\n       node scripts/sync-eautomate-grns.mjs --file <grn-list.json> [--skip-missing-vendors]\n       node scripts/sync-eautomate-grns.mjs --stdin [--skip-missing-vendors]"
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
    console.log(`Fetching all GRN pages from ${base}…`);
    rows = await collectAllPagesFromApi(base);
    console.log(`Fetched ${rows.length} row(s) from API`);
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  let n = 0;
  let skippedNoVendor = 0;
  try {
    await client.query("BEGIN");
    let vendorIdSet = null;
    if (effectiveSkipMissingVendors) {
      const vr = await client.query(`SELECT id FROM vendors`);
      vendorIdSet = new Set(vr.rows.map((r) => Number(r.id)));
    }
    for (const row of rows) {
      const vid = num(row.vendor_id, null);
      if (effectiveSkipMissingVendors && vid != null && !vendorIdSet.has(vid)) {
        skippedNoVendor += 1;
        continue;
      }
      if (await upsertGrn(client, row)) n += 1;
    }
    await client.query("COMMIT");
    const parts = [
      `Upserted ${n} GRN row(s)${
        syncAll
          ? " (all pages)"
          : filePath != null
            ? ` from ${path.basename(filePath)}`
            : useStdin
              ? " from stdin"
              : ""
      }`,
    ];
    if (skippedNoVendor > 0) {
      parts.push(
        `skipped ${skippedNoVendor} row(s) (vendor_id not in vendors — run npm run sync:vendors:all or use --strict-vendors to fail instead)`
      );
    } else if (fromEautomateApi && effectiveSkipMissingVendors && rows.length > 0) {
      parts.push("no vendor_id skips (all GRN vendors exist in vendors)");
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
