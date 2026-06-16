import path from "path";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import {
  getOutboundPurchaseOrderById,
  insertOutboundPoAttachment,
} from "@/server/services/outboundPurchaseOrdersService";
import {
  applySpreadsheetBufferToOutboundPo,
  getOutboundPoAttachmentById,
} from "@/server/services/outboundPoSpreadsheetIngestService";
import { downloadBufferFromBucket, getOutboundBucket, uploadBufferToBucket } from "@/server/zapStorage";

const MAX_BYTES = 2 * 1024 * 1024;

type Ctx = { params: Promise<{ id: string }> };

function safeFilename(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
  return (base || "file").slice(0, 180);
}

function isSpreadsheetName(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.endsWith(".csv") ||
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls")
  );
}

function parseConfirmReplace(v: FormDataEntryValue | null | undefined): boolean {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
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

    const form = await request.formData();
    const confirmReplace = parseConfirmReplace(form.get("confirmReplace"));
    let attachmentId = Number(form.get("attachmentId"));
    let buf: Buffer;
    let filename: string;
    let storedAttachmentId: number | null = null;

    const file = form.get("file");
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_BYTES) {
        throw new AppError("File must be 2MB or less", 400);
      }
      if (!isSpreadsheetName(file.name)) {
        throw new AppError("Only CSV or Excel spreadsheets can be applied", 400);
      }
      buf = Buffer.from(await file.arrayBuffer());
      filename = file.name;
      const fname = safeFilename(file.name);
      const objectPath = path.posix.join("outbound-po", String(poId), fname);
      await uploadBufferToBucket(
        getOutboundBucket(),
        objectPath,
        buf,
        file.type || "application/octet-stream"
      );
      storedAttachmentId = await insertOutboundPoAttachment({
        outbound_po_id: poId,
        original_filename: file.name,
        content_type: file.type || null,
        size_bytes: buf.length,
        stored_path: objectPath,
        kind: "spreadsheet",
      });
    } else if (Number.isFinite(attachmentId) && attachmentId > 0) {
      const att = await getOutboundPoAttachmentById(poId, attachmentId);
      if (!att) throw new AppError("Attachment not found", 404);
      const { buffer } = await downloadBufferFromBucket(
        getOutboundBucket(),
        att.stored_path
      );
      buf = buffer;
      filename = att.original_filename;
      storedAttachmentId = att.id;
    } else {
      throw new AppError("file or attachmentId required", 400);
    }

    const result = await applySpreadsheetBufferToOutboundPo(poId, buf, filename, {
      confirmReplace,
      sourceAttachmentId: storedAttachmentId,
    });

    return NextResponse.json({
      ok: true,
      attachmentId: storedAttachmentId,
      listingsUpdated: result.listingsUpdated,
      previousRowCount: result.previousRowCount,
      newRowCount: result.newRowCount,
      parseResult: {
        rowsParsed: result.rowsParsed,
        rowsRepaired: result.rowsRepaired,
        stillMisaligned: result.stillMisaligned,
      },
      parseWarning:
        result.stillMisaligned > 0
          ? `${result.stillMisaligned} line(s) may still have misaligned commercial columns after repair.`
          : undefined,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
