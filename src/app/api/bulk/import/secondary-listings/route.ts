import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as bulkService from "@/server/services/bulkService";
import { assertBlobSize } from "@/server/lib/uploadGuards";

const MAX_BULK_IMPORT_BYTES = 5 * 1024 * 1024;

/**
 * @swagger
 * /bulk/import/secondary-listings:
 *   post:
 *     summary: Import secondary listings CSV/XLSX
 *     description: Requires bulk:import.
 *     tags: [Bulk]
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
export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "bulk", "import");
    const form = await request.formData();
    const file = form.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }
    assertBlobSize(file, MAX_BULK_IMPORT_BYTES);
    const buf = Buffer.from(await file.arrayBuffer());
    const data = await bulkService.importSecondaryListingsFromBuffer(buf);
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
