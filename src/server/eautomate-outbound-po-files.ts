import { eautomateBinaryHeaders } from "./eautomate-grn-files";
import { getEautomateBaseUrl } from "./eautomate-proxy";

export { eautomateBinaryHeaders };

/**
 * Build URL to download an outbound (incoming) PO file from eAutomate.
 * Set EAUTOMATE_OUTBOUND_PO_FILE_URL_PATH (path or full URL). Placeholders: {fileId}, {poNumber}
 *
 * Examples (verify in browser Network tab for your eAutomate build):
 * - /public/api/incoming_purchase_orders/download_po_file/{fileId}
 * - /public/api/incoming_purchase_orders/po_attachment/{fileId}/download
 */
export function buildEautomateOutboundPoFileDownloadUrl(
  fileId: number,
  poNumber: string
): URL | null {
  const template = process.env.EAUTOMATE_OUTBOUND_PO_FILE_URL_PATH?.trim();
  if (!template) return null;
  const replaced = template
    .replace(/\{fileId\}/g, String(fileId))
    .replace(/\{poNumber\}/g, encodeURIComponent(poNumber));
  if (replaced.startsWith("http://") || replaced.startsWith("https://")) {
    return new URL(replaced);
  }
  const base = getEautomateBaseUrl().replace(/\/$/, "");
  const path = replaced.startsWith("/") ? replaced : `/${replaced}`;
  return new URL(`${base}${path}`);
}

export function outboundPoFileDownloadConfigured(): boolean {
  return Boolean(process.env.EAUTOMATE_OUTBOUND_PO_FILE_URL_PATH?.trim());
}
