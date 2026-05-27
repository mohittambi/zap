/** PO must be acknowledged before consignment create (YES/Y/ACK variants). */

export function isOutboundPoAcknowledged(
  value: string | null | undefined
): boolean {
  const v = (value ?? "").toUpperCase().trim();
  return v === "Y" || v === "YES" || v === "ACK" || v === "ACKNOWLEDGED";
}
