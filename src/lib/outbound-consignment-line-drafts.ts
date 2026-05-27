export const CONSIGNMENT_LINE_CSV_HEADERS = [
  "po_secondary_sku",
  "company_code_primary",
  "demand_quantity",
  "dispatched_quantity",
  "reserved_quantity",
  "pending_quantity",
  "box_number",
  "box_quantity",
  "box_name",
] as const;

export type ConsignmentBoxLine = {
  box_number: number;
  box_quantity: number;
  box_name: string;
};

export type ConsignmentSkuPacking = {
  /** Channel / PO item code (packing & PO validation). */
  po_secondary_sku: string;
  /** Warehouse inventory SKU ID (retained for API; display SKU uses company_code_primary). */
  inventory_sku_id: string;
  company_code_primary: string;
  demand_quantity: number;
  dispatched_quantity: number;
  reserved_quantity: number;
  pending_quantity: number;
  boxes: ConsignmentBoxLine[];
};

/** Flat row for CSV / DB insert (one per box line). */
export type ConsignmentLineDraft = {
  po_secondary_sku: string;
  company_code_primary: string;
  demand_quantity: number;
  dispatched_quantity: number;
  reserved_quantity: number;
  pending_quantity: number;
  box_number: number;
  box_quantity: number;
  box_name: string;
};

export type ConsignmentLineValidationIssue = {
  skuIndex: number;
  boxIndex?: number;
  field: string;
  message: string;
};

const LISTING_ARRAY_KEYS = ["content", "items", "data", "rows", "results"] as const;

function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function listingRowsFromSnapshot(snapshot: unknown): Record<string, unknown>[] {
  if (snapshot == null) return [];
  if (Array.isArray(snapshot)) {
    return snapshot.filter(
      (x): x is Record<string, unknown> => x != null && typeof x === "object" && !Array.isArray(x)
    );
  }
  if (typeof snapshot !== "object") return [];
  const o = snapshot as Record<string, unknown>;
  for (const k of LISTING_ARRAY_KEYS) {
    const a = o[k];
    if (Array.isArray(a)) {
      return a.filter(
        (x): x is Record<string, unknown> => x != null && typeof x === "object" && !Array.isArray(x)
      );
    }
  }
  return [];
}

function skuKey(itemCode: string): string {
  return itemCode.trim().toLowerCase();
}

function listingNested(row: Record<string, unknown>): Record<string, unknown> | null {
  const l = row.listing;
  if (l != null && typeof l === "object" && !Array.isArray(l)) {
    return l as Record<string, unknown>;
  }
  return null;
}

/** Channel / PO item code (matches PO line-items “PO Secondary SKU”). */
function channelItemCodeFromListingRow(row: Record<string, unknown>): string {
  return str(row.po_secondary_sku) || str(row.item_code) || str(row.sku);
}

/** Inventory SKU ID (matches PO line-items “Inventory SKU” / listings sku_id). */
function inventorySkuIdFromListingRow(row: Record<string, unknown>): string {
  const listing = listingNested(row);
  return (
    str(row.inventory_sku_id) ||
    str(listing?.inventory_sku_id) ||
    str(row.sku_id) ||
    str(listing?.sku_id) ||
    ""
  );
}

/** Company / master code (matches PO line-items “Company Code Primary”). */
function companyCodeFromListingRow(
  row: Record<string, unknown>,
  channelItemCode: string
): string {
  const listing = listingNested(row);
  const raw = str(row.company_code_primary);
  if (raw && raw.toLowerCase() !== channelItemCode.toLowerCase()) return raw;
  return str(row.master_sku) || str(listing?.master_sku) || "";
}

/** One SKU group per channel item code from PO listings. */
export function extractConsignmentSkuPackingFromListings(
  listings: unknown
): ConsignmentSkuPacking[] {
  const rows = listingRowsFromSnapshot(listings);
  const seen = new Set<string>();
  const out: ConsignmentSkuPacking[] = [];

  for (const row of rows) {
    const channelItemCode = channelItemCodeFromListingRow(row);
    if (!channelItemCode || seen.has(channelItemCode)) continue;
    seen.add(channelItemCode);

    const inventorySkuId = inventorySkuIdFromListingRow(row);
    const companyCode = companyCodeFromListingRow(row, channelItemCode);

    const demand =
      num(row.demand) ||
      num(row.demand_quantity) ||
      num(row.original_demand) ||
      num(row.box_quantity);
    const dispatched = num(row.dispatched_quantity);
    const packed = num((row as { packed_quantity?: unknown }).packed_quantity);
    const pending = Math.max(0, demand - dispatched - packed);

    out.push({
      po_secondary_sku: channelItemCode,
      inventory_sku_id: inventorySkuId || channelItemCode,
      // Do not fall back to po_secondary_sku — see enrichListingsSnapshotWithZapEan before extract.
      company_code_primary: companyCode,
      demand_quantity: demand,
      dispatched_quantity: dispatched,
      reserved_quantity: num(row.reserved_quantity),
      pending_quantity: pending,
      boxes: [],
    });
  }

  return out;
}

/** @deprecated Use extractConsignmentSkuPackingFromListings + flattenSkuPackingToLineRows */
export function extractConsignmentLineDraftsFromListings(
  listings: unknown
): ConsignmentLineDraft[] {
  return flattenSkuPackingToLineRows(extractConsignmentSkuPackingFromListings(listings));
}

/** One box line in the bulk packing form (PO SKU fixed; box name + qty editable). */
export type ConsignmentBulkSkuRow = {
  id: string;
  po_secondary_sku: string;
  company_code_primary: string;
  box_name: string;
  box_quantity: string;
  /** False for the required base row per SKU; true for rows added via Add box. */
  removable: boolean;
};

/** @deprecated Use ConsignmentBulkSkuRow */
export type ConsignmentBulkBoxRow = ConsignmentBulkSkuRow;

function bulkRowId(poSecondarySku: string, boxIndex: number): string {
  return `${poSecondarySku}::${boxIndex}`;
}

export function skusToBulkFormRows(skus: ConsignmentSkuPacking[]): ConsignmentBulkSkuRow[] {
  const out: ConsignmentBulkSkuRow[] = [];
  for (const s of skus) {
    const filled = s.boxes.filter(
      (b) => b.box_name.trim() || (Number.isFinite(b.box_quantity) && b.box_quantity > 0)
    );
    if (filled.length > 0) {
      filled.forEach((b, i) => {
        out.push({
          id: bulkRowId(s.po_secondary_sku, i),
          po_secondary_sku: s.po_secondary_sku,
          company_code_primary: s.company_code_primary,
          box_name: b.box_name,
          box_quantity: b.box_quantity > 0 ? String(b.box_quantity) : "",
          removable: i > 0,
        });
      });
      continue;
    }
    out.push({
      id: bulkRowId(s.po_secondary_sku, 0),
      po_secondary_sku: s.po_secondary_sku,
      company_code_primary: s.company_code_primary,
      box_name: "",
      box_quantity: s.pending_quantity > 0 ? String(s.pending_quantity) : "",
      removable: false,
    });
  }
  return out;
}

export function applyBulkFormRowsToSkus(
  rows: ConsignmentBulkSkuRow[],
  templateSkus: ConsignmentSkuPacking[]
): { skus: ConsignmentSkuPacking[]; errors: string[] } {
  const errors: string[] = [];
  const rowsBySku = new Map<string, ConsignmentBulkSkuRow[]>();

  for (const row of rows) {
    const sku = row.po_secondary_sku.trim();
    if (!sku) continue;
    const list = rowsBySku.get(sku) ?? [];
    list.push(row);
    rowsBySku.set(sku, list);
  }

  const next = templateSkus.map((tmpl) => {
    const skuRows = rowsBySku.get(tmpl.po_secondary_sku) ?? [];
    const label = `${tmpl.po_secondary_sku}${tmpl.company_code_primary ? ` / ${tmpl.company_code_primary}` : ""}`;
    const boxes: ConsignmentBoxLine[] = [];

    skuRows.forEach((row, boxIdx) => {
      const bin = row.box_name.trim();
      const qty = Math.trunc(Number(row.box_quantity));
      if (!bin && (!Number.isFinite(qty) || qty < 1)) return;

      if (!bin) {
        errors.push(`${label} (box ${boxIdx + 1}): box name is required`);
        return;
      }
      if (!Number.isFinite(qty) || qty < 1) {
        errors.push(`${label} (box ${boxIdx + 1}): quantity must be at least 1`);
        return;
      }
      boxes.push({
        box_number: boxes.length + 1,
        box_quantity: qty,
        box_name: bin,
      });
    });

    return { ...tmpl, boxes };
  });

  if (!next.some((s) => s.boxes.length > 0) && errors.length === 0) {
    errors.push("Enter at least one box line with box name and quantity");
  }

  return { skus: next, errors };
}

export function flattenSkuPackingToLineRows(skus: ConsignmentSkuPacking[]): ConsignmentLineDraft[] {
  const out: ConsignmentLineDraft[] = [];
  for (const sku of skus) {
    for (const box of sku.boxes) {
      out.push({
        po_secondary_sku: sku.po_secondary_sku,
        company_code_primary: sku.company_code_primary,
        demand_quantity: sku.demand_quantity,
        dispatched_quantity: sku.dispatched_quantity,
        reserved_quantity: sku.reserved_quantity,
        pending_quantity: sku.pending_quantity,
        box_number: box.box_number,
        box_quantity: box.box_quantity,
        box_name: box.box_name,
      });
    }
  }
  return out;
}

function itemCodeKeyFromRow(
  row: ConsignmentLineDraft,
  templateByKey: Map<string, ConsignmentSkuPacking>
): string {
  const primary = skuKey(row.po_secondary_sku);
  const secondary = skuKey(row.company_code_primary);
  if (templateByKey.size > 0) {
    if (templateByKey.has(primary)) return primary;
    if (templateByKey.has(secondary)) return secondary;
  }
  return primary || secondary;
}

export function groupLineRowsToSkuPacking(
  rows: ConsignmentLineDraft[],
  templateSkus?: ConsignmentSkuPacking[]
): ConsignmentSkuPacking[] {
  const templateByKey = new Map<string, ConsignmentSkuPacking>();
  for (const t of templateSkus ?? []) {
    templateByKey.set(skuKey(t.po_secondary_sku), { ...t, boxes: [] });
  }

  const groups = new Map<string, ConsignmentSkuPacking>();

  for (const row of rows) {
    const key = itemCodeKeyFromRow(row, templateByKey);
    if (!key) continue;

    let g = groups.get(key);
    if (!g) {
      const tmpl = templateByKey.get(key);
      g = tmpl
        ? { ...tmpl, boxes: [] }
        : {
            po_secondary_sku: row.po_secondary_sku,
            inventory_sku_id: row.po_secondary_sku,
            company_code_primary: row.company_code_primary,
            demand_quantity: row.demand_quantity,
            dispatched_quantity: row.dispatched_quantity,
            reserved_quantity: row.reserved_quantity,
            pending_quantity: row.pending_quantity,
            boxes: [],
          };
      groups.set(key, g);
    }

    if (row.box_name.trim() || row.box_number > 0 || row.box_quantity > 0) {
      g.boxes.push({
        box_number: Math.trunc(row.box_number),
        box_quantity: Math.trunc(row.box_quantity),
        box_name: row.box_name.trim(),
      });
    }
  }

  if (templateSkus?.length) {
    return templateSkus.map((t) => {
      const g = groups.get(skuKey(t.po_secondary_sku));
      return g ?? { ...t, boxes: [] };
    });
  }

  return [...groups.values()];
}

export function sumPackedQty(sku: ConsignmentSkuPacking): number {
  return sku.boxes.reduce((s, b) => s + (Number.isFinite(b.box_quantity) ? b.box_quantity : 0), 0);
}

export function validateConsignmentSkuPackingClient(
  skus: ConsignmentSkuPacking[],
  validBinNames: Set<string>
): { ok: boolean; errors: ConsignmentLineValidationIssue[]; warnings: ConsignmentLineValidationIssue[] } {
  const errors: ConsignmentLineValidationIssue[] = [];
  const warnings: ConsignmentLineValidationIssue[] = [];

  if (skus.length === 0) {
    errors.push({ skuIndex: 0, field: "skus", message: "At least one SKU is required" });
    return { ok: false, errors, warnings };
  }

  skus.forEach((sku, skuIdx) => {
    if (!sku.po_secondary_sku.trim()) {
      errors.push({ skuIndex: skuIdx, field: "po_secondary_sku", message: "Required" });
    }
    if (!sku.company_code_primary.trim()) {
      errors.push({ skuIndex: skuIdx, field: "company_code_primary", message: "Required" });
    }

    if (sku.boxes.length === 0) {
      errors.push({
        skuIndex: skuIdx,
        field: "boxes",
        message: "At least one box line is required",
      });
      return;
    }

    if (sku.pending_quantity <= 0) {
      errors.push({
        skuIndex: skuIdx,
        field: "pending_quantity",
        message: "Pending quantity is 0; cannot pack this SKU",
      });
    }

    let packedTotal = 0;
    sku.boxes.forEach((box, boxIdx) => {
      const binName = box.box_name.trim();
      if (!binName) {
        errors.push({ skuIndex: skuIdx, boxIndex: boxIdx, field: "box_name", message: "Required" });
      } else if (!validBinNames.has(binName.toLowerCase())) {
        errors.push({
          skuIndex: skuIdx,
          boxIndex: boxIdx,
          field: "box_name",
          message: "Must be a synced valid bin name",
        });
      }
      if (!Number.isFinite(box.box_number) || box.box_number < 1) {
        errors.push({
          skuIndex: skuIdx,
          boxIndex: boxIdx,
          field: "box_number",
          message: "Must be at least 1",
        });
      }
      if (!Number.isFinite(box.box_quantity) || box.box_quantity < 1) {
        errors.push({
          skuIndex: skuIdx,
          boxIndex: boxIdx,
          field: "box_quantity",
          message: "Must be at least 1",
        });
      }
      packedTotal += Math.trunc(box.box_quantity);
    });

    if (sku.pending_quantity > 0 && packedTotal > sku.pending_quantity) {
      errors.push({
        skuIndex: skuIdx,
        field: "box_quantity",
        message: `Total packed (${packedTotal}) exceeds pending (${sku.pending_quantity})`,
      });
    } else if (sku.pending_quantity > 0 && packedTotal < sku.pending_quantity) {
      warnings.push({
        skuIndex: skuIdx,
        field: "box_quantity",
        message: `Packed ${packedTotal} of ${sku.pending_quantity} pending`,
      });
    }
  });

  return { ok: errors.length === 0, errors, warnings };
}

function csvEscapeCell(cell: string): string {
  if (/[",\n\r\t]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

export function buildConsignmentLineSampleCsv(skus: ConsignmentSkuPacking[]): string {
  const rows: ConsignmentLineDraft[] = [];
  for (const sku of skus) {
    if (sku.boxes.length > 0) {
      rows.push(
        ...sku.boxes.map((box) => ({
          po_secondary_sku: sku.po_secondary_sku,
          company_code_primary: sku.company_code_primary,
          demand_quantity: sku.demand_quantity,
          dispatched_quantity: sku.dispatched_quantity,
          reserved_quantity: sku.reserved_quantity,
          pending_quantity: sku.pending_quantity,
          box_number: box.box_number,
          box_quantity: box.box_quantity,
          box_name: box.box_name,
        }))
      );
    } else {
      rows.push({
        po_secondary_sku: sku.po_secondary_sku,
        company_code_primary: sku.company_code_primary,
        demand_quantity: sku.demand_quantity,
        dispatched_quantity: sku.dispatched_quantity,
        reserved_quantity: sku.reserved_quantity,
        pending_quantity: sku.pending_quantity,
        box_number: 1,
        box_quantity: 0,
        box_name: "",
      });
    }
  }
  const lines = [CONSIGNMENT_LINE_CSV_HEADERS.join(",")];
  for (const d of rows) {
    lines.push(
      [
        csvEscapeCell(d.po_secondary_sku),
        csvEscapeCell(d.company_code_primary),
        String(d.demand_quantity),
        String(d.dispatched_quantity),
        String(d.reserved_quantity),
        String(d.pending_quantity),
        String(d.box_number),
        String(d.box_quantity),
        csvEscapeCell(d.box_name),
      ].join(",")
    );
  }
  return lines.join("\n") + "\n";
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === "," || ch === "\t") {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

export function parseConsignmentLineCsv(text: string): {
  rows: ConsignmentLineDraft[];
  errors: string[];
} {
  const errors: string[] = [];
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    return { rows: [], errors: ["File must include a header row and at least one data row"] };
  }

  const delim = lines[0].includes("\t") ? "\t" : ",";
  const headerCells =
    delim === "\t"
      ? lines[0].split("\t").map((h) => h.trim().toLowerCase())
      : splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());

  const expected = CONSIGNMENT_LINE_CSV_HEADERS.map((h) => h.toLowerCase());
  for (let i = 0; i < expected.length; i++) {
    if (headerCells[i] !== expected[i]) {
      errors.push(
        `Header mismatch at column ${i + 1}: expected "${expected[i]}", got "${headerCells[i] ?? ""}"`
      );
    }
  }
  if (errors.length > 0) return { rows: [], errors };

  const rows: ConsignmentLineDraft[] = [];
  for (let li = 1; li < lines.length; li++) {
    const cells =
      delim === "\t"
        ? lines[li].split("\t").map((c) => c.trim())
        : splitCsvLine(lines[li]);
    if (cells.every((c) => !c)) continue;
    rows.push({
      po_secondary_sku: cells[0] ?? "",
      company_code_primary: cells[1] ?? "",
      demand_quantity: num(cells[2]),
      dispatched_quantity: num(cells[3]),
      reserved_quantity: num(cells[4]),
      pending_quantity: num(cells[5]),
      box_number: Math.trunc(num(cells[6])),
      box_quantity: Math.trunc(num(cells[7])),
      box_name: cells[8] ?? "",
    });
  }

  if (rows.length === 0) {
    errors.push("No data rows found");
  }
  return { rows, errors };
}

export function parseConsignmentLineCsvToSkus(
  text: string,
  templateSkus: ConsignmentSkuPacking[]
): { skus: ConsignmentSkuPacking[]; errors: string[] } {
  const parsed = parseConsignmentLineCsv(text);
  if (parsed.errors.length > 0) {
    return { skus: [], errors: parsed.errors };
  }
  return {
    skus: groupLineRowsToSkuPacking(parsed.rows, templateSkus),
    errors: [],
  };
}

export function downloadConsignmentLineSampleCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** @deprecated Use validateConsignmentSkuPackingClient */
export function validateConsignmentLineDraftsClient(
  rows: ConsignmentLineDraft[],
  validBinNames: Set<string>
): { ok: boolean; errors: { row: number; field: string; message: string }[] } {
  const skus = groupLineRowsToSkuPacking(rows);
  const r = validateConsignmentSkuPackingClient(skus, validBinNames);
  return {
    ok: r.ok,
    errors: r.errors.map((e) => ({
      row: e.skuIndex + 1,
      field: e.field,
      message: e.message,
    })),
  };
}

export const OUTBOUND_SHIPMENT_TYPES = ["Surface", "Air", "Express"] as const;
export type OutboundShipmentType = (typeof OUTBOUND_SHIPMENT_TYPES)[number];
