import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { parsePagination } from "@/server/validators/pagination";
import {
  getOutboundPurchaseOrderById,
} from "@/server/services/outboundPurchaseOrdersService";
import {
  listOutboundConsignments,
  upsertOutboundConsignmentFromEautomate,
} from "@/server/services/outboundConsignmentsService";
import {
  eautomateConfigured,
  fetchEautomate,
} from "@/server/eautomate-proxy";
import {
  poWorkflowJsonBody,
  workflowCreateConsignmentUrl,
} from "@/server/eautomate-outbound-po-workflow";

type Ctx = { params: Promise<{ id: string }> };

function unwrapConsignmentPayload(
  json: unknown
): Record<string, unknown> | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const o = json as Record<string, unknown>;
  for (const k of ["consignment", "data", "payload", "result"]) {
    const v = o[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return v as Record<string, unknown>;
    }
  }
  return o;
}

/** Consignments for one outbound PO — filters `outbound_consignments` by `po_number`. */
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

    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const { page, limit } = parsePagination(q, {
      page: 1,
      limit: 50,
      maxLimit: 200,
    });
    const search = typeof q.search === "string" ? q.search : undefined;
    const sortBy = typeof q.sort === "string" ? q.sort : undefined;
    const sortDir = q.dir === "asc" ? "asc" : "desc";

    const data = await listOutboundConsignments({
      page,
      limit,
      poNumber: po.po_number,
      search,
      sortBy,
      sortDir,
    });

    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}

/** Create consignment in eAutomate (PO must be WIP); upserts into `outbound_consignments`. */
export async function POST(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "create");
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Invalid PO id" }, { status: 400 });
    }

    const po = await getOutboundPurchaseOrderById(id);
    if (!po) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    const wip = (po.is_wip ?? "").toUpperCase().trim();
    if (wip !== "YES") {
      return NextResponse.json(
        {
          error:
            "PO must be marked WIP before creating a consignment.",
        },
        { status: 400 }
      );
    }

    if (!eautomateConfigured()) {
      return NextResponse.json(
        {
          error:
            "eAutomate is not configured. Cannot create consignment upstream.",
        },
        { status: 503 }
      );
    }

    const url = workflowCreateConsignmentUrl(po.po_number);
    const upstream = await fetchEautomate(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(poWorkflowJsonBody(po.id, po.po_number)),
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    });

    const text = await upstream.text().catch(() => "");
    if (!upstream.ok) {
      return NextResponse.json(
        {
          error: `Upstream ${upstream.status}`,
          detail: text.slice(0, 400),
          hint: "Override URL with EAUTOMATE_CREATE_CONSIGNMENT_URL if needed.",
        },
        { status: 502 }
      );
    }

    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }

    const cons = unwrapConsignmentPayload(parsed);
    if (cons) {
      await upsertOutboundConsignmentFromEautomate(cons);
    }

    /** PO detail is not re-synced inline; run `npm run sync:outbound-po-detail` to refresh. */
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
