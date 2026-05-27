/** True when saved line items must not be edited (MARKED_RTD or forward). */
export function isConsignmentLinesLocked(opts: {
  consignment_status?: string | null;
  marked_rtd_at?: string | null;
}): boolean {
  if (opts.marked_rtd_at?.trim()) return true;
  return opts.consignment_status?.trim().toLowerCase() === "marked_rtd";
}
