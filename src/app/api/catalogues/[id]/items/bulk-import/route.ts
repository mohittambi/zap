import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as cataloguesService from "@/server/services/cataloguesService";
import { assertBlobSize } from "@/server/lib/uploadGuards";
import {
  buildActivityContext,
  logActivity,
} from "@/server/services/activityLogService";

const MAX_BULK_IMPORT_BYTES = 5 * 1024 * 1024;

/**
 * @swagger
 * /catalogues/{id}/items/bulk-import:
 *   post:
 *     summary: Bulk-import catalogue items
 *     description: Requires catalogues:write.
 *     tags: [Catalogues]
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
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "catalogues", "write");
    const { id } = await context.params;
    const form = await request.formData();
    const file = form.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }
    assertBlobSize(file, MAX_BULK_IMPORT_BYTES);
    const buf = Buffer.from(await file.arrayBuffer());
    const data = await cataloguesService.bulkImportCatalogueItemsFromBuffer(
      Number(id),
      buf
    );
    const ctx = buildActivityContext(request, user.id);
    await logActivity({
      ...ctx,
      action: "catalogue_items_bulk_imported",
      resource: "catalogues",
      resourceId: String(id),
      statusCode: 200,
      details: { imported: data.imported },
    });
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
