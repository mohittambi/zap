/**
 * Repair misaligned commercial fields in outbound PO listings_snapshot JSONB.
 *
 *   npm run repair:outbound-po-listings
 *   npm run repair:outbound-po-listings -- --po-number 1735810041652
 *   npm run repair:outbound-po-listings -- --dry-run
 *   npm run repair:outbound-po-listings -- --all --sync-consignment-items
 */
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { query } from "../src/server/db";
import { mapListingRowToItemColumns } from "../src/server/services/outboundConsignmentItemsService";
import { OPEN_OUTBOUND_PO_SQL } from "../src/server/services/opsSkuPoControlService";
import {
  computeAnalyticsFromListingsRows,
  extractListingsRowsFromSnapshot,
  updateOutboundPoAnalyticsObject,
  updateOutboundPoListingsSnapshot,
} from "../src/server/services/outboundPurchaseOrdersService";
import {
  isMisalignedCommercialRow,
  normalizeOutboundListingRow,
} from "../src/server/utils/outboundListingNormalize";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

function parseArgs(argv: string[]) {
  let dryRun = false;
  let allPos = false;
  let syncConsignmentItems = false;
  let poNumber: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--dry-run") dryRun = true;
    if (a === "--all") allPos = true;
    if (a === "--sync-consignment-items") syncConsignmentItems = true;
    if (a === "--po-number" && argv[i + 1]) {
      poNumber = String(argv[i + 1]).trim();
      i += 1;
    }
  }
  return { dryRun, allPos, syncConsignmentItems, poNumber };
}

function applyNormalizedRowsToSnapshot(
  snapshot: unknown,
  normalizedRows: Record<string, unknown>[]
): Record<string, unknown> {
  if (Array.isArray(snapshot)) {
    return normalizedRows as unknown as Record<string, unknown>;
  }
  if (snapshot == null || typeof snapshot !== "object") {
    return { content: normalizedRows };
  }
  const o = { ...(snapshot as Record<string, unknown>) };
  for (const k of ["content", "items", "data", "rows", "results"] as const) {
    if (Array.isArray(o[k])) {
      return { ...o, [k]: normalizedRows };
    }
  }
  return { ...o, content: normalizedRows };
}

async function syncConsignmentItemsForPo(
  poNumber: string,
  rowsBySku: Map<string, Record<string, unknown>>,
  dryRun: boolean
): Promise<number> {
  const itemsR = await query(
    `SELECT id, po_secondary_sku, raw
       FROM outbound_consignment_items
      WHERE po_number = $1`,
    [poNumber]
  );
  let updated = 0;
  for (const item of itemsR.rows as {
    id: number;
    po_secondary_sku: string | null;
    raw: unknown;
  }[]) {
    const sku = item.po_secondary_sku != null ? String(item.po_secondary_sku).trim() : "";
    const normalized = rowsBySku.get(sku);
    if (!sku || !normalized) continue;

    const cols = mapListingRowToItemColumns(normalized, poNumber);
    if (dryRun) {
      updated += 1;
      continue;
    }
    await query(
      `UPDATE outbound_consignment_items
          SET po_number = $2,
              po_secondary_sku = $3,
              company_code_primary = $4,
              company_code_secondary = $5,
              mrp = $6,
              original_demand = $7,
              raw = $8::jsonb
        WHERE id = $1`,
      [
        item.id,
        cols.po_number,
        cols.po_secondary_sku,
        cols.company_code_primary,
        cols.company_code_secondary,
        cols.mrp,
        cols.original_demand,
        cols.rawJson,
      ]
    );
    updated += 1;
  }
  return updated;
}

async function main() {
  const { dryRun, allPos, syncConsignmentItems, poNumber } = parseArgs(
    process.argv.slice(2)
  );
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const where: string[] = [];
  const params: unknown[] = [];
  if (poNumber) {
    params.push(poNumber);
    where.push(`TRIM(o.po_number) = TRIM($${params.length})`);
  } else if (!allPos) {
    where.push(OPEN_OUTBOUND_PO_SQL.replace(/\bpo\./g, "o."));
  }

  const r = await query(
    `SELECT o.id, o.po_number, o.listings_snapshot
       FROM outbound_purchase_orders o
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY o.id ASC`,
    params
  );

  if (r.rows.length === 0) {
    console.log("[repair:outbound-po-listings] No POs matched.");
    return;
  }

  console.log(
    `[repair:outbound-po-listings] ${dryRun ? "DRY RUN — " : ""}Processing ${r.rows.length} PO(s)…`
  );

  let posUpdated = 0;
  let rowsRepaired = 0;
  let stillMisaligned = 0;

  for (const row of r.rows as {
    id: number;
    po_number: string;
    listings_snapshot: unknown;
  }[]) {
    const snapshot = row.listings_snapshot;
    const lines = extractListingsRowsFromSnapshot(snapshot);
    if (lines.length === 0) continue;

    const normalized: Record<string, unknown>[] = [];
    let poRepaired = 0;
    let poMisaligned = 0;
    const repairsBySku: string[] = [];

    for (const line of lines) {
      const result = normalizeOutboundListingRow(line);
      normalized.push(result.row);
      if (result.repaired) {
        poRepaired += 1;
        repairsBySku.push(
          `${String(line.po_secondary_sku ?? "?")}: ${result.repairs.join(",")}`
        );
      }
      if (isMisalignedCommercialRow(result.row)) poMisaligned += 1;
    }

    if (poRepaired === 0) continue;

    rowsRepaired += poRepaired;
    stillMisaligned += poMisaligned;
    const pn = String(row.po_number);
    console.log(
      `PO ${pn}: repaired ${poRepaired}/${lines.length} line(s)` +
        (poMisaligned ? `; ${poMisaligned} still misaligned` : "")
    );
    for (const line of repairsBySku.slice(0, 5)) {
      console.log(`  - ${line}`);
    }
    if (repairsBySku.length > 5) {
      console.log(`  … and ${repairsBySku.length - 5} more`);
    }

    if (dryRun) {
      posUpdated += 1;
      continue;
    }

    const newSnapshot = applyNormalizedRowsToSnapshot(snapshot, normalized);
    await updateOutboundPoListingsSnapshot(row.id, newSnapshot);
    await updateOutboundPoAnalyticsObject(
      row.id,
      computeAnalyticsFromListingsRows(normalized)
    );
    posUpdated += 1;

    if (syncConsignmentItems) {
      const bySku = new Map(
        normalized
          .filter((l) => l.po_secondary_sku != null)
          .map((l) => [String(l.po_secondary_sku).trim(), l])
      );
      const n = await syncConsignmentItemsForPo(pn, bySku, false);
      if (n > 0) console.log(`  synced ${n} consignment item row(s)`);
    }
  }

  console.log(
    `[repair:outbound-po-listings] Done. POs ${dryRun ? "would update" : "updated"}: ${posUpdated}; lines repaired: ${rowsRepaired}; still misaligned: ${stillMisaligned}.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
