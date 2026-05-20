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
import { appendInboundGrnLogSafe } from "@/server/services/inboundGrnLogService";

type Ctx = { params: Promise<{ grnId: string }> };

function safeObjectSegment(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 180);
}

const MAX_VENDOR_INVOICE_BYTES = 4 * 1024 * 1024;

/** Zap-close workflow: vendor invoice is JPG / JPEG / PDF only, max 4MB. */
function assertVendorInvoiceFileAllowed(file: File) {
  if (file.size > MAX_VENDOR_INVOICE_BYTES) {
    throw new AppError("Vendor invoice must be 4MB or smaller", 400);
  }
  const name = file.name.toLowerCase();
  const ext = name.match(/\.([^.]+)$/)?.[1] ?? "";
  const extOk = ext === "jpg" || ext === "jpeg" || ext === "pdf";
  if (!extOk) {
    throw new AppError("Vendor invoice must be .jpg, .jpeg, or .pdf", 400);
  }
  const mt = (file.type || "").toLowerCase();
  if (mt === "") {
    return;
  }
  const mimeOk =
    mt === "image/jpeg" ||
    mt === "application/pdf" ||
    mt === "image/jpg" ||
    mt === "image/pjpeg";
  if (!mimeOk) {
    throw new AppError("Vendor invoice must be JPG, JPEG, or PDF", 400);
  }
}

/**
 * @swagger
 * /inbound/grns/{grnId}/upload-zap:
 *   post:
 *     summary: Upload GRN invoice or debit-note file to Zap storage
 *     description: Requires purchase_orders:write.
 *     tags: [Inbound]
 *     parameters:
 *       - in: path
 *         name: grnId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, kind]
 *             properties:
 *               file: { type: string, format: binary }
 *               kind: { type: string, enum: [invoice, debit_note] }
 *               noteId: { type: integer }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Bad request }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: GRN not found }
 */
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
    let ct =
      file.type && file.type !== "" ? file.type : "application/octet-stream";

    if (kind === "invoice") {
      assertVendorInvoiceFileAllowed(file);
      const nameLower = file.name.toLowerCase();
      if (nameLower.endsWith(".pdf")) {
        ct = "application/pdf";
      } else if (
        nameLower.endsWith(".jpg") ||
        nameLower.endsWith(".jpeg")
      ) {
        ct = "image/jpeg";
      }
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
      await appendInboundGrnLogSafe({
        grnId,
        logType: "DOCUMENT",
        operationPerformed: "Vendor invoice uploaded (Zap)",
        remarks: file.name.slice(0, 500),
        poId: Number(g.rows[0].po_id) || null,
        vendorId: Number(g.rows[0].vendor_id) || null,
        createdBy: user.email,
        raw: { kind: "invoice", file_id: fileId },
      });
      return NextResponse.json({ ok: true, kind: "invoice", file_id: fileId });
    }

    const noteIdRaw = formData.get("noteId");
    const noteIdText =
      typeof noteIdRaw === "string"
        ? noteIdRaw.trim()
        : noteIdRaw instanceof File
          ? ""
          : "";
    let noteId = noteIdText !== "" ? Number(noteIdText) : -1;
    if (!Number.isFinite(noteId)) {
      throw new AppError("noteId must be a number when kind is debit_note", 400);
    }
    if (noteId < 0) {
      // Fallback to latest known debit/credit note for this GRN.
      const existingNote = await query(
        `SELECT note_id
         FROM inbound_grn_debit_credit_notes
         WHERE grn_id = $1
         ORDER BY updated_at DESC NULLS LAST, note_id DESC
         LIMIT 1`,
        [grnId]
      );
      if (existingNote.rows.length > 0) {
        noteId = Number(existingNote.rows[0].note_id);
      }
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

    await query(
      `UPDATE inbound_grn_debit_credit_notes
       SET credit_debit_note_upload_status = 'UPLOADED',
           credit_debit_note_uploaded_by = $1,
           updated_at = NOW()
       WHERE grn_id = $2 AND note_id = $3`,
      [user.email, grnId, noteId]
    );

    await appendInboundGrnLogSafe({
      grnId,
      logType: "DOCUMENT",
      operationPerformed: "Debit/credit note file uploaded (Zap)",
      remarks: file.name.slice(0, 500),
      poId: Number(g.rows[0].po_id) || null,
      vendorId: Number(g.rows[0].vendor_id) || null,
      createdBy: user.email,
      raw: { kind: "debit_note", note_id: noteId, file_id: fileId },
    });

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
