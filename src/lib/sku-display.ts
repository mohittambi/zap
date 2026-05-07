/**
 * eAutomate stores the literal string "NA" as a sentinel for absent SKU fields.
 * This helper normalises those values for display so "NA", "", and null all
 * render as "—" while real identifiers pass through unchanged.
 */
export function skuDisplay(value: string | null | undefined): string {
  if (value == null) return "—";
  const s = String(value).trim();
  if (s === "" || s === "NA") return "—";
  return s;
}

/** Returns true when the value is a real (non-sentinel) SKU identifier. */
export function hasRealSku(value: string | null | undefined): boolean {
  if (value == null) return false;
  const s = String(value).trim();
  return s !== "" && s !== "NA";
}

/**
 * Format a percentage value for display.
 * null/undefined/"NA" → "—", numbers normalised to one decimal place.
 */
export function fmtPct(v: number | string | null | undefined): string {
  if (v == null) return "—";
  const s = String(v).trim();
  if (s === "" || s === "NA") return "—";
  const n = parseFloat(s);
  if (isNaN(n)) return "—";
  return `${n % 1 === 0 ? n : n.toFixed(1)}%`;
}

/**
 * Format a plain numeric value for display.
 * null/undefined/"NA" → "—", otherwise String(n).
 */
export function fmtNum(v: number | string | null | undefined): string {
  if (v == null) return "—";
  const s = String(v).trim();
  if (s === "" || s === "NA") return "—";
  return s;
}
