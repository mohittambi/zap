import { query } from "@/server/db";
import { AppError } from "@/server/errors";

function str(v: unknown, maxLen?: number): string {
  if (v == null || v === "") return "";
  const s = String(v).trim();
  return maxLen ? s.slice(0, maxLen) : s;
}

/** Pending rows from sync; Zap-local updates live on inbound_grn_debit_credit_notes — merge with COALESCE. */
const listSelect = `
  SELECT
    p.note_id,
    p.grn_id,
    COALESCE(c.credit_debit_note_type, p.credit_debit_note_type) AS credit_debit_note_type,
    COALESCE(c.credit_debit_note_status, p.credit_debit_note_status) AS credit_debit_note_status,
    COALESCE(c.credit_debit_note_number, p.credit_debit_note_number) AS credit_debit_note_number,
    COALESCE(c.credit_debit_note_number_assignment_status, p.credit_debit_note_number_assignment_status)
      AS credit_debit_note_number_assignment_status,
    COALESCE(c.credit_debit_note_upload_status, p.credit_debit_note_upload_status) AS credit_debit_note_upload_status,
    COALESCE(c.credit_debit_note_uploaded_by, p.credit_debit_note_uploaded_by) AS credit_debit_note_uploaded_by,
    COALESCE(c.reverse_credit_debit_note_number, p.reverse_credit_debit_note_number) AS reverse_credit_debit_note_number,
    COALESCE(c.reverse_credit_debit_note_upload_status, p.reverse_credit_debit_note_upload_status)
      AS reverse_credit_debit_note_upload_status,
    COALESCE(c.reverse_credit_debit_note_uploaded_by, p.reverse_credit_debit_note_uploaded_by)
      AS reverse_credit_debit_note_uploaded_by,
    COALESCE(c.created_by, p.created_by) AS created_by,
    COALESCE(c.created_at, p.created_at) AS created_at,
    COALESCE(c.updated_at, p.updated_at) AS updated_at,
    p.po_id,
    p.grn_status,
    p.grn_audit_status,
    p.grn_audit_by,
    p.vendor_invoice_number,
    p.box_count_invoice,
    p.actual_box_count_recieved,
    p.vendor_id,
    p.vendor_name,
    p.raw,
    p.synced_at`;

const listFrom = `
  FROM inbound_pending_debit_credit_notes p
  LEFT JOIN inbound_grn_debit_credit_notes c ON c.grn_id = p.grn_id AND c.note_id = p.note_id`;

const effNoteStatus =
  "COALESCE(c.credit_debit_note_status, p.credit_debit_note_status)";
const effUploadStatus =
  "COALESCE(c.credit_debit_note_upload_status, p.credit_debit_note_upload_status)";

function rowToItem(r: Record<string, unknown>) {
  return {
    note_id: Number(r.note_id),
    grn_id: Number(r.grn_id),
    credit_debit_note_type: r.credit_debit_note_type ?? null,
    credit_debit_note_status: r.credit_debit_note_status ?? null,
    credit_debit_note_number: r.credit_debit_note_number ?? null,
    credit_debit_note_number_assignment_status:
      r.credit_debit_note_number_assignment_status ?? null,
    credit_debit_note_upload_status: r.credit_debit_note_upload_status ?? null,
    credit_debit_note_uploaded_by: r.credit_debit_note_uploaded_by ?? null,
    reverse_credit_debit_note_number: r.reverse_credit_debit_note_number ?? null,
    reverse_credit_debit_note_upload_status: r.reverse_credit_debit_note_upload_status ?? null,
    reverse_credit_debit_note_uploaded_by: r.reverse_credit_debit_note_uploaded_by ?? null,
    created_by: r.created_by ?? null,
    created_at: r.created_at
      ? new Date(r.created_at as string).toISOString().replace(/\.\d{3}Z$/, ".000000Z")
      : null,
    updated_at: r.updated_at
      ? new Date(r.updated_at as string).toISOString().replace(/\.\d{3}Z$/, ".000000Z")
      : null,
    po_id: r.po_id != null ? Number(r.po_id) : null,
    grn_status: r.grn_status ?? null,
    grn_audit_status: r.grn_audit_status ?? null,
    grn_audit_by: r.grn_audit_by ?? null,
    vendor_invoice_number: r.vendor_invoice_number ?? null,
    box_count_invoice: r.box_count_invoice != null ? Number(r.box_count_invoice) : null,
    actual_box_count_recieved:
      r.actual_box_count_recieved != null ? Number(r.actual_box_count_recieved) : null,
    vendor_id: r.vendor_id != null ? Number(r.vendor_id) : null,
    vendor_name: r.vendor_name ?? null,
    raw: (r.raw && typeof r.raw === "object" ? r.raw : {}) as Record<string, unknown>,
    synced_at: r.synced_at
      ? new Date(r.synced_at as string).toISOString().replace(/\.\d{3}Z$/, ".000000Z")
      : null,
  };
}

/**
 * Paginated list: base rows from eAutomate sync (`inbound_pending_debit_credit_notes`),
 * merged with Zap-local state on `inbound_grn_debit_credit_notes` (upload / accept / decline).
 */
export async function listPendingDebitCreditNotesPaginated(opts: {
  page?: string | number;
  count?: string | number;
  searchKeyword?: string;
  vendorId?: string | number | null;
}) {
  const page = Math.max(1, Number(opts.page) || 1);
  const perPage = Math.min(200, Math.max(1, Number(opts.count) || 100));
  const offset = (page - 1) * perPage;
  const kw = str(opts.searchKeyword);

  let vendorFilter: number | null = null;
  if (opts.vendorId != null && opts.vendorId !== "") {
    const v = Number(opts.vendorId);
    if (!Number.isFinite(v) || v < 1) {
      throw new AppError("Invalid vendor_id", 400);
    }
    vendorFilter = v;
    const vCheck = await query(`SELECT 1 FROM vendors WHERE id = $1`, [vendorFilter]);
    if (vCheck.rows.length === 0) {
      throw new AppError("Vendor not found", 404);
    }
  }

  const conditions: string[] = [];
  const params: unknown[] = [];
  let p = 1;

  if (vendorFilter != null) {
    conditions.push(`p.vendor_id = $${p}`);
    params.push(vendorFilter);
    p += 1;
  }

  if (kw) {
    const likeParam = `%${kw.toLowerCase()}%`;
    conditions.push(`(
      CAST(p.note_id AS TEXT) ILIKE $${p}
      OR CAST(p.grn_id AS TEXT) ILIKE $${p}
      OR CAST(p.po_id AS TEXT) ILIKE $${p}
      OR CAST(p.vendor_id AS TEXT) ILIKE $${p}
      OR LOWER(COALESCE(p.vendor_name, '')) LIKE $${p}
      OR LOWER(COALESCE(p.vendor_invoice_number, '')) LIKE $${p}
      OR LOWER(COALESCE(COALESCE(c.credit_debit_note_type, p.credit_debit_note_type), '')) LIKE $${p}
      OR LOWER(COALESCE(${effNoteStatus}, '')) LIKE $${p}
      OR LOWER(COALESCE(COALESCE(c.credit_debit_note_number, p.credit_debit_note_number), '')) LIKE $${p}
      OR LOWER(COALESCE(COALESCE(c.credit_debit_note_uploaded_by, p.credit_debit_note_uploaded_by), '')) LIKE $${p}
      OR LOWER(COALESCE(p.grn_status, '')) LIKE $${p}
      OR LOWER(COALESCE(p.grn_audit_status, '')) LIKE $${p}
      OR LOWER(COALESCE(COALESCE(c.created_by, p.created_by), '')) LIKE $${p}
    )`);
    params.push(likeParam);
    p += 1;
  }

  const guards = [
    `UPPER(COALESCE(NULLIF(TRIM(${effNoteStatus}), ''), '')) NOT IN ('CLOSED','COMPLETED','DONE','SETTLED','APPROVED','REJECTED')`,
    `UPPER(COALESCE(NULLIF(TRIM(${effUploadStatus}), ''), '')) NOT IN ('UPLOADED','COMPLETED','DONE')`,
  ];
  const allConditions = [...guards, ...conditions];
  const where = allConditions.length ? `WHERE ${allConditions.join(" AND ")}` : "";

  const countR = await query(
    `SELECT COUNT(*)::int AS total ${listFrom} ${where}`,
    params
  );
  const total = countR.rows[0].total as number;

  const listSql = `${listSelect}
    ${listFrom}
    ${where}
    ORDER BY COALESCE(c.updated_at, p.updated_at) DESC NULLS LAST, p.note_id DESC
    LIMIT $${p} OFFSET $${p + 1}`;

  const listR = await query(listSql, [...params, perPage, offset]);
  const content = listR.rows.map((r) => rowToItem(r as Record<string, unknown>));

  return {
    total,
    current_page: page,
    per_page_count: perPage,
    curr_page_count: content.length,
    content,
  };
}

export async function decidePendingDebitCreditNote(opts: {
  noteId: string | number;
  grnId: string | number;
  status: string;
  actorEmail: string;
}) {
  const noteId = Number(opts.noteId);
  const grnId = Number(opts.grnId);
  if (!Number.isFinite(noteId) || noteId < 1) {
    throw new AppError("Invalid note_id", 400);
  }
  if (!Number.isFinite(grnId) || grnId < 1) {
    throw new AppError("Invalid grn_id", 400);
  }

  const statusRaw = String(opts.status ?? "").trim().toUpperCase();
  if (statusRaw !== "APPROVED" && statusRaw !== "REJECTED") {
    throw new AppError("status must be APPROVED or REJECTED", 400);
  }
  const actor = str(opts.actorEmail, 255);
  if (!actor) {
    throw new AppError("actor email is required", 400);
  }

  const result = await query(
    `UPDATE inbound_grn_debit_credit_notes
     SET credit_debit_note_status = $1,
         updated_at = NOW(),
         created_by = COALESCE(NULLIF(created_by, ''), $2)
     WHERE note_id = $3 AND grn_id = $4
     RETURNING note_id, grn_id, credit_debit_note_status, updated_at`,
    [statusRaw, actor, noteId, grnId]
  );
  if (result.rows.length === 0) {
    throw new AppError("Debit/Credit note not found", 404);
  }

  const row = result.rows[0] as Record<string, unknown>;
  return {
    note_id: Number(row.note_id),
    grn_id: Number(row.grn_id),
    credit_debit_note_status: row.credit_debit_note_status ?? null,
    updated_at: row.updated_at ?? null,
  };
}
