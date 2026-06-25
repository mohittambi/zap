/**
 * Pure helpers for the Open New GRN modal on the inbound PO detail page.
 */

export type JsonRecord = Record<string, unknown>;

export const NEW_GRN_LINE_PREVIEW_LIMIT = 5;

export const PO_LINE_ORDERED_QTY_KEYS = [
  "quantity",
  "required_quantity",
  "requiredQuantity",
  "ordered_quantity",
  "orderedQuantity",
  "po_quantity",
  "qty",
] as const;

export type NewGrnBoxFieldState = {
  boxInvoice: string;
  boxActual: string;
  actualBoxManuallyEdited: boolean;
};

export function initialNewGrnBoxFieldState(): NewGrnBoxFieldState {
  return {
    boxInvoice: "",
    boxActual: "",
    actualBoxManuallyEdited: false,
  };
}

/** Mirror invoice box count into actual boxes until the user edits actual boxes. */
export function applyInvoiceBoxCountChange(
  invoiceValue: string,
  state: Pick<NewGrnBoxFieldState, "boxActual" | "actualBoxManuallyEdited">
): NewGrnBoxFieldState {
  return {
    boxInvoice: invoiceValue,
    boxActual: state.actualBoxManuallyEdited ? state.boxActual : invoiceValue,
    actualBoxManuallyEdited: state.actualBoxManuallyEdited,
  };
}

/** User edited actual box count — stop mirroring from invoice boxes. */
export function mergeActualBoxCountChange(
  actualValue: string,
  state: Pick<NewGrnBoxFieldState, "boxInvoice" | "actualBoxManuallyEdited">
): NewGrnBoxFieldState {
  return {
    boxInvoice: state.boxInvoice,
    boxActual: actualValue,
    actualBoxManuallyEdited: true,
  };
}

function pickQtyFromRecord(
  raw: JsonRecord | null | undefined,
  keys: readonly string[]
): number | null {
  if (!raw) return null;
  for (const k of keys) {
    const v = raw[k];
    if (v != null && v !== "") {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  }
  const listing = raw.listing;
  if (listing && typeof listing === "object" && !Array.isArray(listing)) {
    return pickQtyFromRecord(listing as JsonRecord, keys);
  }
  return null;
}

/** Ordered quantity shown in the seeded-line preview. */
export function pickPoLineOrderedQty(raw: unknown): number | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return pickQtyFromRecord(raw as JsonRecord, PO_LINE_ORDERED_QTY_KEYS);
}

export type PoLinePreviewRow = {
  line_index: number;
  sku_id: string;
  ordered_qty: number | null;
};

export function buildPoLinePreviewRows(
  lines: ReadonlyArray<{ line_index: number; sku_id: string | null; raw: unknown }>,
  limit = NEW_GRN_LINE_PREVIEW_LIMIT
): { rows: PoLinePreviewRow[]; total: number; remaining: number } {
  const total = lines.length;
  const rows = lines.slice(0, limit).map((line) => ({
    line_index: line.line_index,
    sku_id: (line.sku_id ?? "").trim() || "—",
    ordered_qty: pickPoLineOrderedQty(line.raw),
  }));
  return {
    rows,
    total,
    remaining: Math.max(0, total - limit),
  };
}
