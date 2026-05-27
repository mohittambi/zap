/**
 * Post-RTD consignment line item tab views: default, box-wise, SKU-wise, PO-wise.
 * Aggregations run client-side from flat rows from GET …/line-items/rows.
 */

export type ConsignmentLineItemFlatRow = {
  id: number;
  po_secondary_sku: string;
  company_code_primary: string;
  company_code_secondary: string;
  box_number: number;
  box_quantity: number;
  box_name: string;
  submitted_from: string;
  created_by: string;
  mrp: number | null;
  original_demand: number;
  dispatched_quantity: number;
  consignment_quantity: number;
  overall_fill_rate: number | null;
  created_at: string;
  updated_at: string;
};

export type ConsignmentLineViewId = "default" | "box" | "sku" | "po";

export type ViewColumn = { key: string; label: string; align?: "right" };

export const CONSIGNMENT_LINE_VIEW_LABELS: Record<ConsignmentLineViewId, string> = {
  default: "Default View",
  box: "Box Wise View",
  sku: "SKU Wise View",
  po: "PO Wise View",
};

function csvEscapeCell(cell: string | number | null | undefined): string {
  const s = cell == null ? "" : String(cell);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function joinDistinct(values: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = v.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out.join(", ");
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fillRatePercent(
  consignmentQty: number,
  originalDemand: number,
  stored: number | null
): number {
  if (stored != null && Number.isFinite(stored)) {
    const pct = stored <= 1 && stored > 0 ? stored * 100 : stored;
    return Math.round(pct * 10) / 10;
  }
  if (originalDemand > 0) {
    return Math.round((consignmentQty / originalDemand) * 1000) / 10;
  }
  return 0;
}

export function buildDefaultViewRows(flat: ConsignmentLineItemFlatRow[]): Record<string, string | number>[] {
  return flat.map((row, i) => ({
    sr_no: i + 1,
    po_secondary_sku: row.po_secondary_sku || "—",
    company_code_primary: row.company_code_primary || "—",
    box_number: row.box_number,
    box_quantity: row.box_quantity,
    box_name: row.box_name || "—",
    submitted_from: row.submitted_from || "—",
    created_by: row.created_by || "—",
    created_at: row.created_at || "—",
    updated_at: row.updated_at || "—",
  }));
}

export function buildBoxWiseViewRows(flat: ConsignmentLineItemFlatRow[]): Record<string, string | number>[] {
  const byBox = new Map<number, ConsignmentLineItemFlatRow[]>();
  for (const row of flat) {
    const bn = row.box_number;
    const list = byBox.get(bn) ?? [];
    list.push(row);
    byBox.set(bn, list);
  }
  return [...byBox.entries()]
    .sort(([a], [b]) => a - b)
    .map(([boxNumber, rows]) => ({
      box_number: boxNumber,
      total_box_quantity: rows.reduce((s, r) => s + num(r.box_quantity), 0),
      po_secondary_skus_in_box: joinDistinct(rows.map((r) => r.po_secondary_sku)),
      company_codes_primary_in_box: joinDistinct(rows.map((r) => r.company_code_primary)),
    }));
}

export function buildSkuWiseViewRows(flat: ConsignmentLineItemFlatRow[]): Record<string, string | number>[] {
  const bySku = new Map<string, ConsignmentLineItemFlatRow[]>();
  for (const row of flat) {
    const key = row.po_secondary_sku.trim() || `__id_${row.id}`;
    const list = bySku.get(key) ?? [];
    list.push(row);
    bySku.set(key, list);
  }
  return [...bySku.values()]
    .sort((a, b) => (a[0]?.po_secondary_sku ?? "").localeCompare(b[0]?.po_secondary_sku ?? ""))
    .map((rows) => {
      const first = rows[0]!;
      const boxNums = [...new Set(rows.map((r) => r.box_number))].sort((a, b) => a - b);
      return {
        po_secondary_sku: first.po_secondary_sku || "—",
        company_code_primary: first.company_code_primary || "—",
        total_quantity: rows.reduce((s, r) => s + num(r.box_quantity), 0),
        box_numbers: boxNums.join(", "),
      };
    });
}

export function buildPoWiseViewRows(flat: ConsignmentLineItemFlatRow[]): Record<string, string | number>[] {
  const bySku = new Map<string, ConsignmentLineItemFlatRow[]>();
  for (const row of flat) {
    const key = row.po_secondary_sku.trim() || `__id_${row.id}`;
    const list = bySku.get(key) ?? [];
    list.push(row);
    bySku.set(key, list);
  }
  return [...bySku.values()]
    .sort((a, b) => (a[0]?.po_secondary_sku ?? "").localeCompare(b[0]?.po_secondary_sku ?? ""))
    .map((rows) => {
      const first = rows[0]!;
      const boxNums = [...new Set(rows.map((r) => r.box_number))].sort((a, b) => a - b);
      const consignmentQty = rows.reduce((s, r) => s + num(r.box_quantity), 0);
      const originalDemand = Math.max(...rows.map((r) => num(r.original_demand)), 0);
      const dispatched = Math.max(...rows.map((r) => num(r.dispatched_quantity)), 0);
      const mrp = rows.find((r) => r.mrp != null)?.mrp ?? null;
      const fillStored = rows.find((r) => r.overall_fill_rate != null)?.overall_fill_rate ?? null;
      return {
        po_secondary_sku: first.po_secondary_sku || "—",
        company_code_primary: first.company_code_primary || "—",
        company_code_secondary: first.company_code_secondary || "—",
        mrp: mrp ?? "—",
        original_demand: originalDemand,
        dispatched_quantity: dispatched,
        consignment_quantity: consignmentQty,
        box_numbers: boxNums.join(", "),
        overall_fill_rate_pct: fillRatePercent(consignmentQty, originalDemand, fillStored),
      };
    });
}

export const VIEW_COLUMNS: Record<ConsignmentLineViewId, ViewColumn[]> = {
  default: [
    { key: "sr_no", label: "Sr. No", align: "right" },
    { key: "po_secondary_sku", label: "PO Secondary SKU" },
    { key: "company_code_primary", label: "Company Code Primary" },
    { key: "box_number", label: "Box Number", align: "right" },
    { key: "box_quantity", label: "Box Quantity", align: "right" },
    { key: "box_name", label: "Box Name" },
    { key: "submitted_from", label: "Submitted From" },
    { key: "created_by", label: "Created By" },
    { key: "created_at", label: "Created At" },
    { key: "updated_at", label: "Updated At" },
  ],
  box: [
    { key: "box_number", label: "Box Number", align: "right" },
    { key: "total_box_quantity", label: "Total Box Quantity", align: "right" },
    { key: "po_secondary_skus_in_box", label: "PO Secondary SKUs in Box" },
    { key: "company_codes_primary_in_box", label: "Company Codes Primary in Box" },
  ],
  sku: [
    { key: "po_secondary_sku", label: "PO Secondary SKU" },
    { key: "company_code_primary", label: "Company Code Primary" },
    { key: "total_quantity", label: "Total Quantity", align: "right" },
    { key: "box_numbers", label: "Box Numbers" },
  ],
  po: [
    { key: "po_secondary_sku", label: "PO Secondary SKU" },
    { key: "company_code_primary", label: "Company Code Primary" },
    { key: "company_code_secondary", label: "Company Code Secondary" },
    { key: "mrp", label: "MRP", align: "right" },
    { key: "original_demand", label: "Original Demand", align: "right" },
    { key: "dispatched_quantity", label: "Dispatched Quantity", align: "right" },
    { key: "consignment_quantity", label: "Consignment Quantity", align: "right" },
    { key: "box_numbers", label: "Box Numbers" },
    { key: "overall_fill_rate_pct", label: "Overall Fill Rate %", align: "right" },
  ],
};

export function buildViewRows(
  view: ConsignmentLineViewId,
  flat: ConsignmentLineItemFlatRow[]
): Record<string, string | number>[] {
  switch (view) {
    case "default":
      return buildDefaultViewRows(flat);
    case "box":
      return buildBoxWiseViewRows(flat);
    case "sku":
      return buildSkuWiseViewRows(flat);
    case "po":
      return buildPoWiseViewRows(flat);
    default:
      return buildDefaultViewRows(flat);
  }
}

export function buildViewCsv(
  view: ConsignmentLineViewId,
  rows: Record<string, string | number>[]
): string {
  const cols = VIEW_COLUMNS[view];
  const lines = [cols.map((c) => csvEscapeCell(c.label)).join(",")];
  for (const row of rows) {
    lines.push(cols.map((c) => csvEscapeCell(row[c.key])).join(","));
  }
  return lines.join("\n") + "\n";
}

export function downloadViewCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
