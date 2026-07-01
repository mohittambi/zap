import { query } from "@/server/db";
import { enrichListingsSnapshotWithZapEan } from "@/server/services/eanMappingsService";
import {
  enrichListingsSnapshotWithListingImages,
  extractListingsRowsFromSnapshot,
  getOutboundPurchaseOrderByPoNumber,
  updateOutboundPoListingsSnapshot,
} from "@/server/services/outboundPurchaseOrdersService";
import { getOutboundConsignmentById } from "@/server/services/outboundConsignmentsService";

function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function skuKey(sku: string): string {
  return sku.trim().toLowerCase();
}

/** Channel item code from a listings snapshot row. */
export function poSecondarySkuFromListingRow(row: Record<string, unknown>): string {
  return str(row.po_secondary_sku) || str(row.item_code) || str(row.sku);
}

function demandFromListingRow(row: Record<string, unknown>): number {
  return (
    num(row.demand) ||
    num(row.demand_quantity) ||
    num(row.original_demand) ||
    num(row.box_quantity)
  );
}

export type ConsignmentPackedBySku = {
  po_secondary_sku: string;
  company_code_primary: string;
  packed: number;
  demand_hint: number;
};

/**
 * Overlay this consignment's packed qty onto PO listing rows and append
 * SKUs that exist only on the consignment.
 */
export function mergeListingsWithConsignmentPacked(
  snapshotRows: Record<string, unknown>[],
  packedBySku: ConsignmentPackedBySku[]
): Record<string, unknown>[] {
  const packedMap = new Map(
    packedBySku.map((p) => [skuKey(p.po_secondary_sku), p])
  );
  const seen = new Set<string>();
  const merged: Record<string, unknown>[] = [];

  for (const row of snapshotRows) {
    const sku = poSecondarySkuFromListingRow(row);
    if (!sku) {
      merged.push({ ...row });
      continue;
    }
    const key = skuKey(sku);
    seen.add(key);
    const packedEntry = packedMap.get(key);
    const packed = packedEntry?.packed ?? 0;
    const demand = demandFromListingRow(row);
    const dispatched = num(row.dispatched_quantity);
    merged.push({
      ...row,
      packed_quantity: packed,
      pending_quantity: Math.max(0, demand - dispatched - packed),
    });
  }

  for (const entry of packedBySku) {
    const key = skuKey(entry.po_secondary_sku);
    if (seen.has(key)) continue;
    const demand = entry.demand_hint > 0 ? entry.demand_hint : entry.packed;
    merged.push({
      po_secondary_sku: entry.po_secondary_sku,
      company_code_primary: entry.company_code_primary || entry.po_secondary_sku,
      demand,
      demand_quantity: demand,
      original_demand: demand,
      dispatched_quantity: 0,
      packed_quantity: entry.packed,
      pending_quantity: Math.max(0, demand - entry.packed),
    });
  }

  return merged;
}

/** Rebuild listings envelope with updated content array. */
export function patchListingsEnvelopeContent(
  envelope: unknown,
  content: Record<string, unknown>[]
): Record<string, unknown> {
  if (envelope != null && typeof envelope === "object" && !Array.isArray(envelope)) {
    return {
      ...(envelope as Record<string, unknown>),
      content,
      curr_page_count: content.length,
      total: (envelope as Record<string, unknown>).total ?? content.length,
    };
  }
  return {
    content,
    total: content.length,
    curr_page_count: content.length,
    per_page_count: content.length,
    current_page: 1,
  };
}

/**
 * Patch packed_quantity on each listings_snapshot row from PO-wide consignment totals.
 */
export function rollupPackedIntoSnapshotRows(
  snapshotRows: Record<string, unknown>[],
  packedTotalsBySku: Map<string, number>
): Record<string, unknown>[] {
  return snapshotRows.map((row) => {
    const sku = poSecondarySkuFromListingRow(row);
    if (!sku) return row;
    const packed = packedTotalsBySku.get(skuKey(sku)) ?? 0;
    const demand = demandFromListingRow(row);
    const dispatched = num(row.dispatched_quantity);
    return {
      ...row,
      packed_quantity: packed,
      pending_quantity: Math.max(0, demand - dispatched - packed),
    };
  });
}

async function loadConsignmentPackedBySku(
  consignmentId: number
): Promise<ConsignmentPackedBySku[]> {
  const r = await query(
    `SELECT po_secondary_sku,
            MAX(company_code_primary) AS company_code_primary,
            SUM(box_quantity)::int AS packed,
            MAX(original_demand)::int AS demand_hint
       FROM outbound_consignment_items
      WHERE consignment_id = $1
      GROUP BY po_secondary_sku`,
    [consignmentId]
  );
  return r.rows.map((row) => ({
    po_secondary_sku: str(row.po_secondary_sku),
    company_code_primary: str(row.company_code_primary),
    packed: num(row.packed),
    demand_hint: num(row.demand_hint),
  }));
}

async function loadPoPackedTotalsBySku(poNumber: string): Promise<Map<string, number>> {
  const pn = poNumber.trim();
  if (!pn) return new Map();
  const r = await query(
    `SELECT po_secondary_sku, SUM(box_quantity)::int AS packed
       FROM outbound_consignment_items
      WHERE TRIM(po_number) = $1
      GROUP BY po_secondary_sku`,
    [pn]
  );
  const map = new Map<string, number>();
  for (const row of r.rows) {
    const sku = str(row.po_secondary_sku);
    if (!sku) continue;
    map.set(skuKey(sku), num(row.packed));
  }
  return map;
}

export type ConsignmentPoLineItemsView = {
  outboundPoId: number;
  poNumber: string | null;
  poStatus: string | null;
  poType: string | null;
  listings: Record<string, unknown>;
};

/** Merged Zap PO line view: snapshot metadata + this consignment's packed qty. */
export async function buildConsignmentPoLineItemsView(
  consignmentId: number
): Promise<ConsignmentPoLineItemsView | null> {
  const consignment = await getOutboundConsignmentById(consignmentId);
  if (!consignment) return null;

  const poNumber =
    consignment.po_number != null ? String(consignment.po_number).trim() : "";
  if (!poNumber) return null;

  const po = await getOutboundPurchaseOrderByPoNumber(poNumber);
  if (!po) return null;

  const snapshot =
    po.listings_snapshot && typeof po.listings_snapshot === "object"
      ? po.listings_snapshot
      : {};

  const withEan = await enrichListingsSnapshotWithZapEan(snapshot, po.company_id);
  const withImages = await enrichListingsSnapshotWithListingImages(withEan);

  const snapshotRows = extractListingsRowsFromSnapshot(withImages);
  const packedBySku = await loadConsignmentPackedBySku(consignmentId);
  const mergedContent = mergeListingsWithConsignmentPacked(snapshotRows, packedBySku);
  const listings = patchListingsEnvelopeContent(withImages, mergedContent);

  return {
    outboundPoId: po.id,
    poNumber: po.po_number,
    poStatus: po.calculated_po_status ?? null,
    poType: po.po_type ?? null,
    listings,
  };
}

/** Roll up packed qty from all consignments on a PO into listings_snapshot. */
export async function rollupPoPackedQuantitiesFromConsignments(
  outboundPoId: number,
  poNumber: string
): Promise<void> {
  if (!Number.isFinite(outboundPoId) || outboundPoId < 1) return;
  const pn = String(poNumber || "").trim();
  if (!pn) return;

  const po = await getOutboundPurchaseOrderByPoNumber(pn);
  if (!po || po.id !== outboundPoId) return;

  const snapshot =
    po.listings_snapshot && typeof po.listings_snapshot === "object"
      ? po.listings_snapshot
      : {};

  const snapshotRows = extractListingsRowsFromSnapshot(snapshot);
  if (snapshotRows.length === 0) return;

  const packedTotals = await loadPoPackedTotalsBySku(pn);
  const patchedRows = rollupPackedIntoSnapshotRows(snapshotRows, packedTotals);
  const nextSnapshot = patchListingsEnvelopeContent(snapshot, patchedRows);
  await updateOutboundPoListingsSnapshot(outboundPoId, nextSnapshot);
}
