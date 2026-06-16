import { AppError } from "@/server/errors";
import { query } from "@/server/db";
import { parseOutboundPoLineItemsSpreadsheet } from "@/server/utils/outboundPoListingSpreadsheetParse";
import {
  isMisalignedCommercialRow,
  normalizeOutboundListingRow,
  normalizeOutboundListingRows,
} from "@/server/utils/outboundListingNormalize";
import {
  computeAnalyticsFromListingsRows,
  extractListingsRowsFromSnapshot,
  getOutboundPurchaseOrderById,
  updateOutboundPoAnalyticsObject,
  updateOutboundPoListingsSnapshot,
} from "@/server/services/outboundPurchaseOrdersService";

export type PoSpreadsheetPreviewWarning =
  | "sample_filename"
  | "row_count_drop"
  | "po_number_mismatch"
  | "still_misaligned";

export type PoSpreadsheetPreviewRowStatus = "ok" | "repaired" | "warning" | "error";

export type PoSpreadsheetPreviewRow = {
  rowNumber: number;
  po_secondary_sku: string | null;
  title: string | null;
  rate_without_tax: string | null;
  tax_rate: string | null;
  landing_rate: string | null;
  mrp: string | null;
  demand: string | null;
  status: PoSpreadsheetPreviewRowStatus;
  issues: string[];
};

export type PoSpreadsheetPreview = {
  ok: boolean;
  sourceFile: string;
  previousRowCount: number;
  newRowCount: number;
  rowsRepaired: number;
  stillMisaligned: number;
  warnings: PoSpreadsheetPreviewWarning[];
  warningMessages: string[];
  requiresReplaceConfirm: boolean;
  rowsPreview: PoSpreadsheetPreviewRow[];
};

export type OutboundPoAttachmentRow = {
  id: number;
  outbound_po_id: number;
  original_filename: string;
  stored_path: string;
  kind: string;
};

function csvCell(v: unknown): string {
  if (v == null || v === "") return "";
  return String(v);
}

function looksLikeSampleSpreadsheet(filename: string): boolean {
  return /sample/i.test(filename);
}

function poNumberInFilename(poNumber: string, filename: string): boolean {
  const digits = poNumber.replace(/\D/g, "");
  if (!digits) return true;
  return filename.replace(/\D/g, "").includes(digits);
}

export function buildPoSpreadsheetPreviewWarnings(opts: {
  filename: string;
  poNumber: string;
  previousRowCount: number;
  newRowCount: number;
  stillMisaligned: number;
}): { warnings: PoSpreadsheetPreviewWarning[]; warningMessages: string[] } {
  const warnings: PoSpreadsheetPreviewWarning[] = [];
  const warningMessages: string[] = [];

  if (looksLikeSampleSpreadsheet(opts.filename)) {
    warnings.push("sample_filename");
    warningMessages.push(
      "Filename looks like a sample spreadsheet — confirm before replacing live PO line items."
    );
  }
  if (
    opts.previousRowCount > 0 &&
    opts.newRowCount > 0 &&
    opts.newRowCount < opts.previousRowCount
  ) {
    warnings.push("row_count_drop");
    warningMessages.push(
      `Row count drops from ${opts.previousRowCount} to ${opts.newRowCount} — confirm before replacing line items.`
    );
  }
  if (opts.poNumber && !poNumberInFilename(opts.poNumber, opts.filename)) {
    warnings.push("po_number_mismatch");
    warningMessages.push(
      `Filename does not contain PO number ${opts.poNumber} — verify this is the correct vendor file.`
    );
  }
  if (opts.stillMisaligned > 0) {
    warnings.push("still_misaligned");
    warningMessages.push(
      `${opts.stillMisaligned} line(s) may still have misaligned commercial columns after repair.`
    );
  }

  return { warnings, warningMessages };
}

export function requiresPoSpreadsheetReplaceConfirm(opts: {
  previousRowCount: number;
  newRowCount: number;
  warnings: PoSpreadsheetPreviewWarning[];
}): boolean {
  return (
    opts.previousRowCount > 0 &&
    (opts.newRowCount !== opts.previousRowCount ||
      opts.warnings.includes("sample_filename") ||
      opts.warnings.includes("row_count_drop"))
  );
}

export function countListingsSnapshotRows(snapshot: unknown): number {
  return extractListingsRowsFromSnapshot(snapshot).length;
}

export async function getOutboundPoAttachmentById(
  poId: number,
  attachmentId: number
): Promise<OutboundPoAttachmentRow | null> {
  const r = await query(
    `SELECT id, outbound_po_id, original_filename, stored_path, kind
       FROM outbound_po_attachments
      WHERE id = $1 AND outbound_po_id = $2`,
    [attachmentId, poId]
  );
  if (r.rows.length === 0) return null;
  const row = r.rows[0];
  return {
    id: Number(row.id),
    outbound_po_id: Number(row.outbound_po_id),
    original_filename: String(row.original_filename),
    stored_path: String(row.stored_path),
    kind: String(row.kind ?? "other"),
  };
}

function buildPreviewRow(
  rawRow: Record<string, unknown>,
  rowNumber: number
): PoSpreadsheetPreviewRow {
  const { row, repaired, repairs } = normalizeOutboundListingRow(rawRow);
  const stillMisaligned = isMisalignedCommercialRow(row);
  const issues = [...repairs];
  let status: PoSpreadsheetPreviewRowStatus = "ok";

  if (stillMisaligned) {
    status = "error";
    issues.push("Commercial columns may still be misaligned after repair.");
  } else if (repaired) {
    status = "repaired";
  }

  return {
    rowNumber,
    po_secondary_sku: csvCell(row.po_secondary_sku) || null,
    title: csvCell(row.title) || null,
    rate_without_tax: csvCell(row.rate_without_tax) || null,
    tax_rate: csvCell(row.tax_rate) || null,
    landing_rate: csvCell(row.landing_rate) || null,
    mrp: csvCell(row.mrp) || null,
    demand: csvCell(row.demand ?? row.original_demand) || null,
    status,
    issues,
  };
}

/** Parse spreadsheet buffer and build preview without writing snapshot. */
export async function previewSpreadsheetBufferForPo(
  poId: number,
  buf: Buffer,
  filename: string
): Promise<PoSpreadsheetPreview> {
  const po = await getOutboundPurchaseOrderById(poId);
  if (!po) {
    throw new AppError("Purchase order not found", 404);
  }

  const envelope = parseOutboundPoLineItemsSpreadsheet(buf, filename);
  const previousRowCount = countListingsSnapshotRows(po.listings_snapshot);
  const { repairedCount, stillMisaligned } = normalizeOutboundListingRows(
    envelope.content
  );
  const newRowCount = envelope.content.length;

  const { warnings, warningMessages } = buildPoSpreadsheetPreviewWarnings({
    filename,
    poNumber: po.po_number,
    previousRowCount,
    newRowCount,
    stillMisaligned,
  });

  const rowsPreview = envelope.content.map((rawRow, idx) =>
    buildPreviewRow(rawRow, idx + 1)
  );

  return {
    ok: newRowCount > 0,
    sourceFile: filename,
    previousRowCount,
    newRowCount,
    rowsRepaired: repairedCount,
    stillMisaligned,
    warnings,
    warningMessages,
    requiresReplaceConfirm: requiresPoSpreadsheetReplaceConfirm({
      previousRowCount,
      newRowCount,
      warnings,
    }),
    rowsPreview,
  };
}

/** Persist normalized listing rows from a parsed spreadsheet buffer. */
export async function applySpreadsheetBufferToOutboundPo(
  poId: number,
  buf: Buffer,
  filename: string,
  opts: {
    confirmReplace: boolean;
    sourceAttachmentId?: number | null;
  }
): Promise<{
  listingsUpdated: boolean;
  rowsParsed: number;
  rowsRepaired: number;
  stillMisaligned: number;
  previousRowCount: number;
  newRowCount: number;
}> {
  const preview = await previewSpreadsheetBufferForPo(poId, buf, filename);
  if (!preview.ok || preview.newRowCount === 0) {
    throw new AppError(
      "No line items found in spreadsheet. Check column headers match the vendor format.",
      400
    );
  }
  if (preview.requiresReplaceConfirm && !opts.confirmReplace) {
    throw new AppError(
      `Confirm replace: ${preview.previousRowCount} existing line item(s) → ${preview.newRowCount} from ${filename}.`,
      409
    );
  }

  const envelope = parseOutboundPoLineItemsSpreadsheet(buf, filename);
  const { rows, repairedCount, stillMisaligned } = normalizeOutboundListingRows(
    envelope.content
  );
  const normalizedEnvelope = { ...envelope, content: rows };
  await updateOutboundPoListingsSnapshot(poId, normalizedEnvelope);

  const po = await getOutboundPurchaseOrderById(poId);
  const analytics =
    po?.analytics_object && typeof po.analytics_object === "object"
      ? { ...(po.analytics_object as Record<string, unknown>) }
      : {};
  analytics.listings_source_filename = filename;
  if (opts.sourceAttachmentId != null && opts.sourceAttachmentId > 0) {
    analytics.listings_source_attachment_id = opts.sourceAttachmentId;
  }
  await updateOutboundPoAnalyticsObject(poId, {
    ...computeAnalyticsFromListingsRows(rows),
    ...analytics,
  });

  if (po?.po_number) {
    const { syncOutboundConsignmentItemsCommercialFromListingRows } = await import(
      "@/server/services/outboundConsignmentItemsService"
    );
    await syncOutboundConsignmentItemsCommercialFromListingRows(
      String(po.po_number),
      rows
    );
  }

  return {
    listingsUpdated: true,
    rowsParsed: rows.length,
    rowsRepaired: repairedCount,
    stillMisaligned,
    previousRowCount: preview.previousRowCount,
    newRowCount: preview.newRowCount,
  };
}
