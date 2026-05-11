/**
 * Pure gate checks + button-state derivations for the inbound GRN close UX.
 * Server contract: closeGrn requires at least one invoice file on the GRN.
 */

export const VENDOR_INVOICE_MAX_FILES = 10;

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

/** Submit button label for the Close GRN dialog. Surfaces upload count + busy
 * state so the user knows exactly what action they're triggering. */
export function closeGrnSubmitLabel(opts: {
  busy: boolean;
  stagedFilesCount: number;
}): string {
  if (opts.busy) {
    return opts.stagedFilesCount > 0 ? "Uploading & Closing…" : "Closing…";
  }
  if (opts.stagedFilesCount > 0) {
    const noun = opts.stagedFilesCount === 1 ? "file" : "files";
    return `Upload ${opts.stagedFilesCount} ${noun} & Close GRN`;
  }
  return "Close GRN";
}

/** Disabled when busy OR no invoice file is available (existing or staged). */
export function closeGrnSubmitDisabled(opts: {
  busy: boolean;
  existingInvoiceFilesCount: number;
  stagedInvoiceFilesCount: number;
}): boolean {
  if (opts.busy) return true;
  return !hasVendorInvoiceReadyToClose({
    existingInvoiceFilesCount: opts.existingInvoiceFilesCount,
    stagedInvoiceFilesCount: opts.stagedInvoiceFilesCount,
  });
}

/** Inline tooltip + helper-text shown when the submit button is disabled.
 * Returns null when the button is enabled (no hint needed). */
export function closeGrnDisabledHint(opts: {
  busy: boolean;
  existingInvoiceFilesCount: number;
  stagedInvoiceFilesCount: number;
}): string | null {
  if (opts.busy) return null;
  if (
    hasVendorInvoiceReadyToClose({
      existingInvoiceFilesCount: opts.existingInvoiceFilesCount,
      stagedInvoiceFilesCount: opts.stagedInvoiceFilesCount,
    })
  ) {
    return null;
  }
  return "Upload at least one invoice file (or use one already on this GRN) before closing.";
}

export type InvoiceFileRejection = "oversize" | "bad_extension";

export type InvoiceFilesClassification = {
  accepted: File[];
  rejected: Array<{ file: File; reason: InvoiceFileRejection }>;
  /** Number of files dropped because they exceeded VENDOR_INVOICE_MAX_FILES. */
  droppedDueToCap: number;
};

/** Pure classification: caps at VENDOR_INVOICE_MAX_FILES, partitions the rest
 * by per-file validity. The toast-driven wrapper in the page consumes this. */
export function classifyInvoiceFilesPicked(
  picked: File[],
  classify: (name: string, size: number) => "ok" | InvoiceFileRejection
): InvoiceFilesClassification {
  const droppedDueToCap = Math.max(0, picked.length - VENDOR_INVOICE_MAX_FILES);
  const slice = picked.slice(0, VENDOR_INVOICE_MAX_FILES);
  const accepted: File[] = [];
  const rejected: Array<{ file: File; reason: InvoiceFileRejection }> = [];
  for (const f of slice) {
    const verdict = classify(f.name, f.size);
    if (verdict === "ok") {
      accepted.push(f);
    } else {
      rejected.push({ file: f, reason: verdict });
    }
  }
  return { accepted, rejected, droppedDueToCap };
}
