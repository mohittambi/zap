// @ts-nocheck
import { query } from "@/server/db";
import { AppError } from "@/server/errors";

function str(v, maxLen) {
  if (v == null || v === "") return "";
  const s = String(v).trim();
  return maxLen ? s.slice(0, maxLen) : s;
}

/** eautomate-shaped list row for inbound GRN table UI */
function rowToListItem(r) {
  const vendorId = Number(r.vendor_id);
  return {
    grn_id: Number(r.grn_id),
    po_id: Number(r.po_id),
    vendor_id: vendorId,
    vendor_name: r.vendor_name ?? null,
    grn_status: r.grn_status ?? null,
    grn_audit_status: r.grn_audit_status ?? null,
    grn_audit_by: r.grn_audit_by ?? null,
    grn_invoice_collection_status: r.grn_invoice_collection_status ?? null,
    grn_invoice_collection_by: r.grn_invoice_collection_by ?? null,
    vendor_invoice_number: r.vendor_invoice_number ?? null,
    box_count_invoice: Number(r.box_count_invoice ?? 0),
    actual_box_count_recieved: Number(r.actual_box_count_received ?? 0),
    grn_sku_count: Number(r.grn_sku_count ?? 0),
    grn_invoice_quantity: String(r.grn_invoice_quantity ?? 0),
    grn_accepted_quantity: String(r.grn_accepted_quantity ?? 0),
    grn_rejected_quantity: String(r.grn_rejected_quantity ?? 0),
    grn_shortage_quantity: String(r.grn_shortage_quantity ?? 0),
    po_sku_count: Number(r.po_sku_count ?? 0),
    po_total_quantity: Number(r.po_total_quantity ?? 0),
    created_by: r.created_by ?? null,
    created_at: r.created_at
      ? new Date(r.created_at).toISOString().replace(/\.\d{3}Z$/, ".000000Z")
      : null,
    updated_at: r.updated_at
      ? new Date(r.updated_at).toISOString().replace(/\.\d{3}Z$/, ".000000Z")
      : null,
    id: vendorId,
  };
}

const listSelect = `
  SELECT g.grn_id, g.po_id, g.vendor_id, g.vendor_name,
         g.grn_status, g.grn_audit_status, g.grn_audit_by,
         g.grn_invoice_collection_status, g.grn_invoice_collection_by,
         g.vendor_invoice_number, g.box_count_invoice, g.actual_box_count_received,
         g.grn_sku_count, g.grn_invoice_quantity, g.grn_accepted_quantity,
         g.grn_rejected_quantity, g.grn_shortage_quantity,
         g.po_sku_count, g.po_total_quantity,
         g.created_by, g.created_at, g.updated_at
  FROM inbound_grns g`;

/**
 * Paginated list; response shape aligned with eautomate-style PO list.
 */
export async function listGrnsPaginated(opts) {
  const page = Math.max(1, Number(opts.page) || 1);
  const perPage = Math.min(200, Math.max(1, Number(opts.count) || 100));
  const offset = (page - 1) * perPage;
  const kw = str(opts.searchKeyword);

  let vendorFilter = null;
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

  const conditions = [];
  const params = [];
  let p = 1;

  if (vendorFilter != null) {
    conditions.push(`g.vendor_id = $${p}`);
    params.push(vendorFilter);
    p += 1;
  }

  if (kw) {
    const likeParam = `%${kw.toLowerCase()}%`;
    conditions.push(`(
      CAST(g.grn_id AS TEXT) ILIKE $${p}
      OR CAST(g.po_id AS TEXT) ILIKE $${p}
      OR CAST(g.vendor_id AS TEXT) ILIKE $${p}
      OR LOWER(COALESCE(g.vendor_name, '')) LIKE $${p}
      OR LOWER(COALESCE(g.grn_status, '')) LIKE $${p}
      OR LOWER(COALESCE(g.grn_audit_status, '')) LIKE $${p}
      OR LOWER(COALESCE(g.grn_invoice_collection_status, '')) LIKE $${p}
      OR LOWER(COALESCE(g.vendor_invoice_number, '')) LIKE $${p}
      OR LOWER(COALESCE(g.grn_audit_by, '')) LIKE $${p}
      OR LOWER(COALESCE(g.grn_invoice_collection_by, '')) LIKE $${p}
      OR LOWER(COALESCE(g.created_by, '')) LIKE $${p}
    )`);
    params.push(likeParam);
    p += 1;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const countR = await query(
    `SELECT COUNT(*)::int AS total FROM inbound_grns g ${where}`,
    params
  );
  const total = countR.rows[0].total;

  const listSql = `${listSelect}
    ${where}
    ORDER BY g.created_at DESC NULLS LAST, g.grn_id DESC
    LIMIT $${p} OFFSET $${p + 1}`;

  const listR = await query(listSql, [...params, perPage, offset]);
  const content = listR.rows.map((r) => rowToListItem(r));

  return {
    total,
    current_page: page,
    per_page_count: perPage,
    curr_page_count: content.length,
    content,
  };
}

/**
 * Pending audits: rows in inbound_grn_pending_audit joined to inbound_grns (last sync snapshot).
 */
export async function listPendingAuditGrnsPaginated(opts) {
  const page = Math.max(1, Number(opts.page) || 1);
  const perPage = Math.min(200, Math.max(1, Number(opts.count) || 100));
  const offset = (page - 1) * perPage;
  const kw = str(opts.searchKeyword);

  let vendorFilter = null;
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

  const conditions = [];
  const params = [];
  let p = 1;

  if (vendorFilter != null) {
    conditions.push(`g.vendor_id = $${p}`);
    params.push(vendorFilter);
    p += 1;
  }

  if (kw) {
    const likeParam = `%${kw.toLowerCase()}%`;
    conditions.push(`(
      CAST(g.grn_id AS TEXT) ILIKE $${p}
      OR CAST(g.po_id AS TEXT) ILIKE $${p}
      OR CAST(g.vendor_id AS TEXT) ILIKE $${p}
      OR LOWER(COALESCE(g.vendor_name, '')) LIKE $${p}
      OR LOWER(COALESCE(g.grn_status, '')) LIKE $${p}
      OR LOWER(COALESCE(g.grn_audit_status, '')) LIKE $${p}
      OR LOWER(COALESCE(g.vendor_invoice_number, '')) LIKE $${p}
      OR LOWER(COALESCE(g.grn_audit_by, '')) LIKE $${p}
      OR LOWER(COALESCE(g.created_by, '')) LIKE $${p}
    )`);
    params.push(likeParam);
    p += 1;
  }

  const whereExtra = conditions.length ? `AND ${conditions.join(" AND ")}` : "";

  const countR = await query(
    `SELECT COUNT(*)::int AS total
     FROM inbound_grns g
     INNER JOIN inbound_grn_pending_audit q ON q.grn_id = g.grn_id
     WHERE 1=1 ${whereExtra}`,
    params
  );
  const total = countR.rows[0].total;

  const listSql = `${listSelect}
    INNER JOIN inbound_grn_pending_audit q ON q.grn_id = g.grn_id
    WHERE 1=1 ${whereExtra}
    ORDER BY g.created_at DESC NULLS LAST, g.grn_id DESC
    LIMIT $${p} OFFSET $${p + 1}`;

  const listR = await query(listSql, [...params, perPage, offset]);
  const content = listR.rows.map((r) => rowToListItem(r));

  return {
    total,
    current_page: page,
    per_page_count: perPage,
    curr_page_count: content.length,
    content,
  };
}

/**
 * Pending invoice collection: queue from last sync, joined to inbound_grns.
 */
export async function listPendingInvoiceCollectionGrnsPaginated(opts) {
  const page = Math.max(1, Number(opts.page) || 1);
  const perPage = Math.min(200, Math.max(1, Number(opts.count) || 100));
  const offset = (page - 1) * perPage;
  const kw = str(opts.searchKeyword);

  let vendorFilter = null;
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

  const conditions = [];
  const params = [];
  let p = 1;

  if (vendorFilter != null) {
    conditions.push(`g.vendor_id = $${p}`);
    params.push(vendorFilter);
    p += 1;
  }

  if (kw) {
    const likeParam = `%${kw.toLowerCase()}%`;
    conditions.push(`(
      CAST(g.grn_id AS TEXT) ILIKE $${p}
      OR CAST(g.po_id AS TEXT) ILIKE $${p}
      OR CAST(g.vendor_id AS TEXT) ILIKE $${p}
      OR LOWER(COALESCE(g.vendor_name, '')) LIKE $${p}
      OR LOWER(COALESCE(g.grn_status, '')) LIKE $${p}
      OR LOWER(COALESCE(g.grn_audit_status, '')) LIKE $${p}
      OR LOWER(COALESCE(g.grn_invoice_collection_status, '')) LIKE $${p}
      OR LOWER(COALESCE(g.vendor_invoice_number, '')) LIKE $${p}
      OR LOWER(COALESCE(g.grn_audit_by, '')) LIKE $${p}
      OR LOWER(COALESCE(g.grn_invoice_collection_by, '')) LIKE $${p}
      OR LOWER(COALESCE(g.created_by, '')) LIKE $${p}
    )`);
    params.push(likeParam);
    p += 1;
  }

  const whereExtra = conditions.length ? `AND ${conditions.join(" AND ")}` : "";

  const countR = await query(
    `SELECT COUNT(*)::int AS total
     FROM inbound_grns g
     INNER JOIN inbound_grn_pending_invoice_collection q ON q.grn_id = g.grn_id
     WHERE 1=1 ${whereExtra}`,
    params
  );
  const total = countR.rows[0].total;

  const listSql = `${listSelect}
    INNER JOIN inbound_grn_pending_invoice_collection q ON q.grn_id = g.grn_id
    WHERE 1=1 ${whereExtra}
    ORDER BY g.created_at DESC NULLS LAST, g.grn_id DESC
    LIMIT $${p} OFFSET $${p + 1}`;

  const listR = await query(listSql, [...params, perPage, offset]);
  const content = listR.rows.map((r) => rowToListItem(r));

  return {
    total,
    current_page: page,
    per_page_count: perPage,
    curr_page_count: content.length,
    content,
  };
}

export async function getGrnById(grnIdRaw) {
  const grnId = Number(grnIdRaw);
  if (!Number.isFinite(grnId) || grnId < 1) {
    throw new AppError("Invalid grn id", 400);
  }
  const r = await query(`${listSelect} WHERE g.grn_id = $1`, [grnId]);
  if (r.rows.length === 0) {
    throw new AppError("GRN not found", 404);
  }
  return rowToListItem(r.rows[0]);
}
