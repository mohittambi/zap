import path from "path";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import * as outboundPoService from "@/server/services/outboundPurchaseOrdersService";
import { uploadBufferToBucket, getOutboundBucket } from "@/server/zapStorage";

const MAX_BYTES = 2 * 1024 * 1024;

type Ctx = { params: Promise<{ id: string }> };

function safeFilename(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
  return (base || "file").slice(0, 180);
}

function classifyPoUpload(file: File): "pdf" | "spreadsheet" | "other" {
  const lower = file.name.toLowerCase();
  const mt = (file.type || "").toLowerCase();
  if (lower.endsWith(".pdf") || mt.includes("pdf")) return "pdf";
  if (
    lower.endsWith(".csv") ||
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    mt.includes("spreadsheet") ||
    mt.includes("csv") ||
    mt.includes("excel") ||
    mt.includes("sheet")
  ) {
    return "spreadsheet";
  }
  return "other";
}

/**
 * @swagger
 * /outbound/purchase-orders/{id}/attachments:
 *   post:
 *     summary: Upload outbound PO attachment (PDF/CSV/XLSX, max 2MB)
 *     description: Requires purchase_orders:create.
 *     tags: [Outbound]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Bad request }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Purchase order not found }
 */
export async function POST(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "create");
    const { id: idStr } = await context.params;
    const poId = Number(idStr);
    if (!Number.isFinite(poId) || poId < 1) {
      return NextResponse.json({ error: "Invalid PO id" }, { status: 400 });
    }

    const po = await outboundPoService.getOutboundPurchaseOrderById(poId);
    if (!po) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new AppError("Choose a file to upload", 400);
    }
    if (file.size > MAX_BYTES) {
      throw new AppError("File must be 2MB or less", 400);
    }
    if (classifyPoUpload(file) === "other") {
      throw new AppError("Use PDF or Excel/CSV", 400);
    }

    const kind = classifyPoUpload(file);
    const buf = Buffer.from(await file.arrayBuffer());
    const fname = safeFilename(file.name);
    const objectPath = path.posix.join("outbound-po", String(poId), fname);
    await uploadBufferToBucket(getOutboundBucket(), objectPath, buf, file.type || "application/octet-stream");

    await outboundPoService.insertOutboundPoAttachment({
      outbound_po_id: poId,
      original_filename: file.name,
      content_type: file.type || null,
      size_bytes: buf.length,
      stored_path: objectPath,
      kind,
    });

    let listingsUpdated = false;
    let rowsParsed = 0;
    let rowsRepaired = 0;
    let stillMisaligned = 0;
    if (kind === "spreadsheet") {
      try {
        const result = await outboundPoService.applySpreadsheetToOutboundPo(
          poId,
          buf,
          fname
        );
        listingsUpdated = result.listingsUpdated;
        rowsParsed = result.rowsParsed;
        rowsRepaired = result.rowsRepaired;
        stillMisaligned = result.stillMisaligned;
      } catch {
        listingsUpdated = false;
        rowsParsed = 0;
      }
    }

    return NextResponse.json({
      ok: true,
      listingsUpdated,
      parseResult:
        kind === "spreadsheet"
          ? { rowsParsed, rowsRepaired, stillMisaligned }
          : undefined,
      parseWarning:
        kind === "spreadsheet" && stillMisaligned > 0
          ? `${stillMisaligned} line(s) may still have misaligned commercial columns after repair. Prefer XLSX upload or review line items.`
          : undefined,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
