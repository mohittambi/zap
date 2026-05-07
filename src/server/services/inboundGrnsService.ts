// @ts-nocheck
import { grnLineQuantitySumErrorMessage } from "@/lib/grnLineQuantityValidation";
import getPool, { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { seedGrnItemsFromPoDetailLinesIfEmpty } from "@/server/services/grnDebitNoteService";
import { appendInboundGrnLogSafe } from "@/server/services/inboundGrnLogService";

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
    accounts_status: r.accounts_status ?? null,
    accounts_by: r.accounts_by ?? null,
    accounts_at: r.accounts_at
      ? new Date(r.accounts_at).toISOString().replace(/\.\d{3}Z$/, ".000000Z")
      : null,
    inventory_receipt_status: r.inventory_receipt_status ?? null,
    inventory_receipt_by: r.inventory_receipt_by ?? null,
    inventory_receipt_at: r.inventory_receipt_at
      ? new Date(r.inventory_receipt_at).toISOString().replace(/\.\d{3}Z$/, ".000000Z")
      : null,
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
         g.accounts_status, g.accounts_by, g.accounts_at,
         g.inventory_receipt_status, g.inventory_receipt_by, g.inventory_receipt_at,
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
  const pendingAuditGuard =
    `AND UPPER(COALESCE(g.grn_audit_status, '')) NOT IN ('CLOSED','AUDITED','DONE','COMPLETED')`;

  const countR = await query(
    `SELECT COUNT(*)::int AS total
     FROM inbound_grns g
     INNER JOIN inbound_grn_pending_audit q ON q.grn_id = g.grn_id
     WHERE 1=1 ${pendingAuditGuard} ${whereExtra}`,
    params
  );
  const total = countR.rows[0].total;

  const listSql = `${listSelect}
    INNER JOIN inbound_grn_pending_audit q ON q.grn_id = g.grn_id
    WHERE 1=1 ${pendingAuditGuard} ${whereExtra}
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
  const pendingStatusGuard = `AND UPPER(COALESCE(g.grn_invoice_collection_status, '')) <> 'COLLECTED'`;

  const countR = await query(
    `SELECT COUNT(*)::int AS total
     FROM inbound_grns g
     INNER JOIN inbound_grn_pending_invoice_collection q ON q.grn_id = g.grn_id
     WHERE 1=1 ${pendingStatusGuard} ${whereExtra}`,
    params
  );
  const total = countR.rows[0].total;

  const listSql = `${listSelect}
    INNER JOIN inbound_grn_pending_invoice_collection q ON q.grn_id = g.grn_id
    WHERE 1=1 ${pendingStatusGuard} ${whereExtra}
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
 * Update status fields on a GRN row (audit status, invoice collection status, or grn_status).
 * Allowed fields: grn_audit_status, grn_audit_by, grn_invoice_collection_status, grn_invoice_collection_by, grn_status
 */
export async function updateGrnStatus(grnIdRaw, fields, actorEmail) {
  const grnId = Number(grnIdRaw);
  if (!Number.isFinite(grnId) || grnId === 0) throw new AppError("Invalid grn id", 400);

  if (typeof fields.grn_audit_status === "string") {
    const auditStatus = fields.grn_audit_status.trim().toUpperCase();
    if (auditStatus === "AUDITED") {
      // Canonicalize legacy AUDITED to CLOSED across inbound flows.
      fields.grn_audit_status = "CLOSED";
    }
  }

  const allowed = ["grn_audit_status", "grn_audit_by", "grn_invoice_collection_status", "grn_invoice_collection_by", "grn_status", "accounts_status", "accounts_by"];
  const auditDone =
    String(fields.grn_audit_status ?? "").trim().toUpperCase() === "CLOSED";
  const hasAuditBy = "grn_audit_by" in fields;
  if (auditDone && hasAuditBy === false && actorEmail != null && String(actorEmail).trim() !== "") {
    fields.grn_audit_by = String(actorEmail).trim();
  }
  const collectedNow =
    String(fields.grn_invoice_collection_status ?? "").trim().toUpperCase() === "COLLECTED";
  const hasInvoiceCollectionBy = "grn_invoice_collection_by" in fields;
  if (collectedNow && hasInvoiceCollectionBy) {
    // Caller already provided explicit actor; keep it.
  } else if (collectedNow && actorEmail != null && String(actorEmail).trim() !== "") {
    fields.grn_invoice_collection_by = String(actorEmail).trim();
  }
  const accountsAction = String(fields.accounts_status ?? "").trim().toUpperCase();
  const accountsDone = accountsAction === "APPROVED" || accountsAction === "REJECTED";
  const hasAccountsBy = "accounts_by" in fields;
  if (accountsDone && hasAccountsBy === false && actorEmail != null && String(actorEmail).trim() !== "") {
    fields.accounts_by = String(actorEmail).trim();
  }
  const setClauses = [];
  const params = [];
  let idx = 1;

  for (const col of allowed) {
    if (col in fields) {
      setClauses.push(`${col} = $${idx++}`);
      params.push(fields[col] ?? null);
    }
  }
  if (setClauses.length === 0) throw new AppError("No fields to update", 400);

  setClauses.push(`updated_at = NOW()`);
  params.push(grnId);

  const result = await query(
    `UPDATE inbound_grns SET ${setClauses.join(", ")} WHERE grn_id = $${idx} RETURNING grn_id`,
    params
  );
  if (result.rows.length === 0) throw new AppError("GRN not found", 404);
  if (collectedNow) {
    await query(
      `DELETE FROM inbound_grn_pending_invoice_collection WHERE grn_id = $1`,
      [grnId]
    );
  }
  if (auditDone) {
    await query(
      `DELETE FROM inbound_grn_pending_audit WHERE grn_id = $1`,
      [grnId]
    );
  }
  if (accountsDone) {
    await query(
      `DELETE FROM inbound_grn_pending_accounts_approval WHERE grn_id = $1`,
      [grnId]
    );
  }
  const updated = await getGrnById(grnId);
  const summary = allowed
    .filter((col) => col in fields)
    .map((col) => `${col}=${fields[col] ?? "null"}`)
    .join("; ");
  await appendInboundGrnLogSafe({
    grnId,
    logType: "STATUS",
    operationPerformed: "GRN workflow or status fields updated",
    remarks: summary.slice(0, 2000),
    poId: updated.po_id,
    vendorId: updated.vendor_id,
    createdBy: String(actorEmail ?? "unknown").slice(0, 100),
    raw: { fields },
  });
  return updated;
}

export async function closeGrn(grnIdRaw, closedBy: string) {
  const grnId = Number(grnIdRaw);
  if (!Number.isFinite(grnId) || grnId === 0) throw new AppError("Invalid grn id", 400);

  const existing = await query(
    `SELECT grn_status, po_id, vendor_id FROM inbound_grns WHERE grn_id = $1`,
    [grnId]
  );
  if (existing.rows.length === 0) throw new AppError("GRN not found", 404);
  const currentStatus = String(existing.rows[0].grn_status ?? "");
  if (currentStatus !== "OPEN") {
    throw new AppError(`GRN cannot be closed (current status: ${currentStatus || "unknown"})`, 409);
  }

  const invCount = await query(
    `SELECT COUNT(*)::int AS c FROM inbound_grn_invoice_files WHERE grn_id = $1`,
    [grnId]
  );
  if (Number(invCount.rows[0]?.c ?? 0) < 1) {
    throw new AppError("Vendor invoice must be uploaded before closing", 409);
  }

  await query(
    `UPDATE inbound_grns SET grn_status = 'CLOSED', closed_by = $1, closed_at = NOW(), updated_at = NOW() WHERE grn_id = $2`,
    [closedBy, grnId]
  );
  const poId = Number(existing.rows[0].po_id);
  const vendorId = Number(existing.rows[0].vendor_id);
  await appendInboundGrnLogSafe({
    grnId,
    logType: "GRN",
    operationPerformed: "GRN closed",
    remarks: "Vendor invoice on file; receipt closed",
    poId: Number.isFinite(poId) ? poId : null,
    vendorId: Number.isFinite(vendorId) ? vendorId : null,
    createdBy: String(closedBy).slice(0, 100),
    raw: { grn_status: "CLOSED" },
  });
  return getGrnById(grnId);
}

export async function getGrnById(grnIdRaw) {
  const grnId = Number(grnIdRaw);
  if (!Number.isFinite(grnId) || grnId === 0) {
    throw new AppError("Invalid grn id", 400);
  }
  const r = await query(`${listSelect} WHERE g.grn_id = $1`, [grnId]);
  if (r.rows.length === 0) {
    throw new AppError("GRN not found", 404);
  }
  return rowToListItem(r.rows[0]);
}

/**
 * Merge quantity/price fields into inbound_grn_items.raw for the GRN SKU sheet.
 */
export async function updateInboundGrnItemRaw(grnIdRaw, lineIndexRaw, body) {
  const grnId = Number(grnIdRaw);
  const lineIndex = Number(lineIndexRaw);
  if (!Number.isFinite(grnId) || grnId === 0) {
    throw new AppError("Invalid grn id", 400);
  }
  if (
    !Number.isFinite(lineIndex) ||
    lineIndex < 0 ||
    !Number.isInteger(lineIndex)
  ) {
    throw new AppError("Invalid line index", 400);
  }

  function nonNegNum(v, fieldLabel) {
    if (v === undefined || v === null || v === "") {
      throw new AppError(`${fieldLabel} is required`, 400);
    }
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) {
      throw new AppError(`${fieldLabel} must be a non-negative number`, 400);
    }
    return n;
  }

  const next = {
    invoice_quantity: nonNegNum(body?.invoice_quantity, "invoice_quantity"),
    accepted_quantity: nonNegNum(body?.accepted_quantity, "accepted_quantity"),
    rejected_quantity: nonNegNum(body?.rejected_quantity, "rejected_quantity"),
    shortage_quantity: nonNegNum(body?.shortage_quantity, "shortage_quantity"),
    received_price: nonNegNum(body?.received_price, "received_price"),
    tax_rate: nonNegNum(body?.tax_rate, "tax_rate"),
  };

  const qtySumMsg = grnLineQuantitySumErrorMessage({
    invoice_quantity: next.invoice_quantity,
    accepted_quantity: next.accepted_quantity,
    rejected_quantity: next.rejected_quantity,
    shortage_quantity: next.shortage_quantity,
  });
  if (qtySumMsg) {
    throw new AppError(qtySumMsg, 400);
  }

  let auditPriceOut;
  if (Object.prototype.hasOwnProperty.call(body || {}, "audit_price")) {
    if (body.audit_price === null || body.audit_price === "") {
      auditPriceOut = null;
    } else {
      const a = Number(body.audit_price);
      if (!Number.isFinite(a) || a < 0) {
        throw new AppError(
          "audit_price must be a non-negative number or empty",
          400
        );
      }
      auditPriceOut = a;
    }
  } else {
    auditPriceOut = undefined;
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const header = await client.query(
      `SELECT 1 FROM inbound_grns WHERE grn_id = $1`,
      [grnId]
    );
    if (header.rows.length === 0) {
      throw new AppError("GRN not found", 404);
    }

    const row = await client.query(
      `SELECT raw FROM inbound_grn_items WHERE grn_id = $1 AND line_index = $2 FOR UPDATE`,
      [grnId, lineIndex]
    );
    if (row.rows.length === 0) {
      throw new AppError("GRN line not found", 404);
    }

    const existing = row.rows[0].raw;
    const base =
      existing && typeof existing === "object" && !Array.isArray(existing)
        ? { ...existing }
        : {};

    base.invoice_quantity = next.invoice_quantity;
    base.accepted_quantity = next.accepted_quantity;
    base.rejected_quantity = next.rejected_quantity;
    base.shortage_quantity = next.shortage_quantity;
    base.received_price = next.received_price;
    base.tax_rate = next.tax_rate;

    if (auditPriceOut === null) {
      delete base.audit_price;
      delete base.auditPrice;
      delete base.audit_price_excl_gst;
      delete base.audit_price_exclusive_gst;
    } else if (auditPriceOut !== undefined) {
      base.audit_price = auditPriceOut;
    }

    const upd = await client.query(
      `UPDATE inbound_grn_items SET raw = $1::jsonb
       WHERE grn_id = $2 AND line_index = $3
       RETURNING line_index, sku_id, raw`,
      [JSON.stringify(base), grnId, lineIndex]
    );

    await client.query("COMMIT");
    const out = upd.rows[0];
    return {
      line_index: Number(out.line_index),
      sku_id: out.sku_id != null ? String(out.sku_id) : null,
      raw:
        typeof out.raw === "object" && out.raw !== null
          ? out.raw
          : {},
    };
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Create a draft GRN row in Zap for a vendor + PO (negative grn_id space reserved for Zap-created drafts).
 * Optional vendor_invoice_number, box_count_invoice, actual_box_count_received (defaults 0 / null).
 */
export async function createDraftGrnForPo({
  vendorId,
  poId,
  createdBy,
  vendorInvoiceNumber,
  boxCountInvoice,
  actualBoxCountReceived,
}) {
  const pid = Number(poId);
  if (
    vendorId == null ||
    !Number.isFinite(Number(vendorId)) ||
    Number(vendorId) < 1
  ) {
    throw new AppError("Invalid vendor id", 400);
  }
  if (!Number.isFinite(pid) || pid < 1) throw new AppError("Invalid PO id", 400);

  const poSnap = await query(
    `SELECT vendor_id FROM inbound_po_detail_snapshot WHERE po_id = $1`,
    [pid]
  );
  if (poSnap.rows.length === 0) {
    throw new AppError(
      "PO snapshot not found for this PO. Ensure PO data exists in ZAP (seed or open the purchase order in the app to cache lines).",
      404
    );
  }
  /** Canonical vendor from ingested PO (URL/client vendor_id may be stale). */
  const vid = Number(poSnap.rows[0].vendor_id);
  if (!Number.isFinite(vid) || vid < 1) {
    throw new AppError("Invalid vendor on PO snapshot", 500);
  }

  const v = await query(`SELECT id, vendor_name FROM vendors WHERE id = $1`, [vid]);
  if (v.rows.length === 0) throw new AppError("Vendor not found", 404);

  const negR = await query(
    `SELECT COALESCE(MIN(grn_id), 0) - 1 AS next_id
     FROM inbound_grns
     WHERE grn_id < 0`
  );
  let grnId = Number(negR.rows[0].next_id);
  if (!Number.isFinite(grnId) || grnId > -1) grnId = -1;

  const vendorName =
    v.rows[0].vendor_name != null ? String(v.rows[0].vendor_name) : null;

  let invoiceNum = null;
  if (vendorInvoiceNumber != null && String(vendorInvoiceNumber).trim() !== "") {
    invoiceNum = str(vendorInvoiceNumber, 200);
  }
  const boxInv =
    boxCountInvoice == null || boxCountInvoice === ""
      ? 0
      : Number(boxCountInvoice);
  const boxActual =
    actualBoxCountReceived == null || actualBoxCountReceived === ""
      ? 0
      : Number(actualBoxCountReceived);
  if (!Number.isFinite(boxInv) || !Number.isInteger(boxInv) || boxInv < 0) {
    throw new AppError("box_count_invoice must be a non-negative integer", 400);
  }
  if (
    !Number.isFinite(boxActual) ||
    !Number.isInteger(boxActual) ||
    boxActual < 0
  ) {
    throw new AppError(
      "actual_box_count_received must be a non-negative integer",
      400
    );
  }

  await query(
    `INSERT INTO inbound_grns (
      grn_id, po_id, vendor_id, vendor_name, grn_status,
      vendor_invoice_number,
      box_count_invoice, actual_box_count_received, grn_sku_count,
      grn_invoice_quantity, grn_accepted_quantity, grn_rejected_quantity, grn_shortage_quantity,
      po_sku_count, po_total_quantity, created_by, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6,
      $7, $8, 0,
      0, 0, 0, 0,
      0, 0, $9, NOW(), NOW()
    )`,
    [
      grnId,
      pid,
      vid,
      vendorName,
      "DRAFT_ZAP",
      invoiceNum,
      boxInv,
      boxActual,
      createdBy ?? null,
    ]
  );

  await seedGrnItemsFromPoDetailLinesIfEmpty(grnId);
  return getGrnById(grnId);
}

/**
 * Re-key a Zap draft GRN (negative grn_id, DRAFT_ZAP) to a user-chosen operational positive id.
 * Depends on FK ON UPDATE CASCADE plus manual updates for denormalized grn_id columns without FK.
 */
export async function registerOperationalGrnId(draftGrnIdRaw, operationalGrnIdRaw) {
  const draftGrnId = Number(draftGrnIdRaw);
  const operationalGrnId = Number(operationalGrnIdRaw);

  if (
    !Number.isFinite(draftGrnId) ||
    !Number.isInteger(draftGrnId) ||
    draftGrnId >= 0
  ) {
    throw new AppError("Only draft GRNs (negative integer id) can be registered", 400);
  }
  if (
    !Number.isFinite(operationalGrnId) ||
    !Number.isInteger(operationalGrnId) ||
    operationalGrnId < 1
  ) {
    throw new AppError("operational_grn_id must be a positive integer", 400);
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const lock = await client.query(
      `SELECT grn_id, po_id, grn_status FROM inbound_grns WHERE grn_id = $1 FOR UPDATE`,
      [draftGrnId]
    );
    if (lock.rows.length === 0) {
      throw new AppError("GRN not found", 404);
    }
    const row0 = lock.rows[0];
    const status = String(row0.grn_status ?? "").trim().toUpperCase();
    if (status !== "DRAFT_ZAP") {
      throw new AppError("Only DRAFT_ZAP GRNs can register an operational id", 409);
    }
    const poId = Number(row0.po_id);
    if (!Number.isFinite(poId) || poId < 1) {
      throw new AppError("Invalid PO id on draft GRN", 500);
    }

    const taken = await client.query(
      `SELECT 1 FROM inbound_grns WHERE grn_id = $1 FOR UPDATE`,
      [operationalGrnId]
    );
    if (taken.rows.length > 0) {
      throw new AppError("Operational GRN id already exists", 409);
    }

    await client.query(
      `UPDATE inbound_po_detail_grns SET grn_id = $1 WHERE grn_id = $2 AND po_id = $3`,
      [operationalGrnId, draftGrnId, poId]
    );
    await client.query(
      `UPDATE inbound_pending_debit_credit_notes SET grn_id = $1 WHERE grn_id = $2`,
      [operationalGrnId, draftGrnId]
    );

    const upd = await client.query(
      `UPDATE inbound_grns SET grn_id = $1,
         grn_status = CASE WHEN grn_status = 'DRAFT_ZAP' THEN 'OPEN' ELSE grn_status END,
         updated_at = NOW()
       WHERE grn_id = $2`,
      [operationalGrnId, draftGrnId]
    );
    if ((upd.rowCount ?? 0) !== 1) {
      throw new AppError("Failed to promote GRN", 500);
    }

    await client.query("COMMIT");
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    if (e && typeof e === "object" && "code" in e && e.code === "23505") {
      throw new AppError("Operational GRN id already exists", 409);
    }
    throw e;
  } finally {
    client.release();
  }

  return getGrnById(operationalGrnId);
}
