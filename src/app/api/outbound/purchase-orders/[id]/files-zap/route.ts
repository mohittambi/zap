import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as outboundPoService from "@/server/services/outboundPurchaseOrdersService";
import {
  getOutboundBucket,
  isZapStorageConfigured,
  uploadBufferToBucket,
} from "@/server/zapStorage";

type Ctx = { params: Promise<{ id: string }> };

function safeObjectSegment(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 180);
}

/**
 * @swagger
 * /outbound/purchase-orders/{id}/files-zap:
 *   post:
 *     summary: Upload a file to Zap storage and register against an outbound PO
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
 *       400: { description: file required }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function POST(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "write");
    const { id: idStr } = await context.params;
    const poId = Number(idStr);
    if (!Number.isFinite(poId) || poId < 1) {
      return NextResponse.json({ error: "Invalid PO id" }, { status: 400 });
    }

    if (!isZapStorageConfigured()) {
      return NextResponse.json(
        { error: "Zap Storage is not configured (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)" },
        { status: 501 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size < 1) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const objectPath = `outbound-po/${poId}/${Date.now()}-${safeObjectSegment(file.name)}`;
    await uploadBufferToBucket(
      getOutboundBucket(),
      objectPath,
      buf,
      file.type && file.type !== "application/octet-stream"
        ? file.type
        : "application/octet-stream"
    );

    const fid = await outboundPoService.insertOutboundPoZapStoredFile(poId, {
      file_name: file.name,
      zap_storage_path: objectPath,
      uploaded_by: user.email,
    });

    return NextResponse.json({ ok: true, eautomate_file_id: fid });
  } catch (err) {
    return handleApiError(err);
  }
}
