import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import { query } from "@/server/db";
import {
  getInboundBucket,
  isZapStorageConfigured,
  uploadBufferToBucket,
} from "@/server/zapStorage";

type Ctx = { params: Promise<{ grnId: string }> };

function safeObjectSegment(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 180);
}

export async function POST(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "write");
    const { grnId: grnStr } = await context.params;
    const grnId = Number(grnStr);
    if (!Number.isFinite(grnId) || grnId === 0) {
      return NextResponse.json({ message: "Invalid grn id" }, { status: 400 });
    }

    if (!isZapStorageConfigured()) {
      return NextResponse.json(
        {
          message:
            "Zap Storage is not configured (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)",
        },
        { status: 501 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const kind = formData.get("kind");
    if (!(file instanceof File) || file.size < 1) {
      throw new AppError("file is required", 400);
    }
    if (kind !== "invoice" && kind !== "debit_note") {
      throw new AppError("kind must be invoice or debit_note", 400);
    }

    const g = await query(
      `SELECT grn_id, po_id, vendor_id FROM inbound_grns WHERE grn_id = $1`,
      [grnId]
    );
    if (g.rows.length === 0) throw new AppError("GRN not found", 404);

    const buf = Buffer.from(await file.arrayBuffer());
    const ct =
      file.type && file.type !== "" ? file.type : "application/octet-stream";

    if (kind === "invoice") {
      const negR = await query(
        `SELECT COALESCE(MIN(file_id), 0) - 1 AS next_id
         FROM inbound_grn_invoice_files
         WHERE grn_id = $1 AND file_id < 0`,
        [grnId]
      );
      const fileId = Number(negR.rows[0].next_id);
      const objectPath = `grn-invoice/${grnId}/${fileId}-${safeObjectSegment(file.name)}`;
      await uploadBufferToBucket(getInboundBucket(), objectPath, buf, ct);

      await query(
        `INSERT INTO inbound_grn_invoice_files (
          grn_id, file_id, file_type, file_name, uploaded_at, uploaded_by, zap_storage_path, raw
        ) VALUES ($1, $2, $3, $4, NOW(), $5, $6, '{}'::jsonb)`,
        [
          grnId,
          fileId,
          "zap_upload",
          file.name.slice(0, 500),
          user.email,
          objectPath,
        ]
      );
      return NextResponse.json({ ok: true, kind: "invoice", file_id: fileId });
    }

    const noteIdRaw = formData.get("noteId");
    const noteId =
      noteIdRaw != null && String(noteIdRaw).trim() !== ""
        ? Number(noteIdRaw)
        : -1;
    if (!Number.isFinite(noteId)) {
      throw new AppError("noteId must be a number when kind is debit_note", 400);
    }

    await query(
      `INSERT INTO inbound_grn_debit_credit_notes (grn_id, note_id, po_id, vendor_id, raw)
       SELECT $1, $2::bigint, g.po_id, g.vendor_id, '{}'::jsonb
       FROM inbound_grns g WHERE g.grn_id = $1
       ON CONFLICT (grn_id, note_id) DO NOTHING`,
      [grnId, noteId]
    );

    const negF = await query(
      `SELECT COALESCE(MIN(file_id), 0) - 1 AS next_id
       FROM inbound_grn_debit_credit_note_files
       WHERE grn_id = $1 AND note_id = $2 AND file_id < 0`,
      [grnId, noteId]
    );
    const fileId = Number(negF.rows[0].next_id);
    const objectPath = `grn-dcn/${grnId}/${noteId}/${fileId}-${safeObjectSegment(file.name)}`;
    await uploadBufferToBucket(getInboundBucket(), objectPath, buf, ct);

    await query(
      `INSERT INTO inbound_grn_debit_credit_note_files (
        grn_id, note_id, file_id, file_type, file_name, uploaded_at, uploaded_by, zap_storage_path, raw
      ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, '{}'::jsonb)`,
      [
        grnId,
        noteId,
        fileId,
        "zap_upload",
        file.name.slice(0, 500),
        user.email,
        objectPath,
      ]
    );

    return NextResponse.json({
      ok: true,
      kind: "debit_note",
      note_id: noteId,
      file_id: fileId,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
