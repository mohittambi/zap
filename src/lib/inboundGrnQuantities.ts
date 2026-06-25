/** JSONB keys for quantity fields on inbound_grn_items.raw — shared by UI, debit notes, and header recalc. */

export type JsonRecord = Record<string, unknown>;

export const INVOICE_QTY_KEYS = [
  "invoice_quantity",
  "invoiceQuantity",
  "grn_invoice_quantity",
  "current_grn_invoice_quantity",
  "currentInvoiceQuantity",
] as const;

export const ACCEPTED_QTY_KEYS = [
  "accepted_quantity",
  "acceptedQuantity",
  "grn_accepted_quantity",
  "current_grn_accepted_quantity",
  "currentGrnAcceptedQuantity",
] as const;

export const REJECTED_QTY_KEYS = [
  "rejected_quantity",
  "rejectedQuantity",
  "grn_rejected_quantity",
  "current_grn_rejected_quantity",
  "currentGrnRejectedQuantity",
] as const;

export const SHORT_QTY_KEYS = [
  "shortage_quantity",
  "shortageQuantity",
  "grn_shortage_quantity",
  "current_grn_shortage_quantity",
  "currentGrnShortageQuantity",
  "short_quantity",
] as const;

export type GrnHeaderTotals = {
  grn_sku_count: number;
  grn_invoice_quantity: number;
  grn_accepted_quantity: number;
  grn_rejected_quantity: number;
  grn_shortage_quantity: number;
  zap_receipt_exception: boolean;
};

export function pickQtyFromRaw(raw: JsonRecord, keys: readonly string[]): number {
  for (const k of keys) {
    const v = raw[k];
    if (v != null && v !== "") {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

export function computeGrnHeaderTotalsFromItems(
  items: ReadonlyArray<{ raw: unknown }>
): GrnHeaderTotals {
  let grn_invoice_quantity = 0;
  let grn_accepted_quantity = 0;
  let grn_rejected_quantity = 0;
  let grn_shortage_quantity = 0;
  let zap_receipt_exception = false;

  for (const item of items) {
    const raw =
      item.raw && typeof item.raw === "object" && !Array.isArray(item.raw)
        ? (item.raw as JsonRecord)
        : {};
    const inv = pickQtyFromRaw(raw, INVOICE_QTY_KEYS);
    const acc = pickQtyFromRaw(raw, ACCEPTED_QTY_KEYS);
    const rej = pickQtyFromRaw(raw, REJECTED_QTY_KEYS);
    const sh = pickQtyFromRaw(raw, SHORT_QTY_KEYS);
    grn_invoice_quantity += inv;
    grn_accepted_quantity += acc;
    grn_rejected_quantity += rej;
    grn_shortage_quantity += sh;
    if (rej > 0 || sh > 0) zap_receipt_exception = true;
  }

  return {
    grn_sku_count: items.length,
    grn_invoice_quantity: Math.round(grn_invoice_quantity),
    grn_accepted_quantity: Math.round(grn_accepted_quantity),
    grn_rejected_quantity: Math.round(grn_rejected_quantity),
    grn_shortage_quantity: Math.round(grn_shortage_quantity),
    zap_receipt_exception,
  };
}

/** SQL fragment: pick first numeric value from jsonb `raw` for the given keys. */
export function sqlPickQtyFromRaw(alias: string, keys: readonly string[]): string {
  const parts = keys.map(
    (k) =>
      `NULLIF(TRIM(${alias}.raw->>'${k.replace(/'/g, "''")}'), '')::numeric`
  );
  return `COALESCE(${parts.join(", ")}, 0)`;
}
