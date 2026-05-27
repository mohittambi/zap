/** Canonical WIP flag for outbound POs (Y/YES = WIP, N/NO = not WIP). */

export function isOutboundPoWip(value: string | null | undefined): boolean {
  const v = (value ?? "").toUpperCase().trim();
  return v === "Y" || v === "YES";
}

export function normalizeOutboundPoWipForStorage(
  value: string | null | undefined
): "Y" | "N" | null {
  if (value == null || String(value).trim() === "") return null;
  const v = String(value).trim().toUpperCase();
  if (v === "Y" || v === "YES") return "Y";
  if (v === "N" || v === "NO") return "N";
  return null;
}
