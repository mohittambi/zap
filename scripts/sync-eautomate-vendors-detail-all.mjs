#!/usr/bin/env node
/**
 * For every vendor in DB: GET /vendors/{id}, GET /vendors/listings/{id} and upsert (same as sync-eautomate-vendor).
 * Once per run: GET /listings/sku/names → eautomate_sku_names_cache.
 *
 * Prerequisites: vendors table populated (e.g. npm run sync:vendors:all).
 * Env: DATABASE_URL, EAUTOMATE_COOKIE or EAUTOMATE_BEARER_TOKEN, EAUTOMATE_BASE_URL (optional)
 *
 * Long runs: uses TCP keepalive, handles pg "Connection terminated unexpectedly" (pooler
 * idle timeout / server restart) by reconnecting and retrying the current vendor once.
 *
 * Usage: node scripts/sync-eautomate-vendors-detail-all.mjs
 *        node scripts/sync-eautomate-vendors-detail-all.mjs --limit 5
 *        node scripts/sync-eautomate-vendors-detail-all.mjs --vendor-id 12333
 *        node scripts/sync-eautomate-vendors-detail-all.mjs --continue-on-error
 *        node scripts/sync-eautomate-vendors-detail-all.mjs --start-after 12357
 *          → only vendors with id > 12357 (after last ok line in the log)
 *        node scripts/sync-eautomate-vendors-detail-all.mjs --start-after 12357 --skip-sku-names-cache
 *          → resume without re-fetching /listings/sku/names (saves one HTTP call)
 *    or: npm run sync:vendors:detail-all
 */
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { executeVendorSync } from "./lib/eautomateVendorUpsert.mjs";
import { fetchEautomate } from "./lib/eautomateAuthFetch.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Server / pooler closed the socket (Supabase idle timeout, restarts, etc.). */
function isConnectionError(err) {
  if (!err) return false;
  const msg = String(err.message || err);
  const code = err.code;
  return (
    /Connection terminated unexpectedly/i.test(msg) ||
    /connection.*closed/i.test(msg) ||
    /ECONNRESET|ETIMEDOUT|EPIPE|57P01|08006|08003/i.test(msg) ||
    code === "ECONNRESET" ||
    code === "EPIPE" ||
    code === "ETIMEDOUT"
  );
}

async function openPgClient(connectionString) {
  const c = new pg.Client({
    connectionString,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  });
  c.on("error", (err) => {
    console.error("[pg] client error (often idle disconnect):", err.message || err);
  });
  await c.connect();
  return c;
}

async function replacePgClient(oldClient, connectionString) {
  await oldClient.end().catch(() => {});
  return openPgClient(connectionString);
}

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
  let startAfterVendorId = null;
  let skipSkuNamesCache = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--limit" && argv[i + 1]) {
      limit = Math.max(1, Number.parseInt(argv[i + 1], 10));
      i += 1;
    } else if (a === "--vendor-id" && argv[i + 1]) {
      vendorId = Number.parseInt(argv[i + 1], 10);
      i += 1;
    } else if (a === "--start-after" && argv[i + 1]) {
      startAfterVendorId = Number.parseInt(argv[i + 1], 10);
      i += 1;
    } else if (a === "--skip-sku-names-cache") {
      skipSkuNamesCache = true;
    } else if (a === "--continue-on-error") {
      continueOnError = true;
    }
  }
  return { limit, vendorId, continueOnError, startAfterVendorId, skipSkuNamesCache };
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

  const {
    limit,
    vendorId: onlyVendorId,
    continueOnError,
    startAfterVendorId,
    skipSkuNamesCache,
  } = parseArgs(process.argv.slice(2));

  const base = (process.env.EAUTOMATE_BASE_URL || "https://web.eautomate.in").replace(
    /\/$/,
    ""
  );

  let client = await openPgClient(url);

  let fail = 0;
  let ok = 0;

  if (skipSkuNamesCache) {
    console.log("Skipping SKU names cache (--skip-sku-names-cache).");
  } else {
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
      await client.end().catch(() => {});
      process.exit(1);
    }
  }

  let sql = `SELECT id FROM vendors ORDER BY id ASC`;
  const params = [];
  if (onlyVendorId != null && Number.isFinite(onlyVendorId)) {
    sql = `SELECT id FROM vendors WHERE id = $1 ORDER BY id`;
    params.push(onlyVendorId);
  }
  let idsRes;
  try {
    idsRes = await client.query(sql, params);
  } catch (e) {
    if (isConnectionError(e)) {
      console.warn("[pg] Reconnecting after vendor list query failed…");
      client = await replacePgClient(client, url);
      idsRes = await client.query(sql, params);
    } else {
      throw e;
    }
  }
  let ids = idsRes.rows.map((r) => Number(r.id));

  if (
    onlyVendorId == null &&
    startAfterVendorId != null &&
    Number.isFinite(startAfterVendorId)
  ) {
    const before = ids.length;
    ids = ids.filter((id) => id > startAfterVendorId);
    console.log(
      `Resume: --start-after ${startAfterVendorId} → ${ids.length} vendor(s) to sync (dropped ${before - ids.length} already-done id(s) ≤ ${startAfterVendorId}).`
    );
  }

  if (limit != null) ids = ids.slice(0, limit);

  if (ids.length === 0) {
    console.error(
      "No vendor ids to process. Run npm run sync:vendors:all first, or check --vendor-id / --start-after."
    );
    await client.end();
    process.exit(1);
  }

  console.log(`Syncing ${ids.length} vendor(s) …`);

  for (const vid of ids) {
    let attempt = 0;
    const maxAttempts = 2;
    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        try {
          await client.query("SELECT 1");
        } catch (pingErr) {
          if (isConnectionError(pingErr)) {
            console.warn("[pg] Reconnecting before vendor", vid, "…");
            client = await replacePgClient(client, url);
          } else {
            throw pingErr;
          }
        }

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
        break;
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        if (isConnectionError(e) && attempt < maxAttempts) {
          console.warn(`Vendor ${vid}: DB connection lost, retrying once after reconnect…`);
          try {
            client = await replacePgClient(client, url);
          } catch (reErr) {
            fail += 1;
            console.error(`Vendor ${vid} failed (reconnect):`, reErr.message || reErr);
            if (!continueOnError) {
              await client.end().catch(() => {});
              process.exit(1);
            }
            break;
          }
          continue;
        }
        fail += 1;
        console.error(`Vendor ${vid} failed:`, e.message || e);
        if (!continueOnError) {
          await client.end().catch(() => {});
          process.exit(1);
        }
        break;
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
