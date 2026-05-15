/** Pure workflow normalizers shared by inbound API services and tests. */

/**
 * Mirrors `updateGrnStatus`: canonicalize legacy AUDITED audit label to CLOSED.
 */
export function normalizeGrnAuditStatusForPatch(input: string): string {
  const t = input.trim();
  const u = t.toUpperCase();
  if (u === "AUDITED") return "CLOSED";
  return t;
}

/** Acceptable decision body for Zap-local DCN row updates. */
export type DcnDecisionStatus = "APPROVED" | "REJECTED";

export function normalizeDcnDecisionStatus(
  input: unknown
): DcnDecisionStatus | null {
  if (typeof input !== "string" && typeof input !== "number") return null;
  const s = String(input).trim().toUpperCase();
  if (s === "APPROVED" || s === "REJECTED") return s;
  return null;
}

export function isTerminalAccountsStatus(status: string): boolean {
  const u = status.trim().toUpperCase();
  return u === "APPROVED" || u === "REJECTED";
}
