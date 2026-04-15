#!/usr/bin/env node
/**
 * GET eautomate /public/api/inventory/secondary_listings/paginated (search_keyword, page, count),
 * then for each row POST /public/api/inventory/secondary_listings/sku_wise_details with the row body.
 * Upserts secondary_listings (by eAutomate id) and labels_master_data from labels payload.
 * After a successful POST, also upserts warehouse listings (with eautomate_bins) and pack_combos
 * from response.pack_combo_childs (migration 035). Requires listings.id from eAutomate on each child listing.
 *
 * If POST returns 5xx (e.g. remote Laravel "could not open storage/logs/laravel.log"), the script
 * still upserts using the GET row so company_details / labels_data from paginated are not lost.
 * Optional: --post-retries N --post-retry-base-ms 500. --get-only skips POST entirely when GET is complete.
 *
 * Rows in DB that were created without an eAutomate id (e.g. CSV) are not updated by this script;
 * only API rows with numeric id are upserted.
 *
 * Env: DATABASE_URL (required)
 *      EAUTOMATE_BASE_URL, EAUTOMATE_COOKIE / EAUTOMATE_BEARER_TOKEN
 *      EAUTOMATE_FETCH_TIMEOUT_MS (optional, e.g. 120000) — abort hung HTTP calls
 *
 * Usage: node scripts/sync-eautomate-secondary-listings.mjs [--search-keyword msgb] [--count 1000]
 *        [--delay-ms 50] [--max-rows N] [--max-pages 1000]
 *        [--post-retries 2] [--post-retry-base-ms 500] [--get-only]
 *    or: npm run sync:secondary-listings
 */
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

function num(v, fallback = null) {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Optional: EAUTOMATE_FETCH_TIMEOUT_MS (default 0 = no timeout). Prevents silent hangs on slow networks. */
function fetchTimeoutMs() {
  const n = Number(process.env.EAUTOMATE_FETCH_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function fetchWithOptionalTimeout(url, init) {
  const ms = fetchTimeoutMs();
  if (!ms) return fetchEautomate(url, init);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetchEautomate(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

function extractRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

async function fetchSecondaryListingsPaginated(base, searchKeyword, page, perPage) {
  const u = new URL(`${base}/public/api/inventory/secondary_listings/paginated`);
  u.searchParams.set("search_keyword", searchKeyword ?? "");
  u.searchParams.set("page", String(page));
  u.searchParams.set("count", String(perPage));
  const res = await fetchWithOptionalTimeout(u.toString(), {
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

/** Map GET/POST row to canonical keys for DB (supports alias field names). */
function normalizeListingRowForUpsert(row) {
  if (!row || typeof row !== "object") return {};
  const o = { ...row };
  if (!Array.isArray(o.secondary_sku_company_details) && Array.isArray(o.company_details)) {
    o.secondary_sku_company_details = o.company_details;
  }
  if (
    (!o.secondary_sku_labels_data || typeof o.secondary_sku_labels_data !== "object") &&
    o.labels_data &&
    typeof o.labels_data === "object" &&
    !Array.isArray(o.labels_data)
  ) {
    o.secondary_sku_labels_data = o.labels_data;
  }
  return o;
}

function buildPostBody(row) {
  const r = normalizeListingRowForUpsert(row);
  if (!Array.isArray(r.secondary_sku_company_details)) {
    r.secondary_sku_company_details = [];
  }
  if (
    !r.secondary_sku_labels_data ||
    typeof r.secondary_sku_labels_data !== "object" ||
    Array.isArray(r.secondary_sku_labels_data)
  ) {
    r.secondary_sku_labels_data = {};
  }
  return r;
}

async function postSkuWiseDetails(base, body) {
  const url = `${base}/public/api/inventory/secondary_listings/sku_wise_details`;
  const res = await fetchWithOptionalTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} POST ${url}${text ? ` — ${text.slice(0, 400)}` : ""}`);
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { _unparsed_text: text.slice(0, 5000) };
  }
}

async function postSkuWiseWithRetry(base, body, retries, retryBaseMs) {
  let lastErr;
  const max = Math.max(0, retries);
  const baseDelay = Math.max(100, retryBaseMs || 500);
  for (let attempt = 0; attempt <= max; attempt += 1) {
    try {
      const data = await postSkuWiseDetails(base, body);
      return { ok: true, data };
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      const isRetryable = /HTTP (5\d\d|429)/.test(msg);
      if (attempt < max && isRetryable) {
        const wait = baseDelay * (attempt + 1);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      break;
    }
  }
  return { ok: false, error: lastErr };
}

/** Unwrap common API envelopes for merging flat + nested fields. */
function unwrapSkuWisePayload(data) {
  if (data == null || typeof data !== "object") return {};
  if (Array.isArray(data)) return {};
  if (data.data != null && typeof data.data === "object" && !Array.isArray(data.data)) {
    return data.data;
  }
  if (
    data.content != null &&
    typeof data.content === "object" &&
    !Array.isArray(data.content)
  ) {
    return data.content;
  }
  return data;
}

function deepMergeListing(getRow, postPayload) {
  const a = getRow && typeof getRow === "object" ? { ...getRow } : {};
  const b = postPayload && typeof postPayload === "object" ? { ...postPayload } : {};
  return { ...a, ...b };
}

function parseEautomateTimestamptz(v) {
  if (v == null || v === "") return null;
  const s = String(v);
  if (s.startsWith("-")) return null;
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function strOrNull(v, maxLen) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s === "NA") return null;
  if (maxLen != null) return s.slice(0, maxLen);
  return s;
}

async function nextListingsId(client) {
  const m = await client.query(`SELECT COALESCE(MAX(id), 0)::bigint AS m FROM listings`);
  return BigInt(m.rows[0].m) + 1n;
}

/**
 * Minimal listings row so pack_combos.component_sku_id FK is satisfied when eAutomate omits nested `listing`.
 */
async function ensureMinimalListingStub(client, skuIdRaw) {
  const skuId = String(skuIdRaw ?? "")
    .trim()
    .slice(0, 100);
  if (!skuId || skuId === "NA") return;
  const ex = await client.query(`SELECT id FROM listings WHERE sku_id = $1`, [skuId]);
  if (ex.rows.length > 0) return;
  const newId = await nextListingsId(client);
  await client.query(
    `INSERT INTO listings (
       id, sku_id, master_sku, inventory_sku_id, pack_combo_sku_id, sku_type,
       inventory_bypass_on, ops_tag, category, description, meta_fields,
       img_hd, img_white, img_wdim, img_link1, img_link2, no_of_constituents,
       actual_weight, dimension, bulk_price, keyword_pool, material_info,
       available_quantity, raw_created_at, raw_updated_at, eautomate_bins, updated_at
     ) VALUES (
       $1,$2,$3,'NA',NULL,'SINGLE','NO','',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,0,NULL,0,NULL,NULL,0,NULL,NULL,'[]'::jsonb, NOW()
     )`,
    [newId.toString(), skuId, skuId]
  );
}

/**
 * Upsert one warehouse listing row from eAutomate sku_wise_details listing object (includes bins[]).
 * If `listing.id` is missing, reuses existing row id for that sku_id or allocates MAX(id)+1 so the row is always written.
 */
async function upsertListingFromEautomate(client, listing) {
  if (!listing || typeof listing !== "object" || !listing.sku_id) return;
  const skuId = String(listing.sku_id).trim().slice(0, 100);
  if (!skuId || skuId === "NA") return;

  let id = num(listing.id, null);
  if (id == null) {
    const existing = await client.query(`SELECT id FROM listings WHERE sku_id = $1`, [skuId]);
    if (existing.rows.length > 0) {
      id = Number(existing.rows[0].id);
    } else {
      id = Number(await nextListingsId(client));
    }
  }

  const bins = Array.isArray(listing.bins) ? listing.bins : [];
  const params = [
    id,
    skuId,
    strOrNull(listing.master_sku, 100),
    strOrNull(listing.inventory_sku_id, 100),
    strOrNull(listing.pack_combo_sku_id, 100),
    strOrNull(listing.sku_type, 20),
    strOrNull(listing.inventory_bypass_on, 5) ?? "NO",
    strOrNull(listing.ops_tag, 50) ?? "",
    listing.category != null ? String(listing.category) : null,
    listing.description != null ? String(listing.description) : null,
    listing.meta_fields != null ? String(listing.meta_fields) : null,
    strOrNull(listing.img_hd),
    strOrNull(listing.img_white),
    strOrNull(listing.img_wdim),
    strOrNull(listing.img_link1),
    strOrNull(listing.img_link2),
    num(listing.no_of_constituents, 1) ?? 1,
    num(listing.actual_weight, 0) ?? 0,
    strOrNull(listing.dimension),
    num(listing.bulk_price, 0) ?? 0,
    listing.keyword_pool != null ? String(listing.keyword_pool) : null,
    listing.material_info != null ? String(listing.material_info) : null,
    num(listing.available_quantity, 0) ?? 0,
    parseEautomateTimestamptz(listing.created_at),
    parseEautomateTimestamptz(listing.updated_at),
    JSON.stringify(bins),
  ];

  await client.query(
    `INSERT INTO listings (
       id, sku_id, master_sku, inventory_sku_id, pack_combo_sku_id, sku_type,
       inventory_bypass_on, ops_tag, category, description, meta_fields,
       img_hd, img_white, img_wdim, img_link1, img_link2, no_of_constituents,
       actual_weight, dimension, bulk_price, keyword_pool, material_info,
       available_quantity, raw_created_at, raw_updated_at, eautomate_bins, updated_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26, NOW()
     )
     ON CONFLICT (sku_id) DO UPDATE SET
       master_sku = EXCLUDED.master_sku,
       inventory_sku_id = EXCLUDED.inventory_sku_id,
       pack_combo_sku_id = EXCLUDED.pack_combo_sku_id,
       sku_type = EXCLUDED.sku_type,
       inventory_bypass_on = EXCLUDED.inventory_bypass_on,
       ops_tag = EXCLUDED.ops_tag,
       category = EXCLUDED.category,
       description = EXCLUDED.description,
       meta_fields = EXCLUDED.meta_fields,
       img_hd = EXCLUDED.img_hd,
       img_white = EXCLUDED.img_white,
       img_wdim = EXCLUDED.img_wdim,
       img_link1 = EXCLUDED.img_link1,
       img_link2 = EXCLUDED.img_link2,
       no_of_constituents = EXCLUDED.no_of_constituents,
       actual_weight = EXCLUDED.actual_weight,
       dimension = EXCLUDED.dimension,
       bulk_price = EXCLUDED.bulk_price,
       keyword_pool = EXCLUDED.keyword_pool,
       material_info = EXCLUDED.material_info,
       available_quantity = EXCLUDED.available_quantity,
       raw_created_at = COALESCE(EXCLUDED.raw_created_at, listings.raw_created_at),
       raw_updated_at = COALESCE(EXCLUDED.raw_updated_at, listings.raw_updated_at),
       eautomate_bins = EXCLUDED.eautomate_bins,
       updated_at = NOW()`,
    params
  );
}

async function ensurePackParentListing(client, merged) {
  const sku =
    merged.pack_combo_sku_id != null ? String(merged.pack_combo_sku_id).slice(0, 100) : "";
  if (!sku || sku === "NA") return;
  const ex = await client.query(`SELECT id FROM listings WHERE sku_id = $1`, [sku]);
  if (ex.rows.length > 0) return;
  const newId = await nextListingsId(client);
  const avail = num(merged.available_quantity, 0) ?? 0;
  const msku = merged.master_sku != null ? String(merged.master_sku).slice(0, 100) : sku;
  const stype = merged.sku_type != null ? String(merged.sku_type).slice(0, 20) : "MULTI";
  await client.query(
    `INSERT INTO listings (
       id, sku_id, master_sku, inventory_sku_id, pack_combo_sku_id, sku_type,
       inventory_bypass_on, ops_tag, category, description, meta_fields,
       img_hd, img_white, img_wdim, img_link1, img_link2, no_of_constituents,
       actual_weight, dimension, bulk_price, keyword_pool, material_info,
       available_quantity, raw_created_at, raw_updated_at, eautomate_bins, updated_at
     ) VALUES (
       $1,$2,$3,'NA',NULL,$4,'NO','',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,0,NULL,0,NULL,NULL,$5,NULL,NULL,'[]'::jsonb, NOW()
     )`,
    [newId.toString(), sku, msku, stype, avail]
  );
}

/**
 * Persist pack_combo_childs listings (with bins), pack_combos edges, and optional top-level listings from POST body.
 */
async function ingestSkuWiseIntoWarehouse(client, unwrapped, merged) {
  if (!unwrapped || typeof unwrapped !== "object") return;

  for (const key of ["master_sku_listing", "pack_combo_sku_listing", "inventory_sku_listing"]) {
    const L = unwrapped[key];
    if (L && typeof L === "object" && L.sku_id) {
      await upsertListingFromEautomate(client, L);
    }
  }

  const childs = unwrapped.pack_combo_childs;
  if (!Array.isArray(childs) || childs.length === 0) return;

  const parent =
    merged.pack_combo_sku_id != null ? String(merged.pack_combo_sku_id).slice(0, 100) : "";
  if (!parent || parent === "NA") return;

  for (const c of childs) {
    const compSku = String(
      (c.listing && typeof c.listing === "object" && c.listing.sku_id != null
        ? c.listing.sku_id
        : null) ??
        c.inventory_sku_id ??
        ""
    )
      .trim()
      .slice(0, 100);
    if (!compSku || compSku === "NA") continue;

    if (c.listing && typeof c.listing === "object" && c.listing.sku_id) {
      await upsertListingFromEautomate(client, c.listing);
    } else {
      await ensureMinimalListingStub(client, compSku);
    }
  }

  await ensurePackParentListing(client, merged);

  await client.query(`DELETE FROM pack_combos WHERE parent_sku_id = $1`, [parent]);
  for (const c of childs) {
    const compSku = String(
      (c.listing && typeof c.listing === "object" && c.listing.sku_id != null
        ? c.listing.sku_id
        : null) ??
        c.inventory_sku_id ??
        ""
    )
      .trim()
      .slice(0, 100);
    if (!compSku || compSku === "NA") continue;
    const qty = num(c.sku_count, 1) ?? num(c.quantity, 1) ?? 1;
    await client.query(
      `INSERT INTO pack_combos (parent_sku_id, component_sku_id, quantity) VALUES ($1, $2, $3)`,
      [parent, compSku, qty]
    );
  }
}

async function upsertLabelsMaster(client, labelsObj, secondarySku) {
  if (!secondarySku || !labelsObj || typeof labelsObj !== "object") return;
  const pick = (k, alt) => labelsObj[k] ?? labelsObj[alt] ?? null;
  const ean = pick("ean_code", "eanCode");
  const size = pick("size", "Size");
  const color = pick("color", "Color");
  const oneSet = pick("one_set_contains", "oneSetContains");
  const material = pick("material", "Material");
  const mrpRaw = pick("mrp", "MRP");
  let mrp = null;
  if (mrpRaw != null && mrpRaw !== "") {
    const n = Number(mrpRaw);
    mrp = Number.isFinite(n) ? n : null;
  }

  await client.query(
    `INSERT INTO labels_master_data (
       secondary_sku, ean_code, size, color, one_set_contains, material, mrp, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (secondary_sku) DO UPDATE SET
       ean_code = EXCLUDED.ean_code,
       size = EXCLUDED.size,
       color = EXCLUDED.color,
       one_set_contains = EXCLUDED.one_set_contains,
       material = EXCLUDED.material,
       mrp = EXCLUDED.mrp,
       updated_at = NOW()`,
    [
      String(secondarySku).slice(0, 200),
      ean != null ? String(ean).slice(0, 32) : null,
      size != null ? String(size) : null,
      color != null ? String(color) : null,
      oneSet != null ? String(oneSet) : null,
      material != null ? String(material) : null,
      mrp,
    ]
  );
}

async function upsertSecondaryListing(client, merged, rawResponse) {
  const id = num(merged.id, null);
  if (id == null) return { ok: false, reason: "missing id" };
  const secondary_sku =
    merged.secondary_sku != null ? String(merged.secondary_sku).slice(0, 200) : "";
  if (!secondary_sku) return { ok: false, reason: "missing secondary_sku" };

  const companyDetails = Array.isArray(merged.secondary_sku_company_details)
    ? merged.secondary_sku_company_details
    : [];
  const labelsData =
    merged.secondary_sku_labels_data &&
    typeof merged.secondary_sku_labels_data === "object" &&
    !Array.isArray(merged.secondary_sku_labels_data)
      ? merged.secondary_sku_labels_data
      : {};

  const master_sku =
    merged.master_sku != null ? String(merged.master_sku).slice(0, 100) : null;
  const inventory_sku_id =
    merged.inventory_sku_id != null ? String(merged.inventory_sku_id).slice(0, 100) : null;
  const pack_combo_sku_id =
    merged.pack_combo_sku_id != null ? String(merged.pack_combo_sku_id).slice(0, 100) : null;
  const sku_type =
    merged.sku_type != null ? String(merged.sku_type).slice(0, 20) : null;
  const inventory_bypass_status =
    merged.inventory_bypass_status != null
      ? String(merged.inventory_bypass_status).slice(0, 20)
      : null;
  const ais_quantity = num(merged.ais_quantity, 0) ?? 0;
  const available_quantity = num(merged.available_quantity, 0) ?? 0;

  await client.query(
    `INSERT INTO secondary_listings (
       id, secondary_sku, master_sku, inventory_sku_id, pack_combo_sku_id,
       sku_type, inventory_bypass_status, ais_quantity, available_quantity,
       company_details, labels_data, sku_wise_details_raw, synced_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, NOW()
     )
     ON CONFLICT (id) DO UPDATE SET
       secondary_sku = EXCLUDED.secondary_sku,
       master_sku = EXCLUDED.master_sku,
       inventory_sku_id = EXCLUDED.inventory_sku_id,
       pack_combo_sku_id = EXCLUDED.pack_combo_sku_id,
       sku_type = EXCLUDED.sku_type,
       inventory_bypass_status = EXCLUDED.inventory_bypass_status,
       ais_quantity = EXCLUDED.ais_quantity,
       available_quantity = EXCLUDED.available_quantity,
       company_details = EXCLUDED.company_details,
       labels_data = EXCLUDED.labels_data,
       sku_wise_details_raw = EXCLUDED.sku_wise_details_raw,
       synced_at = NOW()`,
    [
      id,
      secondary_sku,
      master_sku,
      inventory_sku_id,
      pack_combo_sku_id,
      sku_type,
      inventory_bypass_status,
      ais_quantity,
      available_quantity,
      JSON.stringify(companyDetails),
      JSON.stringify(labelsData),
      JSON.stringify(rawResponse && typeof rawResponse === "object" ? rawResponse : {}),
    ]
  );

  if (Object.keys(labelsData).length > 0) {
    await upsertLabelsMaster(client, labelsData, secondary_sku);
  }

  return { ok: true };
}

function parseArgs(argv) {
  let searchKeyword = "";
  let count = 1000;
  let delayMs = 0;
  let maxRows = null;
  let maxPages = 1000;
  let postRetries = 2;
  let postRetryBaseMs = 500;
  let getOnly = false;

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--search-keyword" && argv[i + 1]) {
      searchKeyword = argv[i + 1];
      i += 1;
    } else if (a === "--count" && argv[i + 1]) {
      count = Math.min(2000, Math.max(1, Number(argv[i + 1]) || 1000));
      i += 1;
    } else if (a === "--delay-ms" && argv[i + 1]) {
      delayMs = Math.max(0, Number(argv[i + 1]) || 0);
      i += 1;
    } else if (a === "--max-rows" && argv[i + 1]) {
      maxRows = Math.max(1, Number(argv[i + 1]) || 1);
      i += 1;
    } else if (a === "--max-pages" && argv[i + 1]) {
      maxPages = Math.max(1, Number(argv[i + 1]) || 1000);
      i += 1;
    } else if (a === "--post-retries" && argv[i + 1]) {
      postRetries = Math.min(10, Math.max(0, Number(argv[i + 1]) || 0));
      i += 1;
    } else if (a === "--post-retry-base-ms" && argv[i + 1]) {
      postRetryBaseMs = Math.max(50, Number(argv[i + 1]) || 500);
      i += 1;
    } else if (a === "--get-only") {
      getOnly = true;
    }
  }
  return {
    searchKeyword,
    count,
    delayMs,
    maxRows,
    maxPages,
    postRetries,
    postRetryBaseMs,
    getOnly,
  };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const base = (process.env.EAUTOMATE_BASE_URL || "https://web.eautomate.in").replace(/\/$/, "");
  const {
    searchKeyword,
    count,
    delayMs,
    maxRows,
    maxPages,
    postRetries,
    postRetryBaseMs,
    getOnly,
  } = parseArgs(process.argv.slice(2));

  const progressEvery = Math.max(1, Number(process.env.SYNC_SECONDARY_PROGRESS_EVERY) || 25);

  console.log(
    `[secondary-listings] Starting — base=${base} search_keyword=${JSON.stringify(searchKeyword)} count/page=${count} maxPages=${maxPages}${maxRows != null ? ` maxRows=${maxRows}` : ""} getOnly=${getOnly} delayMs=${delayMs}`
  );
  if (fetchTimeoutMs()) {
    console.log(
      `[secondary-listings] EAUTOMATE_FETCH_TIMEOUT_MS=${fetchTimeoutMs()} (requests will abort if slower)`
    );
  } else {
    console.log(
      "[secondary-listings] No fetch timeout (set EAUTOMATE_FETCH_TIMEOUT_MS=120000 if a call hangs)"
    );
  }

  console.log("[secondary-listings] Connecting to database…");
  const pool = new pg.Pool({ connectionString: url });
  const client = await pool.connect();
  console.log("[secondary-listings] Database connected.");
  let processed = 0;
  let ok = 0;
  let okGetFallback = 0;
  let failed = 0;

  try {
    let lastPageFetched = 0;
    outer: for (let page = 1; page <= maxPages; page += 1) {
      console.log(
        `[secondary-listings] Fetching paginated page ${page} (this can take a while for large count=)…`
      );
      const t0 = Date.now();
      const envelope = await fetchSecondaryListingsPaginated(
        base,
        searchKeyword,
        page,
        count
      );
      const rows = extractRows(envelope);
      lastPageFetched = page;
      console.log(
        `[secondary-listings] Page ${page} received ${Array.isArray(rows) ? rows.length : 0} row(s) in ${Date.now() - t0}ms`
      );
      if (!Array.isArray(rows) || rows.length === 0) break;

      for (const getRow of rows) {
        if (maxRows != null && processed >= maxRows) {
          break outer;
        }
        processed += 1;
        const normalizedGet = normalizeListingRowForUpsert(getRow);
        const postBody = buildPostBody(getRow);
        try {
          let rawPost;
          let usedGetFallback = false;

          if (getOnly) {
            rawPost = {
              _sync_note:
                "POST skipped (--get-only); sku_wise_details_raw contains no server response.",
            };
          } else {
            const pr = await postSkuWiseWithRetry(
              base,
              postBody,
              postRetries,
              postRetryBaseMs
            );
            if (pr.ok) {
              rawPost = pr.data;
            } else {
              usedGetFallback = true;
              const errMsg =
                pr.error instanceof Error ? pr.error.message : String(pr.error);
              rawPost = {
                _post_failed: true,
                _error: errMsg.slice(0, 2000),
                _hint:
                  "eAutomate returned an error on POST sku_wise_details (e.g. HTTP 500). Common cause: remote Laravel cannot write storage/logs/laravel.log — fix on eAutomate server. Row was saved from GET paginated payload only.",
              };
              if (/HTTP 5\d\d/.test(errMsg)) {
                console.warn(
                  `GET fallback (POST failed) ${getRow?.secondary_sku ?? getRow?.id}: ${errMsg.slice(0, 120)}…`
                );
              } else {
                console.warn(
                  `GET fallback ${getRow?.secondary_sku ?? getRow?.id}: ${errMsg.slice(0, 200)}`
                );
              }
            }
          }

          const unwrapped = unwrapSkuWisePayload(rawPost);
          const merged = deepMergeListing(normalizedGet, unwrapped);
          await client.query("BEGIN");
          const r = await upsertSecondaryListing(client, merged, rawPost);
          await client.query("COMMIT");
          if (
            r.ok &&
            !getOnly &&
            rawPost &&
            typeof rawPost === "object" &&
            !rawPost._post_failed &&
            !rawPost._sync_note
          ) {
            try {
              await client.query("BEGIN");
              await ingestSkuWiseIntoWarehouse(client, unwrapped, merged);
              await client.query("COMMIT");
            } catch (ingErr) {
              await client.query("ROLLBACK").catch(() => {});
              console.warn(
                `Warehouse ingest (listings/pack_combos) ${merged.secondary_sku ?? getRow?.secondary_sku}:`,
                ingErr instanceof Error ? ingErr.message : ingErr
              );
            }
          }
          if (r.ok) {
            ok += 1;
            if (usedGetFallback || getOnly) okGetFallback += 1;
          } else {
            failed += 1;
            console.warn(`Skip row: ${r.reason}`, getRow?.secondary_sku ?? getRow?.id);
          }
        } catch (e) {
          await client.query("ROLLBACK").catch(() => {});
          failed += 1;
          console.error(
            `Row ${getRow?.secondary_sku ?? getRow?.id}:`,
            e instanceof Error ? e.message : e
          );
        }
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        if (processed > 0 && processed % progressEvery === 0) {
          console.log(
            `[secondary-listings] … processed ${processed} row(s) so far (${ok} ok, ${failed} failed/skipped)`
          );
        }
      }

      if (rows.length < count) break;
      if (maxRows != null && processed >= maxRows) break;
    }

    console.log(
      `Done. Last paginated page fetched: ${lastPageFetched || 0}. Processed ${processed} listing(s): ${ok} saved (${okGetFallback} from GET only / POST skipped), ${failed} failed/skipped.`
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
