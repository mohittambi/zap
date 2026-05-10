import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { query } from "@/server/db";
import {
  downloadBufferFromBucket,
  getOutboundBucket,
} from "@/server/zapStorage";

type Ctx = { params: Promise<{ id: string; fileId: string }> };

function safeFilename(name: string | null | undefined): string {
  if (!name || !name.trim()) return "download";
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 200);
}

export async function GET(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const { id: poIdStr, fileId: fileIdStr } = await context.params;
    const poId = Number(poIdStr);
    const fileId = Number(fileIdStr);
    if (!Number.isFinite(poId) || poId < 1 || !Number.isFinite(fileId) || fileId < 1) {
      return NextResponse.json({ error: "Invalid PO or file id" }, { status: 400 });
    }

    const r = await query(
      `SELECT f.file_name, f.zap_storage_path
       FROM outbound_po_eautomate_files f
       WHERE f.eautomate_file_id = $1 AND f.outbound_po_id = $2`,
      [fileId, poId]
    );
    if (r.rows.length === 0) {
      return NextResponse.json({ error: "File not found for this PO" }, { status: 404 });
    }
    const file_name = r.rows[0].file_name as string;
    const zapPath =
      r.rows[0].zap_storage_path != null
        ? String(r.rows[0].zap_storage_path)
        : null;

    if (zapPath) {
      const { buffer, contentType } = await downloadBufferFromBucket(
        getOutboundBucket(),
        zapPath
      );
      const ct =
        contentType?.split(";")[0]?.trim() || "application/octet-stream";
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": ct,
          "Content-Disposition": `attachment; filename="${safeFilename(file_name)}"`,
        },
      });
    }

    /** zap UI never reaches eAutomate. Mirror missing files via the outbound file-sync job. */
    return NextResponse.json(
      {
        error:
          "File is not in Zap Storage. Run the outbound file sync job to mirror eAutomate files.",
      },
      { status: 404 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
