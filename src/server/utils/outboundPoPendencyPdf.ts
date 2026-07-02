import { PDFDocument, type PDFPage, StandardFonts, rgb } from "pdf-lib";
import {
  binSkuIdCandidatesForRow,
  enrichOutboundReportRow,
  loadOutboundSkuLookups,
  resolveOutboundCompanyCodePrimary,
  resolveWarehouseQuantityFromLookups,
  type ListingSkuFields,
  type OutboundSkuLookups,
  type ZapEanLookup,
} from "@/server/services/eanMappingsService";

export type PendencyRow = {
  po_secondary_sku: string | null;
  company_code_primary: string | null;
  warehouse_quantity: number | null;
  mrp: number | null;
  pending: number;
};

export type PendencyLookups = OutboundSkuLookups;

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** @deprecated Use binSkuIdCandidatesForRow from eanMappingsService */
export const pendencySkuIdCandidates = binSkuIdCandidatesForRow;

export function resolvePendencyRowFields(
  row: Record<string, unknown>,
  lookups: PendencyLookups
): Pick<PendencyRow, "company_code_primary" | "warehouse_quantity"> {
  const company_code_primary =
    resolveOutboundCompanyCodePrimary(row, lookups) || null;
  const warehouse_quantity = resolveWarehouseQuantityFromLookups(row, lookups);
  return { company_code_primary, warehouse_quantity };
}

export async function loadPendencyLookups(
  rows: Record<string, unknown>[],
  companyId: number | null | undefined
): Promise<PendencyLookups> {
  return loadOutboundSkuLookups(rows, companyId);
}

export function buildPendencyRowsFromListings(
  rows: Record<string, unknown>[],
  lookups?: PendencyLookups
): PendencyRow[] {
  const resolvedLookups: PendencyLookups = lookups ?? {
    companyId: null,
    companyCodeBySecondarySku: new Map(),
    eanBySkuKey: new Map(),
    listingSkuByKey: new Map(),
    binStockBySkuId: new Map(),
    labelsMrpBySecondarySku: new Map(),
    labelsMrpByMasterSku: new Map(),
  };

  return rows.map((row) => {
    const demand = num(row.demand) ?? 0;
    const packed = num(row.packed) ?? 0;
    const dispatched = num(row.dispatched) ?? 0;
    const explicitPending = num(row.pending);
    const { company_code_primary, warehouse_quantity } = resolvePendencyRowFields(
      row,
      resolvedLookups
    );
    return {
      po_secondary_sku:
        row.po_secondary_sku != null ? String(row.po_secondary_sku) : null,
      company_code_primary,
      warehouse_quantity,
      mrp: num(row.mrp),
      pending:
        explicitPending != null ? explicitPending : demand - (packed + dispatched),
    };
  });
}

const PENDENCY_PAGE_SIZE: [number, number] = [842, 595];
const PENDENCY_MARGIN = 32;
const PENDENCY_ROW_HEIGHT = 14;
const PENDENCY_BOTTOM_Y = PENDENCY_MARGIN + 18;
const PENDENCY_COL_W = [28, 150, 170, 130, 90, 80];
const PENDENCY_HEADERS = [
  "#",
  "PO SKU",
  "Company Code Primary",
  "Warehouse Inventory",
  "M.R.P",
  "Pending",
];

export async function createOutboundPoPendencyPdf(opts: {
  companyName: string | null;
  poNumber: string;
  deliveryLocation: string | null;
  rows: PendencyRow[];
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = PENDENCY_PAGE_SIZE[0];
  const pageHeight = PENDENCY_PAGE_SIZE[1];

  let page = pdf.addPage(PENDENCY_PAGE_SIZE);
  let pageNum = 1;

  function addNewPage(): PDFPage {
    pageNum += 1;
    page = pdf.addPage(PENDENCY_PAGE_SIZE);
    return page;
  }

  function drawTitleBlock(p: PDFPage, y: number): number {
    const title = `${opts.companyName ?? "Blinkit"} Pendency`;
    p.drawText(title, { x: PENDENCY_MARGIN, y, size: 16, font: bold });
    y -= 22;
    p.drawText(
      `PO: ${opts.poNumber}   Delivery: ${opts.deliveryLocation ?? "-"}`,
      { x: PENDENCY_MARGIN, y, size: 10, font }
    );
    return y - 20;
  }

  function drawContinuationHeader(p: PDFPage, y: number, num: number): number {
    p.drawText(
      `PO: ${opts.poNumber}   Delivery: ${opts.deliveryLocation ?? "-"}   Page ${num}`,
      { x: PENDENCY_MARGIN, y, size: 10, font }
    );
    return y - 20;
  }

  function drawTableHeader(p: PDFPage, y: number): number {
    let x = PENDENCY_MARGIN;
    PENDENCY_HEADERS.forEach((h, i) => {
      p.drawText(h, { x, y, size: 9, font: bold, color: rgb(0, 0, 0) });
      x += PENDENCY_COL_W[i];
    });
    y -= 12;
    p.drawLine({
      start: { x: PENDENCY_MARGIN, y },
      end: { x: pageWidth - PENDENCY_MARGIN, y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    return y - 12;
  }

  function drawDataRow(
    p: PDFPage,
    y: number,
    rowIndex: number,
    r: PendencyRow
  ): number {
    const vals = [
      String(rowIndex),
      r.po_secondary_sku ?? "",
      r.company_code_primary ?? "",
      r.warehouse_quantity != null ? String(r.warehouse_quantity) : "",
      r.mrp != null ? String(r.mrp) : "",
      String(r.pending),
    ];
    let x = PENDENCY_MARGIN;
    vals.forEach((v, idx) => {
      p.drawText(v, { x, y, size: 9, font });
      x += PENDENCY_COL_W[idx];
    });
    return y - PENDENCY_ROW_HEIGHT;
  }

  let y = pageHeight - PENDENCY_MARGIN;
  y = drawTitleBlock(page, y);
  y = drawTableHeader(page, y);

  let rendered = 0;
  for (let i = 0; i < opts.rows.length; i += 1) {
    if (y < PENDENCY_BOTTOM_Y) {
      page = addNewPage();
      y = pageHeight - PENDENCY_MARGIN;
      y = drawContinuationHeader(page, y, pageNum);
      y = drawTableHeader(page, y);
    }
    y = drawDataRow(page, y, i + 1, opts.rows[i]);
    rendered += 1;
  }

  if (rendered < opts.rows.length) {
    throw new Error(
      `Pendency PDF truncated: rendered ${rendered}/${opts.rows.length} rows`
    );
  }

  return pdf.save();
}

// Re-exports for tests and backward compatibility
export {
  enrichOutboundReportRow,
  type ListingSkuFields,
  type ZapEanLookup,
};
