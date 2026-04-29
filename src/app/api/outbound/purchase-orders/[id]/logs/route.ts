import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import {
  eautomateConfigured,
  fetchEautomate,
} from "@/server/eautomate-proxy";
import { workflowPoLogsUrl } from "@/server/eautomate-outbound-po-workflow";
import { getOutboundPurchaseOrderById } from "@/server/services/outboundPurchaseOrdersService";
import {
  listOutboundPoLogs,
  upsertOutboundPoLogsFromEautomate,
} from "@/server/services/outboundPoLogsService";

type Ctx = { params: Promise<{ id: string }> };

function extractRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const k of ["data", "content", "logs", "records", "items", "rows"]) {
      const a = o[k];
      if (Array.isArray(a)) return a as Record<string, unknown>[];
    }
  }
  return [];
}

export async function GET(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Invalid PO id" }, { status: 400 });
    }

    const po = await getOutboundPurchaseOrderById(id);
    if (!po) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    if (eautomateConfigured()) {
      const url = workflowPoLogsUrl(po.po_number);
      try {
        const res = await fetchEautomate(url, {
          cache: "no-store",
          signal: AbortSignal.timeout(120_000),
        });
        if (res.ok) {
          const json: unknown = await res.json();
          const rows = extractRows(json);
          await upsertOutboundPoLogsFromEautomate(id, rows);
        }
      } catch (e) {
        console.warn("[outbound-po-logs] sync failed", e);
      }
    }

    const logs = await listOutboundPoLogs(id);
    return NextResponse.json({ logs });
  } catch (err) {
    return handleApiError(err);
  }
}
