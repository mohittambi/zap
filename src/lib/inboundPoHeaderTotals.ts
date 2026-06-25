/** PO-level rollup from GRN header snapshots — mirrors eAutomate fill-rate semantics for Zap POs. */

export type PoGrnHeaderRow = {
  grn_invoice_quantity: number;
  grn_accepted_quantity: number;
  grn_rejected_quantity: number;
};

export type PoSkuAcceptanceRow = {
  sku_id: string;
  accepted_quantity: number;
};

export type PoHeaderTotalsInput = {
  sku_count: number;
  total_quantity: number;
  grns: ReadonlyArray<PoGrnHeaderRow>;
  /** Distinct SKUs with any accepted qty across GRN lines (for sku_fill_rate). */
  skus_with_acceptance: number;
};

export type PoHeaderTotals = {
  number_of_grns: number;
  total_invoice_quantity: number;
  total_accepted_quantity: number;
  total_rejected_quantity: number;
  sku_fill_rate: number;
  quantity_fill_rate: number;
};

/** Store fill rates as 0–100 percentages (NUMERIC(10,2)), matching inbound UI FillRateBar. */
export function roundFillRatePct(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  const pct = (numerator / denominator) * 100;
  if (!Number.isFinite(pct)) return 0;
  return Math.round(pct * 100) / 100;
}

export function computePoHeaderTotalsFromGrns(input: PoHeaderTotalsInput): PoHeaderTotals {
  const grns = input.grns ?? [];
  let total_invoice_quantity = 0;
  let total_accepted_quantity = 0;
  let total_rejected_quantity = 0;

  for (const g of grns) {
    total_invoice_quantity += Number(g.grn_invoice_quantity ?? 0);
    total_accepted_quantity += Number(g.grn_accepted_quantity ?? 0);
    total_rejected_quantity += Number(g.grn_rejected_quantity ?? 0);
  }

  const sku_count = Math.max(0, Number(input.sku_count ?? 0));
  const total_quantity = Math.max(0, Number(input.total_quantity ?? 0));
  const skus_with_acceptance = Math.max(0, Number(input.skus_with_acceptance ?? 0));

  return {
    number_of_grns: grns.length,
    total_invoice_quantity: Math.round(total_invoice_quantity),
    total_accepted_quantity: Math.round(total_accepted_quantity),
    total_rejected_quantity: Math.round(total_rejected_quantity),
    quantity_fill_rate: roundFillRatePct(total_accepted_quantity, total_quantity),
    sku_fill_rate: roundFillRatePct(
      Math.min(skus_with_acceptance, sku_count || skus_with_acceptance),
      sku_count
    ),
  };
}

/** Count distinct SKUs with accepted qty > 0 from line-level rows. */
export function countSkusWithAcceptance(
  lines: ReadonlyArray<PoSkuAcceptanceRow>
): number {
  const seen = new Set<string>();
  for (const line of lines) {
    const sku = String(line.sku_id ?? "").trim();
    if (!sku) continue;
    if (Number(line.accepted_quantity ?? 0) > 0) {
      seen.add(sku);
    }
  }
  return seen.size;
}
