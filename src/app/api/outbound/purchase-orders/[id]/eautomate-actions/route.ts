import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import {
  eautomateConfigured,
  fetchEautomate,
} from "@/server/eautomate-proxy";
import {
  poWorkflowJsonBody,
  workflowAcknowledgeUrl,
  workflowCancelUrl,
  workflowDownloadPendencyPdfUrl,
  workflowGeneratePhase1BoxLabelsUrl,
  workflowGenerateProductLabelsUrl,
} from "@/server/eautomate-outbound-po-workflow";
import { syncOutboundPurchaseOrderDetailFromEautomate } from "@/server/services/eautomateOutboundPoDetailSyncService";
import { upsertOutboundConsignmentFromEautomate } from "@/server/services/outboundConsignmentsService";
import {
  patchOutboundPurchaseOrderField,
  type OutboundPoEditableField,
} from "@/server/services/outboundPurchaseOrdersService";
import * as outboundPoService from "@/server/services/outboundPurchaseOrdersService";

type Ctx = { params: Promise<{ id: string }> };

const ALLOWED_ACTIONS = new Set([
  "acknowledge",
  "cancel",
  "download_sku_report",
  "download_pendency_pdf",
  "generate_product_labels",
  "generate_phase1_box_labels",
  "save_field",
]);

const EDITABLE_FIELDS = new Set<OutboundPoEditableField>([
  "po_type",
  "delivery_city",
  "delivery_address",
  "billing_address",
  "expiry_date",
  "remarks",
]);

function safeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 200);
}

function upstreamFailurePayload(
  upstream: Response,
  detail: string,
  action: string,
  upstreamUrl: string,
  extraHint?: string
): Record<string, unknown> {
  const st = upstream.status;
  const hint404 =
    "Confirm the path in eCraft Network tab and set the matching EAUTOMATE_PO_*_URL env (see eautomate-outbound-po-workflow.ts).";
  const hint401 =
    "Upstream rejected auth. Set EAUTOMATE_COOKIE or EAUTOMATE_BEARER_TOKEN (or EAUTOMATE_LOGIN_USER_ID + EAUTOMATE_LOGIN_PASSWORD for refresh).";
  let hint = extraHint;
  if (!hint) {
    if (st === 404) hint = hint404;
    else if (st === 401 || st === 403) hint = hint401;
  }
  return {
    error: `Upstream ${st}`,
    upstream_status: st,
    upstream_url: upstreamUrl,
    detail: detail.slice(0, 800),
    action,
    ...(hint ? { hint } : {}),
  };
}

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

export async function POST(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "create");
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Invalid PO id" }, { status: 400 });
    }

    const po = await outboundPoService.getOutboundPurchaseOrderById(id);
    if (!po) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const action = String(body.action ?? "").trim();
    if (!action || !ALLOWED_ACTIONS.has(action)) {
      return NextResponse.json(
        { error: "Unknown or missing action", allowed: [...ALLOWED_ACTIONS] },
        { status: 400 }
      );
    }

    if (action === "save_field") {
      const field = String(body.field ?? "").trim() as OutboundPoEditableField;
      if (!field || !EDITABLE_FIELDS.has(field)) {
        return NextResponse.json(
          { error: "save_field requires a valid field", allowed: [...EDITABLE_FIELDS] },
          { status: 400 }
        );
      }
      const rawVal = body.value;
      const value =
        rawVal == null
          ? null
          : typeof rawVal === "string"
            ? rawVal
            : String(rawVal);
      await patchOutboundPurchaseOrderField(id, field, value);
      if (eautomateConfigured()) {
        await syncOutboundPurchaseOrderDetailFromEautomate(po.po_number).catch(
          () => undefined
        );
      }
      return NextResponse.json({ ok: true });
    }

    /** SKU report = CSV from `outbound_purchase_orders.listings_snapshot` (no eAutomate download URL). */
    if (action === "download_sku_report") {
      const pn = po.po_number;
      if (eautomateConfigured()) {
        await syncOutboundPurchaseOrderDetailFromEautomate(pn).catch(() => undefined);
      }
      const fresh =
        (await outboundPoService.getOutboundPurchaseOrderById(id)) ?? po;
      const csv = outboundPoService.outboundPoListingsSnapshotToCsv(
        fresh.listings_snapshot
      );
      const fname = `sku-report-${safeFilename(pn)}.csv`;
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${fname}"`,
        },
      });
    }

    if (!eautomateConfigured()) {
      return NextResponse.json(
        {
          error: "eAutomate is not configured",
          message: "Set EAUTOMATE_COOKIE or EAUTOMATE_BEARER_TOKEN on the server.",
        },
        { status: 503 }
      );
    }

    const pn = po.po_number;
    const jsonBody = JSON.stringify(poWorkflowJsonBody(po.id, pn));
    const optJson = {
      method: "POST" as const,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: jsonBody,
      cache: "no-store" as const,
      signal: AbortSignal.timeout(120_000),
    };

    if (action === "download_pendency_pdf") {
      const url = workflowDownloadPendencyPdfUrl(pn);
      const upstream = await fetchEautomate(url, {
        method: "GET",
        headers: { Accept: "*/*" },
        cache: "no-store",
        signal: AbortSignal.timeout(120_000),
      });
      if (!upstream.ok) {
        const t = await upstream.text().catch(() => "");
        console.warn(
          "[eautomate-actions] download upstream failed",
          action,
          upstream.status,
          url
        );
        return NextResponse.json(
          upstreamFailurePayload(
            upstream,
            t,
            action,
            url,
            "Set EAUTOMATE_PO_DOWNLOAD_PENDENCY_PDF_URL if the path differs."
          ),
          { status: 502 }
        );
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      const ct =
        upstream.headers.get("content-type") ?? "application/octet-stream";
      const ext = ct.includes("pdf") ? "pdf" : "bin";
      const fname = `pendency-${safeFilename(pn)}.${ext}`;
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "Content-Type": ct.split(";")[0]?.trim() ?? ct,
          "Content-Disposition": `attachment; filename="${fname}"`,
        },
      });
    }

    let url = "";
    if (action === "acknowledge") url = workflowAcknowledgeUrl(pn);
    else if (action === "cancel") url = workflowCancelUrl(pn);
    else if (action === "generate_product_labels") {
      url = workflowGenerateProductLabelsUrl(pn);
    } else if (action === "generate_phase1_box_labels") {
      url = workflowGeneratePhase1BoxLabelsUrl(pn);
    }

    const upstream = await fetchEautomate(url, optJson);
    const text = await upstream.text().catch(() => "");
    if (!upstream.ok) {
      console.warn(
        "[eautomate-actions] POST upstream failed",
        action,
        upstream.status,
        url
      );
      return NextResponse.json(
        upstreamFailurePayload(upstream, text, action, url),
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
      await upsertOutboundConsignmentFromEautomate(cons).catch(() => undefined);
    }

    try {
      await syncOutboundPurchaseOrderDetailFromEautomate(pn);
    } catch (syncErr) {
      console.error("[eautomate-actions] sync after action failed", syncErr);
    }

    return NextResponse.json({
      ok: true,
      action,
      upstream_preview: typeof parsed === "object" ? parsed : undefined,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
