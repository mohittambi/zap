/**
 * eAutomate outbound PO workflow actions (acknowledge, cancel, labels, reports).
 * Paths are overridable via env; defaults match common `/public/api/incoming_purchase_orders/...` patterns.
 * If an upstream call fails with 404, set the corresponding EAUTOMATE_* env to the path from eCraft Network tab.
 * SKU report download is generated in Zap from `outbound_purchase_orders.listings_snapshot` (not an eAutomate URL).
 */

import { getEautomateBaseUrl } from "@/server/eautomate-proxy";

function resolveTemplate(
  envKey: string,
  fallback: string,
  vars: Record<string, string>
): string {
  const t = (process.env[envKey]?.trim() || fallback).replace(/\/$/, "");
  let out = t.startsWith("http") ? t : `${getEautomateBaseUrl().replace(/\/$/, "")}${t.startsWith("/") ? t : `/${t}`}`;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(encodeURIComponent(v));
  }
  return out;
}

/** POST JSON body for acknowledge/cancel/labels — extend if your API expects different keys. */
export function poWorkflowJsonBody(poId: number, poNumber: string): Record<string, unknown> {
  return {
    incoming_purchase_order_id: poId,
    po_number: poNumber,
    id: poId,
  };
}

export function workflowAcknowledgeUrl(poNumber: string): string {
  return resolveTemplate(
    "EAUTOMATE_PO_ACK_URL",
    "/public/api/incoming_purchase_orders/acknowledge",
    { poNumber }
  );
}

export function workflowCancelUrl(poNumber: string): string {
  return resolveTemplate(
    "EAUTOMATE_PO_CANCEL_URL",
    "/public/api/incoming_purchase_orders/cancel",
    { poNumber }
  );
}

export function workflowDownloadPendencyPdfUrl(poNumber: string): string {
  return resolveTemplate(
    "EAUTOMATE_PO_DOWNLOAD_PENDENCY_PDF_URL",
    "/public/api/incoming_purchase_orders/download_pendency_pdf/{poNumber}",
    { poNumber }
  );
}

export function workflowGenerateProductLabelsUrl(poNumber: string): string {
  return resolveTemplate(
    "EAUTOMATE_PO_GENERATE_PRODUCT_LABELS_URL",
    "/public/api/incoming_purchase_orders/generate_product_labels",
    { poNumber }
  );
}

export function workflowGeneratePhase1BoxLabelsUrl(poNumber: string): string {
  return resolveTemplate(
    "EAUTOMATE_PO_GENERATE_PHASE1_BOX_LABELS_URL",
    "/public/api/incoming_purchase_orders/generate_phase1_box_labels",
    { poNumber }
  );
}

/** POST create consignment for a PO (WIP). */
export function workflowCreateConsignmentUrl(poNumber: string): string {
  return resolveTemplate(
    "EAUTOMATE_CREATE_CONSIGNMENT_URL",
    "/public/api/incoming_purchase_orders/consignments",
    { poNumber }
  );
}

/** GET PO activity logs (sync into outbound_po_logs). */
export function workflowPoLogsUrl(poNumber: string): string {
  return resolveTemplate(
    "EAUTOMATE_PO_LOGS_URL",
    "/public/api/incoming_purchase_orders/{poNumber}/logs",
    { poNumber }
  );
}
