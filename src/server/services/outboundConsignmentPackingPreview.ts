import { query } from "@/server/db";
import {
  validateConsignmentPackingRows,
  type ConsignmentPackingValidationResult,
} from "@/server/services/outboundConsignmentItemsService";
import {
  extractListingsRowsFromSnapshot,
  getOutboundPurchaseOrderById,
} from "@/server/services/outboundPurchaseOrdersService";
import type {
  ConsignmentPackingParseError,
  ParsedConsignmentPackingRow,
} from "@/server/utils/outboundConsignmentPackingSpreadsheetParse";

export async function knownPoSkusForOutboundPo(
  outboundPoId: number,
  poNumber: string
): Promise<{ poSkus: Set<string>; consignmentSkus: Set<string> }> {
  const poSkus = new Set<string>();
  const consignmentSkus = new Set<string>();

  const po = await getOutboundPurchaseOrderById(outboundPoId);
  if (po?.listings_snapshot) {
    for (const row of extractListingsRowsFromSnapshot(po.listings_snapshot)) {
      const sku = row.po_secondary_sku ?? row.item_code ?? row.sku;
      if (sku != null && String(sku).trim()) {
        poSkus.add(String(sku).trim());
      }
    }
  }

  const pn = String(poNumber || "").trim();
  if (pn) {
    const items = await query(
      `SELECT DISTINCT i.po_secondary_sku
         FROM outbound_consignment_items i
         INNER JOIN outbound_consignments c ON c.id = i.consignment_id
        WHERE c.po_number = $1`,
      [pn]
    );
    for (const row of items.rows) {
      const sku = row.po_secondary_sku;
      if (sku != null && String(sku).trim()) {
        consignmentSkus.add(String(sku).trim());
      }
    }
  }

  return { poSkus, consignmentSkus };
}

export async function previewOutboundConsignmentPacking(opts: {
  outboundPoId: number;
  poNumber: string;
  consignmentId?: number;
  rows: ParsedConsignmentPackingRow[];
  parseErrors: ConsignmentPackingParseError[];
}): Promise<ConsignmentPackingValidationResult> {
  const { outboundPoId, poNumber, rows, parseErrors } = opts;
  const consignmentId = opts.consignmentId ?? 0;
  const { poSkus, consignmentSkus } = await knownPoSkusForOutboundPo(
    outboundPoId,
    poNumber
  );
  return validateConsignmentPackingRows({
    consignmentId,
    poNumber,
    rows,
    parseErrors,
    knownPoSkus: poSkus,
    knownConsignmentSkus: consignmentSkus,
    existingLineCount: consignmentId > 0 ? undefined : 0,
  });
}
