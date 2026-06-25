#!/usr/bin/env node
/**
 * Fetches eautomate purchase_orders/with_filters and upserts rows for one vendor_id
 * into vendor_purchase_orders (headers only; lines are not returned by this list API).
 *
 * Env: DATABASE_URL (required)
 *      EAUTOMATE_BASE_URL (optional, default https://web.eautomate.in)
 *      EAUTOMATE_COOKIE (optional; full Cookie header from browser — access_token + id_token)
 *      EAUTOMATE_BEARER_TOKEN (optional; alternative if API accepts Bearer auth)
 *
 * Loads .env.local / .env from the web package root when present (same as migrate).
 *
 * Usage: node scripts/sync-eautomate-vendor-pos.mjs <vendorId>
 *        node scripts/sync-eautomate-vendor-pos.mjs --all
 *        node scripts/sync-eautomate-vendor-pos.mjs --file <path/to/po-list.json>
 *        node scripts/sync-eautomate-vendor-pos.mjs --stdin   # JSON from stdin (full envelope or array)
 *        node scripts/sync-eautomate-vendor-pos.mjs --file dump.json --skip-missing-vendors
 *        node scripts/sync-eautomate-vendor-pos.mjs --all --strict-vendors   # fail if any PO vendor missing in DB
 *    or: npm run sync:vendor-pos -- <vendorId>
 *        npm run sync:vendor-pos:all
 *
 *    eautomate --all / <vendorId>: rows whose vendor_id is not in vendors are skipped by default (local DB is often a subset).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { fetchEautomate } from "./lib/eautomateAuthFetch.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  const dotenv = await import("dotenv");
  const root = path.join(__dirname, "..");
  dotenv.default.config({ path: path.join(root, ".env.local") });
  dotenv.default.config({ path: path.join(root, ".env") });
} catch {
  /* optional */
}

function num(v, fallback = 0) {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseDateOnly(value) {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function parseTimestamptz(value) {
  if (value == null || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  if (y < 1 || y > 9999) return null;
  return d.toISOString();
}

/** POST /purchase_orders/with_filters — query has page/count; body has filter payload. */
async function fetchPurchaseOrdersWithFilters(base, page, perPage, vendorIds) {
  const u = new URL(`${base}/public/api/purchase_orders/with_filters`);
  u.searchParams.set("search_keyword", "");
  u.searchParams.set("page", String(page));
  u.searchParams.set("count", String(perPage));
  const res = await fetchEautomate(u.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      poNumber: "",
      vendorIds: Array.isArray(vendorIds) ? vendorIds : [],
      vendorNames: [],
    }),
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

async function upsertPo(client, row) {
  const poId = num(row.po_id, null);
  const vendorId = num(row.vendor_id, null);
  if (poId == null || vendorId == null) return false;

  const expectedDate = parseDateOnly(row.expected_date);
  const createdAt = parseTimestamptz(row.created_at) ?? new Date().toISOString();
  const updatedAt = parseTimestamptz(row.updated_at) ?? createdAt;
  const datePublished = parseTimestamptz(row.date_published);
  const createdBy =
    row.created_by != null ? String(row.created_by).slice(0, 100) : null;
  const modifiedBy =
    row.modified_by != null
      ? String(row.modified_by).slice(0, 100)
      : createdBy;

  await client.query(
    `INSERT INTO vendor_purchase_orders (
      po_id, vendor_id, vendor_name, expected_date, created_by, modified_by,
      created_at, updated_at, date_published, status, po_remarks,
      sku_count, total_quantity, number_of_grns, total_invoice_quantity,
      total_accepted_quantity, total_rejected_quantity, sku_fill_rate, quantity_fill_rate
    ) VALUES (
      $1, $2, $3, $4::date, $5, $6, $7::timestamptz, $8::timestamptz, $9::timestamptz,
      $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
    )
    /* DO NOT include source in the UPDATE SET below: a row tagged as
       zap (locally-created) must keep that tag forever. Synced rows
       default to eautomate on first insert via the column DEFAULT. */
    ON CONFLICT (po_id) DO UPDATE SET
      vendor_id = EXCLUDED.vendor_id,
      vendor_name = EXCLUDED.vendor_name,
      expected_date = EXCLUDED.expected_date,
      modified_by = EXCLUDED.modified_by,
      updated_at = EXCLUDED.updated_at,
      date_published = EXCLUDED.date_published,
      status = EXCLUDED.status,
      po_remarks = EXCLUDED.po_remarks,
      sku_count = EXCLUDED.sku_count,
      total_quantity = EXCLUDED.total_quantity,
      number_of_grns = EXCLUDED.number_of_grns,
      total_invoice_quantity = EXCLUDED.total_invoice_quantity,
      total_accepted_quantity = EXCLUDED.total_accepted_quantity,
      total_rejected_quantity = EXCLUDED.total_rejected_quantity,
      sku_fill_rate = EXCLUDED.sku_fill_rate,
      quantity_fill_rate = EXCLUDED.quantity_fill_rate
    WHERE vendor_purchase_orders.source = 'eautomate'`,
    [
      poId,
      vendorId,
      row.vendor_name != null ? String(row.vendor_name).slice(0, 200) : null,
      expectedDate,
      createdBy,
      modifiedBy,
      createdAt,
      updatedAt,
      datePublished,
      row.status != null ? String(row.status).slice(0, 50) : "PENDING",
      row.po_remarks != null ? String(row.po_remarks) : null,
      num(row.sku_count, 0),
      num(row.total_quantity, 0),
      num(row.number_of_grns, 0),
      num(row.total_invoice_quantity, 0),
      num(row.total_accepted_quantity, 0),
      num(row.total_rejected_quantity, 0),
      num(row.sku_fill_rate, 0),
      num(row.quantity_fill_rate, 0),
    ]
  );
  return true;
}

async function collectForVendorFromApi(base, vendorId) {
  const perPage = 100;
  const out = [];
  let page = 1;
  for (;;) {
    const data = await fetchPurchaseOrdersWithFilters(base, page, perPage, [
      vendorId,
    ]);
    const content = Array.isArray(data.content) ? data.content : [];
    for (const row of content) {
      if (num(row.vendor_id, -1) === vendorId) out.push(row);
    }
    if (content.length < perPage) break;
    page += 1;
    if (page > 1000) {
      console.warn("Stopped after 1000 pages (safety cap)");
      break;
    }
  }
  return out;
}

/** Every PO row from all pages (eautomate total may be large). */
async function collectAllPagesFromApi(base) {
  const perPage = 100;
  const out = [];
  let page = 1;
  for (;;) {
    const data = await fetchPurchaseOrdersWithFilters(base, page, perPage, []);
    const content = Array.isArray(data.content) ? data.content : [];
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
  let vendorId;
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
    } else if (a && /^\d+$/.test(a)) vendorId = Number(a);
  }

  return { vendorId, filePath, syncAll, useStdin, skipMissingVendors, strictVendors };
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

  const { vendorId, filePath, syncAll, useStdin, skipMissingVendors, strictVendors } = opts;

  const modeCount = [syncAll, filePath != null, useStdin, vendorId != null].filter(Boolean).length;
  if (modeCount !== 1) {
    console.error(
      "Usage: node scripts/sync-eautomate-vendor-pos.mjs <vendorId>\n       node scripts/sync-eautomate-vendor-pos.mjs --all [--strict-vendors]\n       node scripts/sync-eautomate-vendor-pos.mjs --file <po-list.json> [--skip-missing-vendors]\n       node scripts/sync-eautomate-vendor-pos.mjs --stdin [--skip-missing-vendors]"
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
    rows = Array.isArray(raw.content) ? raw.content : raw;
    if (!Array.isArray(rows)) {
      throw new Error("Fixture must be an array or { content: array }");
    }
  } else if (useStdin) {
    const raw = JSON.parse(fs.readFileSync(0, "utf8"));
    rows = Array.isArray(raw.content) ? raw.content : raw;
    if (!Array.isArray(rows)) {
      throw new Error("stdin JSON must be an array or { content: array }");
    }
  } else {
    const base = (process.env.EAUTOMATE_BASE_URL || "https://web.eautomate.in").replace(
      /\/$/,
      ""
    );
    if (syncAll) {
      console.log(`Fetching all PO pages from ${base}…`);
      rows = await collectAllPagesFromApi(base);
      console.log(`Fetched ${rows.length} row(s) from API`);
    } else {
      console.log(`Fetching PO pages for vendor ${vendorId} from ${base}…`);
      rows = await collectForVendorFromApi(base, vendorId);
    }
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
      if (await upsertPo(client, row)) n += 1;
    }
    await client.query("COMMIT");
    const parts = [
      `Upserted ${n} purchase order row(s)${
        syncAll
          ? " (all vendors)"
          : vendorId != null
            ? ` for vendor ${vendorId}`
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
      parts.push("no vendor_id skips (all PO vendors exist in vendors)");
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
