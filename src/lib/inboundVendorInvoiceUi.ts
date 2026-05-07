/** Client-side vendor invoice picker rules aligned with Close GRN / Documents upload. */

const MAX_VENDOR_INVOICE_BYTES = 4 * 1024 * 1024;

export function maxVendorInvoiceBytes(): number {
  return MAX_VENDOR_INVOICE_BYTES;
}

/** @returns rejection reason code for UX (caller maps to toasts/strings). */
export type VendorInvoiceRejection =
  | "oversize"
  | "bad_extension";

export function classifyVendorInvoicePick(
  fileName: string,
  sizeBytes: number
): VendorInvoiceRejection | null {
  if (sizeBytes > MAX_VENDOR_INVOICE_BYTES) return "oversize";
  const lower = fileName.toLowerCase();
  if (!/\.(jpg|jpeg|pdf)$/.test(lower)) return "bad_extension";
  return null;
}
