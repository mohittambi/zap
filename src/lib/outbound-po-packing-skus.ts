export type PoPackingSkuHint = {
  itemCode: string;
  companyCodePrimary: string | null;
  companyCodeSecondary: string | null;
};

const LISTING_ARRAY_KEYS = ["content", "items", "data", "rows", "results"] as const;

const MAX_SAMPLE_ROWS = 50;

function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
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

/** PO line item codes from listings envelope (same resolution as server preview). */
export function extractPoPackingSkusFromListings(listings: unknown): PoPackingSkuHint[] {
  const rows = listingRowsFromSnapshot(listings);
  const seen = new Set<string>();
  const out: PoPackingSkuHint[] = [];

  for (const row of rows) {
    const itemCode =
      str(row.po_secondary_sku) || str(row.item_code) || str(row.sku);
    if (!itemCode || seen.has(itemCode)) continue;
    seen.add(itemCode);

    const primary = str(row.company_code_primary) || null;
    let secondary = str(row.company_code_secondary) || null;
    if (!secondary) {
      const zapEan = str(row.zap_ean);
      if (zapEan) secondary = zapEan;
    }

    out.push({
      itemCode,
      companyCodePrimary: primary,
      companyCodeSecondary: secondary,
    });
  }

  return out;
}

function csvEscapeCell(cell: string): string {
  if (/[",\n\r]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

const PACKING_CSV_HEADERS = [
  "Bin Number",
  "Bin Name",
  "Item Code",
  "Quantity",
  "Company Code Primary",
  "Company Code Secondary",
] as const;

/** Build a sample bin-packing CSV prefilled with this PO's item codes. */
export function buildConsignmentPackingSampleCsv(opts: {
  skus: PoPackingSkuHint[];
  defaultBinName?: string;
  defaultBinNumber?: number;
}): string {
  const binName = opts.defaultBinName?.trim() || "Small Carton";
  const binNumber = opts.defaultBinNumber ?? 1;
  const skus = opts.skus.slice(0, MAX_SAMPLE_ROWS);

  const lines = [PACKING_CSV_HEADERS.join(",")];
  for (const sku of skus) {
    lines.push(
      [
        String(binNumber),
        csvEscapeCell(binName),
        csvEscapeCell(sku.itemCode),
        "1",
        csvEscapeCell(sku.companyCodePrimary ?? ""),
        csvEscapeCell(sku.companyCodeSecondary ?? ""),
      ].join(",")
    );
  }
  return lines.join("\n") + "\n";
}

/** Trigger browser download of a CSV string. */
export function downloadConsignmentPackingSampleCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
