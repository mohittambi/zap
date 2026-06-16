import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import { getOutboundPurchaseOrderById } from "@/server/services/outboundPurchaseOrdersService";
import {
  applySpreadsheetBufferToOutboundPo,
  getOutboundPoAttachmentById,
  previewSpreadsheetBufferForPo,
} from "@/server/services/outboundPoSpreadsheetIngestService";
import { downloadBufferFromBucket, getOutboundBucket } from "@/server/zapStorage";

type Ctx = { params: Promise<{ id: string; attachmentId: string }> };

function parseConfirmReplace(body: Record<string, unknown>): boolean {
  return body.confirmReplace === true || body.confirmReplace === "true";
}

export async function POST(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "create");
    const { id: poIdStr, attachmentId: attStr } = await context.params;
    const poId = Number(poIdStr);
    const attachmentId = Number(attStr);
    if (
      !Number.isFinite(poId) ||
      poId < 1 ||
      !Number.isFinite(attachmentId) ||
      attachmentId < 1
    ) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const po = await getOutboundPurchaseOrderById(poId);
    if (!po) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    const att = await getOutboundPoAttachmentById(poId, attachmentId);
    if (!att) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    const { buffer } = await downloadBufferFromBucket(
      getOutboundBucket(),
      att.stored_path
    );

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const previewOnly = body.previewOnly === true;

    if (previewOnly) {
      const preview = await previewSpreadsheetBufferForPo(
        poId,
        buffer,
        att.original_filename
      );
      return NextResponse.json({ ...preview, attachmentId });
    }

    const confirmReplace = parseConfirmReplace(body);
    const result = await applySpreadsheetBufferToOutboundPo(
      poId,
      buffer,
      att.original_filename,
      { confirmReplace, sourceAttachmentId: attachmentId }
    );

    return NextResponse.json({
      ok: true,
      attachmentId,
      listingsUpdated: result.listingsUpdated,
      previousRowCount: result.previousRowCount,
      newRowCount: result.newRowCount,
      parseResult: {
        rowsParsed: result.rowsParsed,
        rowsRepaired: result.rowsRepaired,
        stillMisaligned: result.stillMisaligned,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
