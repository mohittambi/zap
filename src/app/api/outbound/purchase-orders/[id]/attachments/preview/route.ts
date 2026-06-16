import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import { getOutboundPurchaseOrderById } from "@/server/services/outboundPurchaseOrdersService";
import {
  getOutboundPoAttachmentById,
  previewSpreadsheetBufferForPo,
} from "@/server/services/outboundPoSpreadsheetIngestService";
import { downloadBufferFromBucket, getOutboundBucket } from "@/server/zapStorage";

const MAX_BYTES = 2 * 1024 * 1024;

type Ctx = { params: Promise<{ id: string }> };

function isSpreadsheetName(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.endsWith(".csv") ||
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls")
  );
}

async function bufferFromRequest(
  request: Request,
  poId: number
): Promise<{ buf: Buffer; filename: string }> {
  const contentType = (request.headers.get("content-type") || "").toLowerCase();

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as { attachmentId?: unknown };
    const attachmentId = Number(body.attachmentId);
    if (!Number.isFinite(attachmentId) || attachmentId < 1) {
      throw new AppError("attachmentId required", 400);
    }
    const att = await getOutboundPoAttachmentById(poId, attachmentId);
    if (!att) throw new AppError("Attachment not found", 404);
    if (att.kind !== "spreadsheet" && !isSpreadsheetName(att.original_filename)) {
      throw new AppError("Attachment is not a spreadsheet", 400);
    }
    const { buffer } = await downloadBufferFromBucket(
      getOutboundBucket(),
      att.stored_path
    );
    return { buf: buffer, filename: att.original_filename };
  }

  const form = await request.formData();
  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) {
      throw new AppError("File must be 2MB or less", 400);
    }
    return {
      buf: Buffer.from(await file.arrayBuffer()),
      filename: file.name,
    };
  }

  const attachmentId = Number(form.get("attachmentId"));
  if (Number.isFinite(attachmentId) && attachmentId > 0) {
    const att = await getOutboundPoAttachmentById(poId, attachmentId);
    if (!att) throw new AppError("Attachment not found", 404);
    const { buffer } = await downloadBufferFromBucket(
      getOutboundBucket(),
      att.stored_path
    );
    return { buf: buffer, filename: att.original_filename };
  }

  throw new AppError("file or attachmentId required", 400);
}

export async function POST(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "create");
    const { id: idStr } = await context.params;
    const poId = Number(idStr);
    if (!Number.isFinite(poId) || poId < 1) {
      return NextResponse.json({ error: "Invalid PO id" }, { status: 400 });
    }
    const po = await getOutboundPurchaseOrderById(poId);
    if (!po) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    const { buf, filename } = await bufferFromRequest(request, poId);
    if (!isSpreadsheetName(filename)) {
      throw new AppError("Only CSV or Excel spreadsheets can be previewed", 400);
    }

    const preview = await previewSpreadsheetBufferForPo(poId, buf, filename);
    return NextResponse.json(preview);
  } catch (err) {
    return handleApiError(err);
  }
}
