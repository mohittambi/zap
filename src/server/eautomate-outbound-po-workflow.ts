/**
 * eAutomate outbound PO helpers still used for consignment and PO log sync.
 * Paths are overridable via env; defaults match common `/public/api/incoming_purchase_orders/...` patterns.
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
