export type VendorMetricsInput = {
  vendor_id: number;
  vendor_name: string;
  acceptance_rate_pct: number;
  shortage_rate_pct: number;
  rate_diff_dn_count: number;
  grn_count: number;
};

export type VendorReliability = VendorMetricsInput & {
  score: number;
  band: "PREFERRED" | "ACCEPTABLE" | "REVIEW" | "HIGH_RISK";
};

/**
 * Composite 0–100 score. Higher is better.
 * Weights: acceptance 40%, inverse shortage 35%, inverse DN rate 25%.
 */
export function computeVendorReliabilityScore(
  input: Omit<VendorMetricsInput, "vendor_name"> & { vendor_name?: string }
): number {
  const acceptance = Math.min(100, Math.max(0, input.acceptance_rate_pct));
  const shortagePenalty = Math.min(100, Math.max(0, input.shortage_rate_pct));
  const dnRate =
    input.grn_count > 0
      ? (input.rate_diff_dn_count / input.grn_count) * 100
      : 0;
  const dnPenalty = Math.min(100, dnRate);

  const score =
    acceptance * 0.4 +
    (100 - shortagePenalty) * 0.35 +
    (100 - dnPenalty) * 0.25;

  return Math.round(Math.min(100, Math.max(0, score)));
}

export function bandForScore(score: number): VendorReliability["band"] {
  if (score >= 85) return "PREFERRED";
  if (score >= 70) return "ACCEPTABLE";
  if (score >= 50) return "REVIEW";
  return "HIGH_RISK";
}

export function buildVendorReliability(
  input: VendorMetricsInput
): VendorReliability {
  const score = computeVendorReliabilityScore(input);
  return { ...input, score, band: bandForScore(score) };
}
