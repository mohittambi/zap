/**
 * Pure derivations used by the inbound PO detail page.
 * Kept out of the React component for unit testing.
 */

import { displayPoStatus } from "./inboundPoGrnPendingUi";

const EM_DASH = "—";

export function isZapCancelled(zapStatus: unknown): boolean {
  return String(zapStatus ?? "").trim().toUpperCase() === "CANCELLED";
}

/**
 * Friendly, self-explanatory PO status for the detail page badge.
 * Delegates to displayPoStatus so backend enums (e.g. PENDING_PUBLISHED)
 * are humanized the same way as the PO list page.
 */
export function derivePoDisplayStatus(
  cancelled: boolean,
  headerStatus: string | null | undefined
): string {
  if (cancelled) return "Cancelled";
  const s = (headerStatus ?? "").trim();
  if (s === "") return EM_DASH;
  return displayPoStatus(s);
}

export function deriveDisplayName(value: string | null | undefined): string {
  const s = (value ?? "").trim();
  return s === "" ? EM_DASH : s;
}

export function deriveLocation(
  city: string | null | undefined,
  state: string | null | undefined
): string {
  const c = deriveDisplayName(city);
  const s = deriveDisplayName(state);
  if (c === EM_DASH && s === EM_DASH) return EM_DASH;
  return [c, s].filter((x) => x !== EM_DASH).join(", ");
}

/** Returns one-decimal percentage of numerator/denominator, or null when denominator is non-positive. */
export function deriveFillPct(
  numerator: number,
  denominator: number
): number | null {
  if (!Number.isFinite(denominator) || denominator <= 0) return null;
  if (!Number.isFinite(numerator)) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function numberStringOrDash(
  value: number | null | undefined
): string {
  if (value == null || !Number.isFinite(value)) return EM_DASH;
  return String(value);
}
