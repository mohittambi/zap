import getPool, { query } from "@/server/db";
import { AppError } from "@/server/errors";
import {
  eautomateConfigured,
  fetchEautomate,
  getEautomateBaseUrl,
} from "@/server/eautomate-proxy";

/** JSON text for Postgres jsonb (BigInt + non-finite numbers; avoids driver/json edge cases). */
function toJsonbString(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (typeof v === "bigint") return v.toString();
    if (typeof v === "number" && !Number.isFinite(v)) return null;
    return v;
  });
}

function num(v: unknown, fallback: number | null = null): number | null {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function pick(
  obj: Record<string, unknown> | null | undefined,
  keys: string[]
): unknown {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (v != null && v !== "") return v;
  }
  return undefined;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v))
    return v as Record<string, unknown>;
  return null;
}

function extractArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const o = asRecord(data);
  if (!o) return [];
  for (const k of [
    "content",
    "data",
    "items",
    "grns",
    "results",
    "purchase_order_grns",
  ]) {
    const a = o[k];
    if (Array.isArray(a)) return a;
  }
  return [];
}

function normalizeSkuNamesPayload(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  const o = asRecord(raw);
  if (!o) return [];
  for (const k of ["data", "content", "names", "sku_names"]) {
    const a = o[k];
    if (Array.isArray(a)) return a;
  }
  return [];
}

function normalizeVendorListingsPayload(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  return extractArray(raw);
}

function unwrapEntity(raw: unknown): Record<string, unknown> | null {
  const o = asRecord(raw);
  if (!o) return null;
  const inner = pick(o, ["data", "purchase_order", "po", "vendor", "result"]);
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    return { ...o, ...(inner as Record<string, unknown>) };
  }
  return o;
}

async function fetchEautomateJson(pathSuffix: string): Promise<unknown> {
  if (!eautomateConfigured()) {
    throw new AppError(
      "eautomate is not configured: set EAUTOMATE_COOKIE (or EAUTOMATE_BEARER_TOKEN) in .env.local.",
      503
    );
  }
  const base = getEautomateBaseUrl();
  const u = `${base}/public/api${pathSuffix.startsWith("/") ? pathSuffix : `/${pathSuffix}`}`;
  const res = await fetchEautomate(u, {
    cache: "no-store",
    signal: AbortSignal.timeout(120_000),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = `eautomate HTTP ${res.status}`;
    try {
      const j = JSON.parse(text) as { message?: string };
      if (j?.message) msg = j.message;
    } catch {
      /* ignore */
    }
    throw new AppError(msg, res.status >= 500 ? 502 : res.status);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AppError("Invalid JSON from eautomate", 502);
  }
}

function skuFromLine(line: Record<string, unknown>): string | null {
  const listing = asRecord(pick(line, ["listing", "Listing"]));
  const fromListing = listing
    ? str(pick(listing, ["sku_id", "skuId", "SKU_ID"]))
    : null;
  return (
    fromListing ??
    str(pick(line, ["sku_id", "skuId", "SKU_ID", "secondary_sku_id"]))
  );
}

function grnIdFromRow(row: Record<string, unknown>): number | null {
  const nested = asRecord(row.grn);
  const top = num(pick(row, ["grn_id", "grnId"]), null);
  if (top != null) return top;
  if (nested) {
    const g = num(pick(nested, ["grn_id", "grnId"]), null);
    if (g != null) return g;
  }
  return num(pick(row, ["id"]), null);
}

export async function ingestPoDetailsByVendorAndPo(
  vendorId: number,
  poId: number
): Promise<void> {
  if (!Number.isFinite(vendorId) || vendorId < 1) {
    throw new AppError("Invalid vendor id", 400);
  }
  if (!Number.isFinite(poId) || poId < 1) {
    throw new AppError("Invalid po id", 400);
  }

  const [vendorJson, listingsJson, skuNamesJson, poJson, addedJson, grnsJson] =
    await Promise.all([
      fetchEautomateJson(`/vendors/${vendorId}`).catch(() => null),
      fetchEautomateJson(`/vendors/listings/${vendorId}`).catch(() => null),
      fetchEautomateJson(`/listings/sku/names`).catch(() => null),
      fetchEautomateJson(`/purchase_orders/${poId}`).catch(() => null),
      fetchEautomateJson(`/purchase_orders/addedItems/withListing/${poId}`).catch(
        () => null
      ),
      fetchEautomateJson(`/purchase_orders/grn/get_by_po_id/${poId}`).catch(
        () => null
      ),
    ]);

  const po = unwrapEntity(poJson) ?? asRecord(poJson) ?? {};
  const vidFromPo = num(pick(po, ["vendor_id", "vendorId"]), null);
  if (vidFromPo != null && vidFromPo !== vendorId) {
    throw new AppError(
      `PO ${poId} belongs to vendor ${vidFromPo}, not ${vendorId}`,
      400
    );
  }

  const vendorListingsArr = normalizeVendorListingsPayload(listingsJson);
  const skuNamesArr = normalizeSkuNamesPayload(skuNamesJson);

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO inbound_po_detail_snapshot (
        po_id, vendor_id, synced_at,
        vendor_raw, vendor_listings_raw, sku_names_raw, po_raw
      ) VALUES ($1, $2, NOW(), $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb)
      ON CONFLICT (po_id) DO UPDATE SET
        vendor_id = EXCLUDED.vendor_id,
        synced_at = NOW(),
        vendor_raw = EXCLUDED.vendor_raw,
        vendor_listings_raw = EXCLUDED.vendor_listings_raw,
        sku_names_raw = EXCLUDED.sku_names_raw,
        po_raw = EXCLUDED.po_raw`,
      [
        poId,
        vendorId,
        toJsonbString(vendorJson ?? {}),
        toJsonbString(vendorListingsArr),
        toJsonbString(skuNamesArr),
        toJsonbString(poJson ?? {}),
      ]
    );

    await client.query(`DELETE FROM inbound_po_detail_lines WHERE po_id = $1`, [
      poId,
    ]);
    const lineRows = extractArray(addedJson);
    for (let i = 0; i < lineRows.length; i += 1) {
      const line = asRecord(lineRows[i]);
      if (!line) continue;
      const sku = skuFromLine(line);
      await client.query(
        `INSERT INTO inbound_po_detail_lines (po_id, line_index, sku_id, raw)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [poId, i, sku, toJsonbString(line)]
      );
    }

    await client.query(`DELETE FROM inbound_po_detail_grns WHERE po_id = $1`, [
      poId,
    ]);
    const grnRows = extractArray(grnsJson);
    for (let i = 0; i < grnRows.length; i += 1) {
      const row = asRecord(grnRows[i]);
      if (!row) continue;
      const gid = grnIdFromRow(row);
      await client.query(
        `INSERT INTO inbound_po_detail_grns (po_id, sort_index, grn_id, raw)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [poId, i, gid, toJsonbString(row)]
      );
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function snapshotExists(poId: number): Promise<boolean> {
  const r = await query(
    `SELECT 1 FROM inbound_po_detail_snapshot WHERE po_id = $1 LIMIT 1`,
    [poId]
  );
  return r.rows.length > 0;
}

export async function getPoDetailsBundle(vendorId: number, poId: number) {
  if (!Number.isFinite(vendorId) || vendorId < 1) {
    throw new AppError("Invalid vendor id", 400);
  }
  if (!Number.isFinite(poId) || poId < 1) {
    throw new AppError("Invalid po id", 400);
  }

  const snapR = await query(
    `SELECT po_id, vendor_id, synced_at, vendor_raw, vendor_listings_raw, sku_names_raw, po_raw
     FROM inbound_po_detail_snapshot WHERE po_id = $1`,
    [poId]
  );
  if (snapR.rows.length === 0) {
    throw new AppError("PO detail not found; run sync or open with refresh=1", 404);
  }
  const snap = snapR.rows[0] as Record<string, unknown>;
  const snapVendor = Number(snap.vendor_id);
  if (snapVendor !== vendorId) {
    throw new AppError("PO detail vendor mismatch", 400);
  }

  const linesR = await query(
    `SELECT line_index, sku_id, raw FROM inbound_po_detail_lines WHERE po_id = $1 ORDER BY line_index`,
    [poId]
  );
  const grnsR = await query(
    `SELECT sort_index, grn_id, raw FROM inbound_po_detail_grns WHERE po_id = $1 ORDER BY sort_index`,
    [poId]
  );

  return {
    snapshot: snap,
    lines: linesR.rows,
    grns: grnsR.rows,
  };
}
