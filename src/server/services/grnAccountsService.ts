import { query } from "@/server/db";
import { AppError } from "@/server/errors";

// ── Shared list SQL (same columns as inboundGrnsService listSelect + new fields) ──

const listSelect = `
  SELECT g.grn_id, g.po_id, g.vendor_id, g.vendor_name,
         g.grn_status, g.grn_audit_status, g.grn_audit_by,
         g.grn_invoice_collection_status, g.grn_invoice_collection_by,
         g.accounts_status, g.accounts_by, g.accounts_at,
         g.inventory_receipt_status, g.inventory_receipt_by, g.inventory_receipt_at,
         g.vendor_invoice_number, g.box_count_invoice, g.actual_box_count_received,
         g.grn_sku_count, g.grn_invoice_quantity, g.grn_accepted_quantity,
         g.grn_rejected_quantity, g.grn_shortage_quantity,
         g.po_sku_count, g.po_total_quantity,
         g.created_by, g.created_at, g.updated_at
  FROM inbound_grns g`;

function str(v: unknown, maxLen?: number): string {
  if (v == null || v === "") return "";
  const s = String(v).trim();
  return maxLen ? s.slice(0, maxLen) : s;
}

function rowToItem(r: Record<string, unknown>) {
  return {
    grn_id: Number(r.grn_id),
    po_id: Number(r.po_id),
    vendor_id: Number(r.vendor_id),
    vendor_name: r.vendor_name ?? null,
    grn_status: r.grn_status ?? null,
    grn_audit_status: r.grn_audit_status ?? null,
    grn_audit_by: r.grn_audit_by ?? null,
    grn_invoice_collection_status: r.grn_invoice_collection_status ?? null,
    grn_invoice_collection_by: r.grn_invoice_collection_by ?? null,
    accounts_status: r.accounts_status ?? null,
    accounts_by: r.accounts_by ?? null,
    accounts_at: r.accounts_at ?? null,
    inventory_receipt_status: r.inventory_receipt_status ?? null,
    inventory_receipt_by: r.inventory_receipt_by ?? null,
    inventory_receipt_at: r.inventory_receipt_at ?? null,
    vendor_invoice_number: r.vendor_invoice_number ?? null,
    box_count_invoice: Number(r.box_count_invoice ?? 0),
    actual_box_count_received: Number(r.actual_box_count_received ?? 0),
    grn_sku_count: Number(r.grn_sku_count ?? 0),
    grn_invoice_quantity: r.grn_invoice_quantity,
    grn_accepted_quantity: r.grn_accepted_quantity,
    grn_rejected_quantity: r.grn_rejected_quantity,
    grn_shortage_quantity: r.grn_shortage_quantity,
    po_sku_count: Number(r.po_sku_count ?? 0),
    po_total_quantity: Number(r.po_total_quantity ?? 0),
    created_by: r.created_by ?? null,
    created_at: r.created_at ?? null,
    updated_at: r.updated_at ?? null,
  };
}

// ── Approve / Reject ─────────────────────────────────────────────────────────

export async function approveAccounts(
  grnIdRaw: unknown,
  approvedBy: string
) {
  const grnId = Number(grnIdRaw);
  if (!Number.isFinite(grnId)) throw new AppError("Invalid grn_id", 400);

  const res = await query(
    `UPDATE inbound_grns
     SET accounts_status = 'APPROVED', accounts_by = $1, accounts_at = NOW(), updated_at = NOW()
     WHERE grn_id = $2
     RETURNING grn_id`,
    [approvedBy, grnId]
  );
  if (res.rows.length === 0) throw new AppError(`GRN ${grnId} not found`, 404);
}

export async function rejectAccounts(
  grnIdRaw: unknown,
  rejectedBy: string
) {
  const grnId = Number(grnIdRaw);
  if (!Number.isFinite(grnId)) throw new AppError("Invalid grn_id", 400);

  const res = await query(
    `UPDATE inbound_grns
     SET accounts_status = 'REJECTED', accounts_by = $1, accounts_at = NOW(), updated_at = NOW()
     WHERE grn_id = $2
     RETURNING grn_id`,
    [rejectedBy, grnId]
  );
  if (res.rows.length === 0) throw new AppError(`GRN ${grnId} not found`, 404);
}

// ── Paginated list (pending accounts queue) ───────────────────────────────────

export async function listPendingAccountsGrnsPaginated(opts: {
  page?: unknown;
  count?: unknown;
  searchKeyword?: unknown;
  vendorId?: unknown;
}) {
  const page = Math.max(1, Number(opts.page) || 1);
  const perPage = Math.min(200, Math.max(1, Number(opts.count) || 100));
  const offset = (page - 1) * perPage;
  const kw = str(opts.searchKeyword);

  let vendorFilter: number | null = null;
  if (opts.vendorId != null && opts.vendorId !== "") {
    const v = Number(opts.vendorId);
    if (!Number.isFinite(v) || v < 1) throw new AppError("Invalid vendor_id", 400);
    vendorFilter = v;
    const vCheck = await query(`SELECT 1 FROM vendors WHERE id = $1`, [vendorFilter]);
    if (vCheck.rows.length === 0) throw new AppError("Vendor not found", 404);
  }

  const conditions: string[] = [];
  const params: unknown[] = [];
  let p = 1;

  if (vendorFilter != null) {
    conditions.push(`g.vendor_id = $${p}`);
    params.push(vendorFilter);
    p += 1;
  }

  if (kw) {
    const like = `%${kw.toLowerCase()}%`;
    conditions.push(`(
      CAST(g.grn_id AS TEXT) ILIKE $${p}
      OR CAST(g.po_id AS TEXT) ILIKE $${p}
      OR CAST(g.vendor_id AS TEXT) ILIKE $${p}
      OR LOWER(COALESCE(g.vendor_name, '')) LIKE $${p}
      OR LOWER(COALESCE(g.grn_status, '')) LIKE $${p}
      OR LOWER(COALESCE(g.accounts_status, '')) LIKE $${p}
      OR LOWER(COALESCE(g.vendor_invoice_number, '')) LIKE $${p}
      OR LOWER(COALESCE(g.created_by, '')) LIKE $${p}
    )`);
    params.push(like);
    p += 1;
  }

  const whereExtra = conditions.length ? `AND ${conditions.join(" AND ")}` : "";
  const pendingGuard =
    `AND UPPER(COALESCE(g.accounts_status, '')) NOT IN ('APPROVED','REJECTED')`;

  const countRes = await query(
    `SELECT COUNT(*)::int AS total
     FROM inbound_grns g
     INNER JOIN inbound_grn_pending_accounts_approval q ON q.grn_id = g.grn_id
     WHERE 1=1 ${pendingGuard} ${whereExtra}`,
    params
  );
  const total = countRes.rows[0].total as number;

  const listRes = await query(
    `${listSelect}
     INNER JOIN inbound_grn_pending_accounts_approval q ON q.grn_id = g.grn_id
     WHERE 1=1 ${pendingGuard} ${whereExtra}
     ORDER BY g.created_at DESC NULLS LAST, g.grn_id DESC
     LIMIT $${p} OFFSET $${p + 1}`,
    [...params, perPage, offset]
  );

  return {
    total,
    current_page: page,
    per_page_count: perPage,
    curr_page_count: listRes.rows.length,
    content: listRes.rows.map(rowToItem),
  };
}
