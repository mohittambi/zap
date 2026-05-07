/**
 * Pure gate checks for inbound GRN close UX (aligned with closeGrn API:
 * invoice must exist on GRN).
 */

export function hasVendorInvoiceReadyToClose(opts: {
  existingInvoiceFilesCount: number;
  stagedInvoiceFilesCount: number;
}): boolean {
  return opts.existingInvoiceFilesCount + opts.stagedInvoiceFilesCount >= 1;
}

export function showCloseGrnHeaderAction(
  grnStatus: string | null | undefined
): boolean {
  return String(grnStatus ?? "").trim().toUpperCase() === "OPEN";
}
