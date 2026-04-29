/**
 * One-time / bulk sync: transporter master, valid box names, consignment_details/{id},
 * and listings/paginated/{po_number} → outbound_consignment_items (+ detail_raw on outbound_consignments).
 *
 * Other eAutomate endpoints (POST consignments list, GET PO, GET fetch_po_detail_files) are covered by
 * sync:outbound-consignments and sync:outbound-po-detail respectively.
 *
 * Env: DATABASE_URL, EAUTOMATE_COOKIE or EAUTOMATE_BEARER_TOKEN, optional EAUTOMATE_BASE_URL
 *
 * Usage:
 *   npm run sync:outbound-consignment-items
 *   npx tsx scripts/sync-eautomate-outbound-consignment-items.ts --consignment-id 6546
 *   npx tsx scripts/sync-eautomate-outbound-consignment-items.ts --dry-run --skip-master
 */
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { fetchEautomate } from "../src/server/eautomate-proxy";
import { query } from "../src/server/db";
import {
  replaceConsignmentItems,
  upsertTransporterDetails,
  upsertValidBoxNames,
  updateConsignmentDetailRaw,
  filterListingRowsForConsignment,
  listOutboundConsignmentIdsForSync,
  pickConsignmentIdFromListingRow,
} from "../src/server/services/outboundConsignmentItemsService";
import { extractListingsRowsFromSnapshot } from "../src/server/services/outboundPurchaseOrdersService";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

function fetchTimeoutMs(): number {
  const n = Number(process.env.EAUTOMATE_FETCH_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function fetchWithOptionalTimeout(
  url: string,
  init: RequestInit
): Promise<Response> {
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

/** Arrays from generic eAutomate envelopes. */
function pickStrFromObj(
  obj: Record<string, unknown>,
  keys: string[],
  maxLen: number
): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (v != null && v !== "") {
      const s = String(v).trim();
      if (s) return s.slice(0, maxLen);
    }
  }
  return null;
}

/** Resolve PO number from consignment_details JSON when DB row is missing po_number. */
function extractPoNumberFromDetail(detail: unknown): string | null {
  if (!detail || typeof detail !== "object") return null;
  const o = detail as Record<string, unknown>;
  const candidates: Record<string, unknown>[] = [o];
  for (const k of [
    "po",
    "purchaseOrder",
    "purchase_order",
    "incomingPurchaseOrder",
    "incoming_purchase_order",
  ]) {
    const v = o[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      candidates.push(v as Record<string, unknown>);
    }
  }
  for (const c of candidates) {
    const n = pickStrFromObj(
      c,
      [
        "po_number",
        "poNumber",
        "purchase_order_number",
        "purchaseOrderNumber",
        "po_no",
        "poNo",
      ],
      80
    );
    if (n) return n;
  }
  return null;
}

function extractArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const key of [
      "data",
      "content",
      "items",
      "rows",
      "results",
      "transporters",
      "records",
    ]) {
      const a = o[key];
      if (Array.isArray(a)) return a;
    }
  }
  return [];
}

function parseArgs(argv: string[]) {
  let consignmentId: number | null = null;
  let dryRun = false;
  let skipMaster = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--consignment-id" && argv[i + 1] !== undefined) {
      const n = Number(argv[i + 1]);
      if (Number.isFinite(n) && n >= 1) consignmentId = Math.trunc(n);
      i += 1;
    } else if (a === "--dry-run") {
      dryRun = true;
    } else if (a === "--skip-master") {
      skipMaster = true;
    }
  }
  return { consignmentId, dryRun, skipMaster };
}

async function syncMasterData(
  base: string,
  dryRun: boolean,
  skipMaster: boolean
): Promise<void> {
  if (skipMaster) {
    console.log("[consignment-items] Skipping master data (--skip-master).");
    return;
  }

  const tdUrl = `${base}/public/api/transporter_details`;
  console.log("[consignment-items] GET transporter_details…");
  const tdRes = await fetchWithOptionalTimeout(tdUrl, { cache: "no-store" });
  if (!tdRes.ok) {
    const t = await tdRes.text().catch(() => "");
    console.warn(`[consignment-items] transporter_details HTTP ${tdRes.status}`, t.slice(0, 300));
  } else {
    const tdJson: unknown = await tdRes.json();
    const tdRows = extractArray(tdJson);
    if (dryRun) {
      console.log(`[consignment-items] dry-run: would upsert ${tdRows.length} transporter row(s).`);
    } else {
      const n = await upsertTransporterDetails(tdRows);
      console.log(`[consignment-items] Upserted ${n} transporter row(s).`);
    }
  }

  const bnUrl = `${base}/public/api/incoming_purchase_orders/valid_box_names`;
  console.log("[consignment-items] GET valid_box_names…");
  const bnRes = await fetchWithOptionalTimeout(bnUrl, { cache: "no-store" });
  if (!bnRes.ok) {
    const t = await bnRes.text().catch(() => "");
    console.warn(`[consignment-items] valid_box_names HTTP ${bnRes.status}`, t.slice(0, 300));
  } else {
    const bnJson: unknown = await bnRes.json();
    const bnRows = extractArray(bnJson);
    if (dryRun) {
      console.log(`[consignment-items] dry-run: would upsert ${bnRows.length} box name row(s).`);
    } else {
      const n = await upsertValidBoxNames(bnRows);
      console.log(`[consignment-items] Upserted ${n} valid box name row(s).`);
    }
  }
}

async function syncOneConsignment(
  base: string,
  consignmentId: number,
  poNumber: string | null,
  dryRun: boolean
): Promise<{ ok: boolean; items: number; detailOk: boolean }> {
  let rowInDb = true;
  if (!dryRun) {
    const ex = await query(
      `SELECT 1 FROM outbound_consignments WHERE id = $1 LIMIT 1`,
      [consignmentId]
    );
    rowInDb = ex.rows.length > 0;
    if (!rowInDb) {
      console.warn(
        `[consignment-items] Consignment ${consignmentId} not in outbound_consignments; detail_raw/items will not be persisted (run sync:outbound-consignments first).`
      );
    }
  }

  const detailUrl = `${base}/public/api/incoming_purchase_orders/consignments/consignment_details/${encodeURIComponent(String(consignmentId))}`;
  console.log(`[consignment-items] GET consignment_details ${consignmentId}…`);
  const dRes = await fetchWithOptionalTimeout(detailUrl, { cache: "no-store" });
  let detailOk = false;
  let detailJson: unknown = null;
  if (!dRes.ok) {
    const t = await dRes.text().catch(() => "");
    console.warn(
      `[consignment-items] consignment_details HTTP ${dRes.status} for id=${consignmentId}`,
      t.slice(0, 200)
    );
  } else {
    detailOk = true;
    detailJson = await dRes.json();
    if (dryRun) {
      console.log(`[consignment-items] dry-run: would store detail_raw for ${consignmentId}.`);
    } else if (rowInDb) {
      await updateConsignmentDetailRaw(consignmentId, detailJson);
    }
  }

  const poResolved =
    (poNumber && poNumber.trim()) || extractPoNumberFromDetail(detailJson);
  if (!poResolved) {
    console.warn(
      `[consignment-items] Consignment ${consignmentId}: could not resolve po_number (DB + detail); skipping listings.`
    );
    return { ok: detailOk, items: 0, detailOk };
  }

  const pn = poResolved.trim();
  const listingsUrl = `${base}/public/api/incoming_purchase_orders/listings/paginated/${encodeURIComponent(pn)}?search_keyword=&page=1&count=10000`;
  console.log(`[consignment-items] GET listings/paginated for PO ${pn}…`);
  const lRes = await fetchWithOptionalTimeout(listingsUrl, { cache: "no-store" });
  if (!lRes.ok) {
    const t = await lRes.text().catch(() => "");
    console.warn(
      `[consignment-items] listings HTTP ${lRes.status} po=${pn}`,
      t.slice(0, 200)
    );
    return { ok: false, items: 0, detailOk };
  }

  const listingsJson: unknown = await lRes.json();
  const allRows = extractListingsRowsFromSnapshot(listingsJson);
  const filtered = filterListingRowsForConsignment(allRows, consignmentId);
  const hadConsignmentIds = allRows.some(
    (r) => pickConsignmentIdFromListingRow(r) != null
  );
  if (!hadConsignmentIds && allRows.length > 0) {
    console.warn(
      `[consignment-items] Listings for PO ${pn} had no consignment_id on rows; using all ${allRows.length} row(s).`
    );
  }

  if (dryRun) {
    console.log(
      `[consignment-items] dry-run: would replace ${filtered.length} item row(s) for consignment ${consignmentId}.`
    );
    return { ok: true, items: filtered.length, detailOk };
  }

  if (!rowInDb) {
    return { ok: detailOk, items: 0, detailOk };
  }

  const inserted = await replaceConsignmentItems(
    consignmentId,
    filtered,
    pn
  );
  console.log(
    `[consignment-items] Consignment ${consignmentId}: inserted ${inserted} item row(s).`
  );
  return { ok: true, items: inserted, detailOk };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const base = (process.env.EAUTOMATE_BASE_URL || "https://web.eautomate.in").replace(
    /\/$/,
    ""
  );
  const { consignmentId, dryRun, skipMaster } = parseArgs(process.argv.slice(2));

  console.log(
    `[consignment-items] base=${base} dryRun=${dryRun} consignmentId=${consignmentId ?? "all"}`
  );

  await syncMasterData(base, dryRun, skipMaster);

  let targets: { id: number; po_number: string | null }[];
  if (consignmentId != null) {
    const r = await listOutboundConsignmentIdsForSync();
    const hit = r.find((x) => x.id === consignmentId);
    targets = hit ? [hit] : [{ id: consignmentId, po_number: null }];
    if (!hit) {
      console.warn(
        `[consignment-items] Consignment id ${consignmentId} not in outbound_consignments; PO number will be taken from consignment_details if possible.`
      );
    }
  } else {
    targets = await listOutboundConsignmentIdsForSync();
  }

  console.log(`[consignment-items] Processing ${targets.length} consignment(s).`);

  let ok = 0;
  let fail = 0;
  for (const t of targets) {
    try {
      const r = await syncOneConsignment(base, t.id, t.po_number, dryRun);
      if (r.ok || r.detailOk) ok += 1;
      else fail += 1;
    } catch (e) {
      fail += 1;
      console.error(`[consignment-items] Error consignment ${t.id}:`, e);
    }
  }

  console.log(`[consignment-items] Done. ok-ish=${ok}, failed=${fail}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
