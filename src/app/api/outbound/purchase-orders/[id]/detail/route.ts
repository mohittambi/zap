import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { eautomateConfigured } from "@/server/eautomate-proxy";
import { outboundPoFileDownloadConfigured } from "@/server/eautomate-outbound-po-files";
import { syncOutboundPurchaseOrderDetailFromEautomate } from "@/server/services/eautomateOutboundPoDetailSyncService";
import * as outboundPoService from "@/server/services/outboundPurchaseOrdersService";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Invalid PO id" }, { status: 400 });
    }

    let po = await outboundPoService.getOutboundPurchaseOrderById(id);
    if (!po) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    let syncResult: { ok: boolean; message?: string } = {
      ok: false,
      message: "Skipped",
    };
    if (eautomateConfigured()) {
      syncResult = await syncOutboundPurchaseOrderDetailFromEautomate(po.po_number);
      if (syncResult.ok) {
        po = (await outboundPoService.getOutboundPurchaseOrderById(id)) ?? po;
      }
    } else {
      syncResult = { ok: false, message: "eAutomate not configured on server" };
    }

    const [eautomateFiles, zapAttachments] = await Promise.all([
      outboundPoService.listOutboundPoEautomateFiles(id),
      outboundPoService.listOutboundPoZapAttachments(id),
    ]);

    return NextResponse.json({
      po,
      eautomateFiles,
      zapAttachments,
      sync: syncResult,
      eautomateDownloadConfigured: outboundPoFileDownloadConfigured(),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
