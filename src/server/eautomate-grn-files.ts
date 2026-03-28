import { eautomateProxyHeaders, getEautomateBaseUrl } from "@/server/eautomate-proxy";

export type GrnFileDownloadKind = "invoice" | "debit_note";

/** Headers for binary file fetch (eAutomate may return PDF). */
export function eautomateBinaryHeaders(): Headers {
  const h = eautomateProxyHeaders();
  h.set("Accept", "*/*");
  return h;
}

/**
 * Build absolute URL to fetch a GRN file from eAutomate.
 * Set env path templates (path only or full URL). Placeholders: {fileId}, {grnId}, {noteId}
 *
 * EAUTOMATE_GRN_INVOICE_FILE_URL_PATH — e.g. /public/api/purchase_orders/grn/invoice_file/{fileId}/download
 * EAUTOMATE_GRN_DCN_FILE_URL_PATH — e.g. /public/api/purchase_orders/grn/debit_credit_note_file/{fileId}/download
 */
export function buildEautomateGrnFileUrl(
  kind: GrnFileDownloadKind,
  grnId: number,
  fileId: number,
  noteId?: number
): URL | null {
  const envKey =
    kind === "invoice" ? "EAUTOMATE_GRN_INVOICE_FILE_URL_PATH" : "EAUTOMATE_GRN_DCN_FILE_URL_PATH";
  const template = process.env[envKey]?.trim();
  if (!template) return null;
  const replaced = template
    .replace(/\{fileId\}/g, String(fileId))
    .replace(/\{grnId\}/g, String(grnId))
    .replace(/\{noteId\}/g, String(noteId ?? ""));
  if (replaced.startsWith("http://") || replaced.startsWith("https://")) {
    return new URL(replaced);
  }
  const base = getEautomateBaseUrl().replace(/\/$/, "");
  const path = replaced.startsWith("/") ? replaced : `/${replaced}`;
  return new URL(`${base}${path}`);
}
