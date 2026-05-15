import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import {
  createSignedDownloadUrl,
  getInboundBucket,
  isZapStorageConfigured,
  uploadBufferToBucket,
} from "@/server/zapStorage";
import { getDebitNoteForGrn, uploadCnCopy } from "@/server/services/grnDebitNoteService";

type Ctx = { params: Promise<{ grnId: string }> };

function safeObjectSegment(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 180);
}

export async function GET(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const { grnId } = await context.params;
    const note = await getDebitNoteForGrn(grnId);
    if (!note.cn_copy_file_path) throw new AppError("No CN copy uploaded yet", 404);
    if (!isZapStorageConfigured()) throw new AppError("Storage not configured", 501);
    const url = await createSignedDownloadUrl(getInboundBucket(), note.cn_copy_file_path);
    return NextResponse.json({ url, filename: note.cn_copy_file_name });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "write");
    const { grnId: grnStr } = await context.params;
    const grnId = Number(grnStr);
    if (!Number.isFinite(grnId) || grnId === 0) {
      throw new AppError("Invalid grn id", 400);
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
    const objectPath = `grn-cn-copy/${grnId}/${safeObjectSegment(file.name)}`;
    await uploadBufferToBucket(getInboundBucket(), objectPath, buf, ct);

    const note = await uploadCnCopy(grnId, objectPath, file.name.slice(0, 255), user.email);
    return NextResponse.json(note);
  } catch (err) {
    return handleApiError(err);
  }
}
