import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import {
  getOutboundBucket,
  isZapStorageConfigured,
  uploadBufferToBucket,
} from "@/server/zapStorage";
import { attachConsignmentInvoice } from "@/server/services/outboundConsignmentsService";

type Ctx = { params: Promise<{ id: string }> };

function safeObjectSegment(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 180);
}

/**
 * @swagger
 * /outbound/consignments/{id}/invoice-upload:
 *   post:
 *     summary: Upload consignment invoice file
 *     description: Requires purchase_orders:write.
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
 */
export async function POST(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "write");
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (!Number.isFinite(id) || id < 1) {
      throw new AppError("Invalid consignment id", 400);
    }

    if (!isZapStorageConfigured()) {
      return NextResponse.json(
        { message: "Zap Storage is not configured" },
        { status: 501 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size < 1) {
      throw new AppError("file is required", 400);
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const ct = file.type && file.type !== "" ? file.type : "application/octet-stream";
    const objectPath = `outbound/consignments/${id}/invoice/${safeObjectSegment(file.name)}`;
    await uploadBufferToBucket(getOutboundBucket(), objectPath, buf, ct);

    await attachConsignmentInvoice(id, objectPath, file.name.slice(0, 255), user.email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
