import { query } from "@/server/db";
import { AppError } from "@/server/errors";

function str(v: unknown, maxLen?: number): string {
  if (v == null || v === "") return "";
  const s = String(v).trim();
  return maxLen ? s.slice(0, maxLen) : s;
}

const listSelect = `
  SELECT note_id, grn_id, credit_debit_note_type, credit_debit_note_status, credit_debit_note_number,
         credit_debit_note_number_assignment_status, credit_debit_note_upload_status, credit_debit_note_uploaded_by,
         reverse_credit_debit_note_number, reverse_credit_debit_note_upload_status, reverse_credit_debit_note_uploaded_by,
         created_by, created_at, updated_at, po_id, grn_status, grn_audit_status, grn_audit_by,
         vendor_invoice_number, box_count_invoice, actual_box_count_recieved, vendor_id, vendor_name,
         raw, synced_at
  FROM inbound_pending_debit_credit_notes`;

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
 * Paginated list of rows last synced from eautomate debit_credit_notes/paginated.
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
    conditions.push(`vendor_id = $${p}`);
    params.push(vendorFilter);
    p += 1;
  }

  if (kw) {
    const likeParam = `%${kw.toLowerCase()}%`;
    conditions.push(`(
      CAST(note_id AS TEXT) ILIKE $${p}
      OR CAST(grn_id AS TEXT) ILIKE $${p}
      OR CAST(po_id AS TEXT) ILIKE $${p}
      OR CAST(vendor_id AS TEXT) ILIKE $${p}
      OR LOWER(COALESCE(vendor_name, '')) LIKE $${p}
      OR LOWER(COALESCE(vendor_invoice_number, '')) LIKE $${p}
      OR LOWER(COALESCE(credit_debit_note_type, '')) LIKE $${p}
      OR LOWER(COALESCE(credit_debit_note_status, '')) LIKE $${p}
      OR LOWER(COALESCE(credit_debit_note_number, '')) LIKE $${p}
      OR LOWER(COALESCE(credit_debit_note_uploaded_by, '')) LIKE $${p}
      OR LOWER(COALESCE(grn_status, '')) LIKE $${p}
      OR LOWER(COALESCE(grn_audit_status, '')) LIKE $${p}
      OR LOWER(COALESCE(created_by, '')) LIKE $${p}
    )`);
    params.push(likeParam);
    p += 1;
  }

  const guards = [
    `UPPER(COALESCE(credit_debit_note_status, '')) NOT IN ('CLOSED','COMPLETED','DONE','SETTLED')`,
    `UPPER(COALESCE(credit_debit_note_upload_status, '')) NOT IN ('UPLOADED','COMPLETED','DONE')`,
  ];
  const allConditions = [...guards, ...conditions];
  const where = allConditions.length ? `WHERE ${allConditions.join(" AND ")}` : "";

  const countR = await query(
    `SELECT COUNT(*)::int AS total FROM inbound_pending_debit_credit_notes ${where}`,
    params
  );
  const total = countR.rows[0].total as number;

  const listSql = `${listSelect}
    ${where}
    ORDER BY updated_at DESC NULLS LAST, note_id DESC
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
