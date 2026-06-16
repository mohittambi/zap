import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import { applyEanMappingsImport } from "@/server/services/eanMappingsImportService";

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
    const approvedRaw = form.get("approvedRowNumbers");
    let approvedRowNumbers: number[] = [];
    if (typeof approvedRaw === "string" && approvedRaw.trim()) {
      try {
        const parsed = JSON.parse(approvedRaw) as unknown;
        if (Array.isArray(parsed)) {
          approvedRowNumbers = parsed
            .map((n) => Number(n))
            .filter((n) => Number.isFinite(n) && n > 0);
        }
      } catch {
        throw new AppError("approvedRowNumbers must be JSON array", 400);
      }
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const result = await applyEanMappingsImport(buf, approvedRowNumbers);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return handleApiError(err);
  }
}
