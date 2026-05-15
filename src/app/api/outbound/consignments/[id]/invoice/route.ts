import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import {
  createSignedDownloadUrl,
  getOutboundBucket,
  isZapStorageConfigured,
} from "@/server/zapStorage";
import { getOutboundConsignmentById } from "@/server/services/outboundConsignmentsService";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (!Number.isFinite(id) || id < 1) throw new AppError("Invalid consignment id", 400);

    const row = await getOutboundConsignmentById(id);
    if (!row) throw new AppError("Consignment not found", 404);
    if (!row.invoice_file_path) throw new AppError("No invoice uploaded yet", 404);
    if (!isZapStorageConfigured()) throw new AppError("Storage not configured", 501);

    const url = await createSignedDownloadUrl(getOutboundBucket(), row.invoice_file_path);
    return NextResponse.json({ url, filename: row.invoice_file_name });
  } catch (err) {
    return handleApiError(err);
  }
}
