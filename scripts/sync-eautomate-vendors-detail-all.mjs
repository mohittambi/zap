#!/usr/bin/env node
/**
 * For every vendor in DB: GET /vendors/{id}, GET /vendors/listings/{id} and upsert (same as sync-eautomate-vendor).
 * Once per run: GET /listings/sku/names → eautomate_sku_names_cache.
 *
 * Prerequisites: vendors table populated (e.g. npm run sync:vendors:all).
 * Env: DATABASE_URL, EAUTOMATE_COOKIE or EAUTOMATE_BEARER_TOKEN, EAUTOMATE_BASE_URL (optional)
 *
 * Usage: node scripts/sync-eautomate-vendors-detail-all.mjs
 *        node scripts/sync-eautomate-vendors-detail-all.mjs --limit 5
 *        node scripts/sync-eautomate-vendors-detail-all.mjs --vendor-id 12333
 *        node scripts/sync-eautomate-vendors-detail-all.mjs --continue-on-error
 *    or: npm run sync:vendors:detail-all
 */
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { executeVendorSync } from "./lib/eautomateVendorUpsert.mjs";
import { fetchEautomate } from "./lib/eautomateAuthFetch.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function fetchJson(url) {
  const res = await fetchEautomate(url, { cache: "no-store" });
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
    throw new Error(`HTTP ${res.status} ${url}${hint}${text ? ` — ${text.slice(0, 200)}` : ""}`);
  }
  return res.json();
}

function toJsonbString(value) {
  return JSON.stringify(value, (_k, v) => {
    if (typeof v === "bigint") return v.toString();
    if (typeof v === "number" && !Number.isFinite(v)) return null;
    return v;
  });
}

function normalizeSkuNamesPayload(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    for (const k of ["data", "content", "names", "sku_names"]) {
      const a = raw[k];
      if (Array.isArray(a)) return a;
    }
  }
  return [];
}

function parseArgs(argv) {
  let limit = null;
  let vendorId = null;
  let continueOnError = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--limit" && argv[i + 1]) {
      limit = Math.max(1, Number.parseInt(argv[i + 1], 10));
      i += 1;
    } else if (a === "--vendor-id" && argv[i + 1]) {
      vendorId = Number.parseInt(argv[i + 1], 10);
      i += 1;
    } else if (a === "--continue-on-error") {
      continueOnError = true;
    }
  }
  return { limit, vendorId, continueOnError };
}

async function upsertSkuNamesCache(client, rawPayload) {
  const normalized = normalizeSkuNamesPayload(rawPayload);
  const jsonText = toJsonbString(normalized);
  await client.query(
    `INSERT INTO eautomate_sku_names_cache (id, payload, synced_at)
     VALUES (1, $1::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET
       payload = EXCLUDED.payload,
       synced_at = NOW()`,
    [jsonText]
  );
}

async function main() {
  const dotenv = await import("dotenv");
  const webRoot = path.resolve(__dirname, "..");
  dotenv.config({ path: path.join(webRoot, ".env.local") });
  dotenv.config({ path: path.join(webRoot, ".env") });

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const { limit, vendorId: onlyVendorId, continueOnError } = parseArgs(
    process.argv.slice(2)
  );

  const base = (process.env.EAUTOMATE_BASE_URL || "https://web.eautomate.in").replace(
    /\/$/,
    ""
  );

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  let fail = 0;
  let ok = 0;

  try {
    console.log("Fetching /public/api/listings/sku/names …");
    const skuNamesRaw = await fetchJson(`${base}/public/api/listings/sku/names`);
    await client.query("BEGIN");
    await upsertSkuNamesCache(client, skuNamesRaw);
    await client.query("COMMIT");
    const arr = normalizeSkuNamesPayload(skuNamesRaw);
    console.log(`SKU names cache updated (${arr.length} entries in normalized array).`);
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Failed to refresh SKU names cache:", e.message || e);
    process.exit(1);
  }

  let sql = `SELECT id FROM vendors ORDER BY id ASC`;
  const params = [];
  if (onlyVendorId != null && Number.isFinite(onlyVendorId)) {
    sql = `SELECT id FROM vendors WHERE id = $1 ORDER BY id`;
    params.push(onlyVendorId);
  }
  const idsRes = await client.query(sql, params);
  let ids = idsRes.rows.map((r) => Number(r.id));
  if (limit != null) ids = ids.slice(0, limit);

  if (ids.length === 0) {
    console.error(
      "No vendor ids to process. Run npm run sync:vendors:all first, or check --vendor-id."
    );
    await client.end();
    process.exit(1);
  }

  console.log(`Syncing ${ids.length} vendor(s) …`);

  for (const vid of ids) {
    try {
      const vendorUrl = `${base}/public/api/vendors/${vid}`;
      const listingsUrl = `${base}/public/api/vendors/listings/${vid}`;
      console.log(`Vendor ${vid}: fetching detail + listings…`);
      const vendor = await fetchJson(vendorUrl);
      const listingRows = await fetchJson(listingsUrl);
      if (!Array.isArray(listingRows)) {
        throw new Error("listings: expected array");
      }
      console.log(`Vendor ${vid}: upserting ${listingRows.length} listing row(s) to Postgres…`);

      await client.query("BEGIN");
      const stats = await executeVendorSync(client, vendor, listingRows);
      await client.query("COMMIT");
      console.log(
        `Vendor ${vid} ok — warehouses=${stats.warehouseCount}, lines=${stats.listingRowCount}, specs=${stats.specsCount}, skipped=${stats.skipped}`
      );
      ok += 1;
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      fail += 1;
      console.error(`Vendor ${vid} failed:`, e.message || e);
      if (!continueOnError) {
        await client.end();
        process.exit(1);
      }
    }
  }

  await client.end();
  console.log(`Done. ${ok} ok, ${fail} failed.`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
