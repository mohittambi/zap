/**
 * GRN line quantity accountability: invoice quantity must equal the sum of
 * accepted + rejected + shortage for a single receipt line.
 * Shared by web UI and API so rules stay consistent.
 */

export type GrnLineQtyPayload = {
  invoice_quantity: number;
  accepted_quantity: number;
  rejected_quantity: number;
  shortage_quantity: number;
};

/** Max rounding error when comparing floating-point quantity sums (4 decimal places). */
const QTY_SUM_EPS = 1e-4;

function sumAcceptedRejectedShort(q: GrnLineQtyPayload): number {
  return q.accepted_quantity + q.rejected_quantity + q.shortage_quantity;
}

export function grnLineQuantitySumErrorMessage(q: GrnLineQtyPayload): string | null {
  const inv = q.invoice_quantity;
  const sum = sumAcceptedRejectedShort(q);
  if (!Number.isFinite(inv) || !Number.isFinite(sum)) {
    return "Quantities must be valid numbers";
  }
  if (Math.abs(sum - inv) <= QTY_SUM_EPS) {
    return null;
  }
  return `Quantity in Invoice must equal Accepted + Rejected + Short (sum is ${formatQty(
    sum
  )}, invoice is ${formatQty(inv)})`;
}

function formatQty(n: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 4 }).format(n);
}

/**
 * @throws Error with user-visible message when the business rule fails
 */
export function assertGrnLineQuantitiesAccountable(payload: GrnLineQtyPayload): void {
  const msg = grnLineQuantitySumErrorMessage(payload);
  if (msg) throw new Error(msg);
}
