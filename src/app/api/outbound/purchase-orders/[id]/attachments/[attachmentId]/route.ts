import path from "path";
import fs from "fs/promises";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { query } from "@/server/db";

type Ctx = { params: Promise<{ id: string; attachmentId: string }> };

function safeFilename(name: string | null | undefined): string {
  if (!name || !name.trim()) return "download";
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 200);
}

export async function GET(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const { id: poIdStr, attachmentId: attStr } = await context.params;
    const poId = Number(poIdStr);
    const attachmentId = Number(attStr);
    if (!Number.isFinite(poId) || poId < 1 || !Number.isFinite(attachmentId) || attachmentId < 1) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const r = await query(
      `SELECT stored_path, original_filename, content_type
       FROM outbound_po_attachments
       WHERE id = $1 AND outbound_po_id = $2`,
      [attachmentId, poId]
    );
    if (r.rows.length === 0) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }
    const stored_path = String(r.rows[0].stored_path);
    const original_filename = String(r.rows[0].original_filename);
    const content_type = r.rows[0].content_type as string | null;

    const abs = path.join(process.cwd(), "uploads", ...stored_path.split("/"));
    const buf = await fs.readFile(abs);

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": content_type || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeFilename(original_filename)}"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
