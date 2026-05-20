import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import {
  downloadBufferFromBucket,
  getInboundBucket,
  isZapStorageConfigured,
} from "@/server/zapStorage";
import { getDebitNoteForGrn } from "@/server/services/grnDebitNoteService";

type Ctx = { params: Promise<{ grnId: string }> };

function safeFilenameSegment(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 180) || "cn-copy";
}

/** Guess Content-Type for CN copy files (PDF / images). */
function contentTypeFromName(name: string | null | undefined): string {
  const n = (name ?? "").toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

/**
 * @swagger
 * /inbound/grns/{grnId}/debit-note/cn-copy/file:
 *   get:
 *     summary: Download CN copy file attached to debit note
 *     description: Requires purchase_orders:read.
 *     tags: [Inbound]
 *     parameters:
 *       - in: path
 *         name: grnId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Binary file }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: No CN copy uploaded yet }
 */
export async function GET(_request: Request, context: Ctx) {
  try {
    const user = await requireAuth(_request);
    assertPermission(user, "purchase_orders", "read");
    const { grnId: grnStr } = await context.params;
    const note = await getDebitNoteForGrn(grnStr);
    if (!note.cn_copy_file_path) {
      throw new AppError("No CN copy uploaded yet", 404);
    }
    if (!isZapStorageConfigured()) {
      throw new AppError("Storage not configured", 501);
    }

    const { buffer, contentType: ctFromStorage } = await downloadBufferFromBucket(
      getInboundBucket(),
      note.cn_copy_file_path
    );
    const fname = safeFilenameSegment(note.cn_copy_file_name ?? "cn-copy");
    const ct =
      (ctFromStorage && ctFromStorage !== "application/octet-stream"
        ? ctFromStorage
        : null) ?? contentTypeFromName(note.cn_copy_file_name);

    const asciiName = /^[\x20-\x7e]+$/.test(fname)
      ? fname
      : "cn-copy" + (fname.includes(".") ? fname.slice(fname.lastIndexOf(".")) : "");

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Content-Disposition": `inline; filename="${asciiName.replace(/"/g, "_")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
