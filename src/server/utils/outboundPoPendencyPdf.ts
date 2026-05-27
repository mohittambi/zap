import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { query } from "@/server/db";

export type PendencyRow = {
  po_secondary_sku: string | null;
  company_code_primary: string | null;
  warehouse_quantity: number | null;
  mrp: number | null;
  pending: number;
};

export type PendencyLookups = {
  companyId: number | null;
  companyCodeBySecondarySku: Map<string, string>;
  binStockBySkuId: Map<string, number>;
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function strTrim(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  if (!s || s.toUpperCase() === "NA") return "";
  return s;
}

function pickListing(row: Record<string, unknown>): Record<string, unknown> | null {
  const l = row.listing;
  if (l && typeof l === "object" && !Array.isArray(l)) {
    return l as Record<string, unknown>;
  }
  return null;
}

/** SKU ids to match against Zap bin stock, in priority order. */
export function pendencySkuIdCandidates(row: Record<string, unknown>): string[] {
  const listing = pickListing(row);
  const candidates = [
    strTrim(row.inventory_sku_id) || strTrim(listing?.inventory_sku_id),
    strTrim(row.master_sku) || strTrim(listing?.master_sku),
    strTrim(row.po_secondary_sku),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of candidates) {
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function companyCodeFromSnapshotDetails(
  row: Record<string, unknown>,
  companyId: number | null
): string {
  if (companyId == null || !Number.isFinite(companyId) || companyId < 1) return "";
  const details = row.secondary_sku_company_details;
  if (!Array.isArray(details)) return "";
  for (const entry of details) {
    if (entry == null || typeof entry !== "object" || Array.isArray(entry)) continue;
    const o = entry as Record<string, unknown>;
    const cid = Number(o.company_id);
    if (!Number.isFinite(cid) || cid !== companyId) continue;
    const code = strTrim(o.company_code_primary);
    if (code) return code;
  }
  return "";
}

export function resolvePendencyRowFields(
  row: Record<string, unknown>,
  lookups: PendencyLookups
): Pick<PendencyRow, "company_code_primary" | "warehouse_quantity"> {
  const topLevelCode = strTrim(row.company_code_primary);
  const secondarySku = strTrim(row.po_secondary_sku);
  const fromDb =
    secondarySku && lookups.companyCodeBySecondarySku.has(secondarySku)
      ? lookups.companyCodeBySecondarySku.get(secondarySku) ?? ""
      : "";
  const fromDetails = companyCodeFromSnapshotDetails(row, lookups.companyId);
  const listing = pickListing(row);
  const fromMasterSku =
    strTrim(row.master_sku) || strTrim(listing?.master_sku);
  const company_code_primary =
    topLevelCode ||
    fromDb ||
    fromDetails ||
    fromMasterSku ||
    secondarySku ||
    null;

  let warehouse_quantity: number | null = null;
  for (const skuId of pendencySkuIdCandidates(row)) {
    if (lookups.binStockBySkuId.has(skuId)) {
      warehouse_quantity = lookups.binStockBySkuId.get(skuId) ?? 0;
      break;
    }
  }

  return { company_code_primary, warehouse_quantity };
}

export async function loadPendencyLookups(
  rows: Record<string, unknown>[],
  companyId: number | null | undefined
): Promise<PendencyLookups> {
  const resolvedCompanyId =
    companyId != null && Number.isFinite(companyId) && companyId > 0
      ? companyId
      : null;

  const secondarySkus = [
    ...new Set(
      rows
        .map((r) => strTrim(r.po_secondary_sku))
        .filter(Boolean)
    ),
  ];

  const companyCodeBySecondarySku = new Map<string, string>();
  if (resolvedCompanyId != null && secondarySkus.length > 0) {
    const coR = await query(
      `SELECT secondary_sku, company_code_primary
         FROM company_secondary_sku
        WHERE company_id = $1
          AND secondary_sku = ANY($2::varchar[])`,
      [resolvedCompanyId, secondarySkus]
    );
    for (const row of coR.rows as {
      secondary_sku: string;
      company_code_primary: string | null;
    }[]) {
      const sku = strTrim(row.secondary_sku);
      const code = strTrim(row.company_code_primary);
      if (sku && code) companyCodeBySecondarySku.set(sku, code);
    }
  }

  const skuIds = [
    ...new Set(rows.flatMap((r) => pendencySkuIdCandidates(r))),
  ];

  const binStockBySkuId = new Map<string, number>();
  if (skuIds.length > 0) {
    const binR = await query(
      `SELECT b.sku_id, COALESCE(SUM(b.available_quantity), 0)::int AS qty
         FROM bins b
        WHERE b.is_deleted = false
          AND b.sku_id = ANY($1::varchar[])
        GROUP BY b.sku_id`,
      [skuIds]
    );
    for (const row of binR.rows as { sku_id: string; qty: number }[]) {
      const sku = strTrim(row.sku_id);
      if (sku) binStockBySkuId.set(sku, Number(row.qty) || 0);
    }
  }

  return {
    companyId: resolvedCompanyId,
    companyCodeBySecondarySku,
    binStockBySkuId,
  };
}

export function buildPendencyRowsFromListings(
  rows: Record<string, unknown>[],
  lookups?: PendencyLookups
): PendencyRow[] {
  const resolvedLookups: PendencyLookups = lookups ?? {
    companyId: null,
    companyCodeBySecondarySku: new Map(),
    binStockBySkuId: new Map(),
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

export async function createOutboundPoPendencyPdf(opts: {
  companyName: string | null;
  poNumber: string;
  deliveryLocation: string | null;
  rows: PendencyRow[];
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const margin = 32;
  let y = height - margin;

  const title = `${opts.companyName ?? "Blinkit"} Pendency`;
  page.drawText(title, { x: margin, y, size: 16, font: bold });
  y -= 22;
  page.drawText(
    `PO: ${opts.poNumber}   Delivery: ${opts.deliveryLocation ?? "-"}`,
    { x: margin, y, size: 10, font }
  );
  y -= 20;

  const headers = [
    "#",
    "PO SKU",
    "Company Code Primary",
    "Warehouse Inventory",
    "M.R.P",
    "Pending",
  ];
  const colW = [28, 150, 170, 130, 90, 80];
  let x = margin;
  headers.forEach((h, i) => {
    page.drawText(h, { x, y, size: 9, font: bold, color: rgb(0, 0, 0) });
    x += colW[i];
  });
  y -= 12;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 12;

  for (let i = 0; i < opts.rows.length; i += 1) {
    if (y < margin + 18) {
      break;
    }
    const r = opts.rows[i];
    const vals = [
      String(i + 1),
      r.po_secondary_sku ?? "",
      r.company_code_primary ?? "",
      r.warehouse_quantity != null ? String(r.warehouse_quantity) : "",
      r.mrp != null ? String(r.mrp) : "",
      String(r.pending),
    ];
    x = margin;
    vals.forEach((v, idx) => {
      page.drawText(v, { x, y, size: 9, font });
      x += colW[idx];
    });
    y -= 14;
  }

  return pdf.save();
}
