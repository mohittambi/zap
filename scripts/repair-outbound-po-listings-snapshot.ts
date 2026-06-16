/**
 * Repair misaligned commercial fields in outbound PO listings_snapshot JSONB.
 *
 *   npm run repair:outbound-po-listings
 *   npm run repair:outbound-po-listings -- --po-number 1735810041652
 *   npm run repair:outbound-po-listings -- --dry-run
 *   npm run repair:outbound-po-listings -- --all --sync-consignment-items
 *   npm run repair:outbound-po-listings -- --po-number 1735810041652 --reparse-from-source
 *   npm run repair:outbound-po-listings -- --po-number 1735810041652 --reparse-from-attachment 42
 */
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { query } from "../src/server/db";
import { mapListingRowToItemColumns, syncOutboundConsignmentItemsCommercialFromListingRows } from "../src/server/services/outboundConsignmentItemsService";
import { OPEN_OUTBOUND_PO_SQL } from "../src/server/services/opsSkuPoControlService";
import {
  applySpreadsheetBufferToOutboundPo,
  getOutboundPoAttachmentById,
} from "../src/server/services/outboundPoSpreadsheetIngestService";
import {
  computeAnalyticsFromListingsRows,
  extractListingsRowsFromSnapshot,
  getOutboundPurchaseOrderById,
  updateOutboundPoAnalyticsObject,
  updateOutboundPoListingsSnapshot,
} from "../src/server/services/outboundPurchaseOrdersService";
import {
  isMisalignedCommercialRow,
  normalizeOutboundListingRow,
} from "../src/server/utils/outboundListingNormalize";
import {
  downloadBufferFromBucket,
  getOutboundBucket,
} from "../src/server/zapStorage";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

function parseArgs(argv: string[]) {
  let dryRun = false;
  let allPos = false;
  let syncConsignmentItems = false;
  let reparseFromSource = false;
  let poNumber: string | null = null;
  let reparseAttachmentId: number | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--dry-run") dryRun = true;
    if (a === "--all") allPos = true;
    if (a === "--sync-consignment-items") syncConsignmentItems = true;
    if (a === "--reparse-from-source") reparseFromSource = true;
    if (a === "--po-number" && argv[i + 1]) {
      poNumber = String(argv[i + 1]).trim();
      i += 1;
    }
    if (a === "--reparse-from-attachment" && argv[i + 1]) {
      reparseAttachmentId = Number(argv[i + 1]);
      i += 1;
    }
  }
  return {
    dryRun,
    allPos,
    syncConsignmentItems,
    poNumber,
    reparseFromSource,
    reparseAttachmentId,
  };
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

async function reparsePoFromAttachment(opts: {
  poId: number;
  poNumber: string;
  attachmentId: number;
  dryRun: boolean;
  syncConsignmentItems: boolean;
}): Promise<void> {
  const attachment = await getOutboundPoAttachmentById(opts.poId, opts.attachmentId);
  if (!attachment) {
    throw new Error(
      `Attachment ${opts.attachmentId} not found for PO ${opts.poNumber} (id ${opts.poId}).`
    );
  }

  console.log(
    `[repair:outbound-po-listings] Re-parse PO ${opts.poNumber} from attachment ${attachment.id}: ${attachment.original_filename}`
  );

  if (opts.dryRun) {
    console.log("  DRY RUN — would download and apply spreadsheet to listings_snapshot.");
    return;
  }

  const { buffer } = await downloadBufferFromBucket(
    getOutboundBucket(),
    attachment.stored_path
  );
  const result = await applySpreadsheetBufferToOutboundPo(
    opts.poId,
    buffer,
    attachment.original_filename,
    {
      confirmReplace: true,
      sourceAttachmentId: attachment.id,
    }
  );
  console.log(
    `  Applied ${result.newRowCount} row(s) (${result.rowsRepaired} repaired, ${result.stillMisaligned} still misaligned).`
  );

  if (opts.syncConsignmentItems) {
    const po = await getOutboundPurchaseOrderById(opts.poId);
    if (po) {
      const normalized = extractListingsRowsFromSnapshot(po.listings_snapshot);
      const bySku = new Map(
        normalized
          .filter((l) => l.po_secondary_sku != null)
          .map((l) => [String(l.po_secondary_sku).trim(), l])
      );
      const n = await syncConsignmentItemsForPo(opts.poNumber, bySku, false);
      if (n > 0) console.log(`  synced ${n} consignment item row(s)`);
    }
  }
}

async function main() {
  const {
    dryRun,
    allPos,
    syncConsignmentItems,
    poNumber,
    reparseFromSource,
    reparseAttachmentId,
  } = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  if (reparseFromSource || reparseAttachmentId != null) {
    if (!poNumber) {
      console.error("--po-number is required with --reparse-from-source or --reparse-from-attachment");
      process.exit(1);
    }
    const poR = await query(
      `SELECT id, po_number, analytics_object
         FROM outbound_purchase_orders
        WHERE TRIM(po_number) = TRIM($1)
        LIMIT 1`,
      [poNumber]
    );
    if (poR.rows.length === 0) {
      console.error(`PO not found: ${poNumber}`);
      process.exit(1);
    }
    const poRow = poR.rows[0] as {
      id: number;
      po_number: string;
      analytics_object: unknown;
    };
    let attachmentId = reparseAttachmentId;
    if (reparseFromSource) {
      const analytics =
        poRow.analytics_object && typeof poRow.analytics_object === "object"
          ? (poRow.analytics_object as Record<string, unknown>)
          : {};
      const fromAnalytics = Number(analytics.listings_source_attachment_id);
      if (!Number.isFinite(fromAnalytics) || fromAnalytics <= 0) {
        console.error(
          `No listings_source_attachment_id on PO ${poNumber}. Use --reparse-from-attachment <id> or re-apply from UI.`
        );
        process.exit(1);
      }
      attachmentId = fromAnalytics;
      console.log(
        `Using listings_source_attachment_id=${attachmentId} from analytics_object.`
      );
    }
    if (attachmentId == null || !Number.isFinite(attachmentId)) {
      console.error("Attachment id is required.");
      process.exit(1);
    }
    await reparsePoFromAttachment({
      poId: Number(poRow.id),
      poNumber: String(poRow.po_number),
      attachmentId,
      dryRun,
      syncConsignmentItems,
    });
    return;
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
