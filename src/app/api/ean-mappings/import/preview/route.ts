import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import { previewEanMappingsImport } from "@/server/services/eanMappingsImportService";

const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "*", "*");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new AppError("file required", 400);
    }
    if (file.size > MAX_BYTES) {
      throw new AppError("File must be 2MB or less", 400);
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const preview = await previewEanMappingsImport(buf);
    return NextResponse.json(preview);
  } catch (err) {
    return handleApiError(err);
  }
}
