// @ts-nocheck
import getPool, { query } from "@/server/db";
import { AppError } from "@/server/errors";

function str(v, maxLen) {
  if (v == null || v === "") return "";
  const s = String(v).trim();
  return maxLen ? s.slice(0, maxLen) : s;
}

function formatExpectedDate(d) {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  const y = x.getUTCFullYear();
  const m = String(x.getUTCMonth() + 1).padStart(2, "0");
  const day = String(x.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day} 00:00:00`;
}

function formatDateTime(d) {
  if (d == null) return null;
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}:${pad(x.getSeconds())}`;
}

function rowToListItem(r) {
  const vendorId = Number(r.vendor_id);
  return {
    po_id: Number(r.po_id),
    vendor_id: vendorId,
    expected_date: formatExpectedDate(r.expected_date),
    created_by: r.created_by ?? null,
    created_at: r.created_at
      ? new Date(r.created_at).toISOString().replace(/\.\d{3}Z$/, ".000000Z")
      : null,
    updated_at: r.updated_at
      ? new Date(r.updated_at).toISOString().replace(/\.\d{3}Z$/, ".000000Z")
      : null,
    date_published: r.date_published ? formatDateTime(r.date_published) : null,
    status: r.status ?? null,
    po_remarks: r.po_remarks ?? null,
    vendor_name: r.vendor_name ?? null,
    id: vendorId,
    sku_count: Number(r.sku_count ?? 0),
    total_quantity: Number(r.total_quantity ?? 0),
    number_of_grns: Number(r.number_of_grns ?? 0),
    total_invoice_quantity: Number(r.total_invoice_quantity ?? 0),
    total_accepted_quantity: Number(r.total_accepted_quantity ?? 0),
    total_rejected_quantity: Number(r.total_rejected_quantity ?? 0),
    sku_fill_rate: Number(r.sku_fill_rate ?? 0),
    quantity_fill_rate: Number(r.quantity_fill_rate ?? 0),
    /** Drives display label: 'zap' → ZP-{po_id}, 'eautomate' → bare. Doctrine #5. */
    source: r.source === "zap" ? "zap" : "eautomate",
  };
}

/**
 * Paginated list for one vendor; response shape matches eautomate with_filters.
 */
export async function listVendorPurchaseOrdersWithFilters(opts) {
  const vendorId = Number(opts.vendorId);
  if (!Number.isFinite(vendorId) || vendorId < 1) {
    throw new AppError("vendor_id is required", 400);
  }

  const page = Math.max(1, Number(opts.page) || 1);
  const perPage = Math.min(200, Math.max(1, Number(opts.count) || 100));
  const offset = (page - 1) * perPage;
  const kw = str(opts.searchKeyword);
  const likeParam = kw ? `%${kw.toLowerCase()}%` : null;
  const searchClause = kw
    ? ` AND (
        CAST(po.po_id AS TEXT) ILIKE $2
        OR LOWER(COALESCE(po.status, '')) LIKE $2
        OR LOWER(COALESCE(po.po_remarks, '')) LIKE $2
      )`
    : "";

  const vCheck = await query(`SELECT 1 FROM vendors WHERE id = $1`, [vendorId]);
  if (vCheck.rows.length === 0) {
    throw new AppError("Vendor not found", 404);
  }

  const countParams = kw ? [vendorId, likeParam] : [vendorId];
  const countSql = `SELECT COUNT(*)::int AS total FROM vendor_purchase_orders po
    WHERE po.vendor_id = $1 ${searchClause}`;
  const countR = await query(countSql, countParams);
  const total = countR.rows[0].total;

  const limitP = kw ? 3 : 2;
  const offsetP = kw ? 4 : 3;
  const listParams = kw
    ? [vendorId, likeParam, perPage, offset]
    : [vendorId, perPage, offset];
  const listSql = `
    SELECT po.po_id, po.vendor_id, po.vendor_name, po.source, po.expected_date, po.created_by, po.modified_by,
           po.created_at, po.updated_at, po.date_published, po.status, po.po_remarks,
           po.sku_count, po.total_quantity, po.number_of_grns, po.total_invoice_quantity,
           po.total_accepted_quantity, po.total_rejected_quantity, po.sku_fill_rate, po.quantity_fill_rate
    FROM vendor_purchase_orders po
    WHERE po.vendor_id = $1 ${searchClause}
    ORDER BY po.created_at DESC NULLS LAST, po.po_id DESC
    LIMIT $${limitP} OFFSET $${offsetP}`;

  const listR = await query(listSql, listParams);

  const content = listR.rows.map((r) => rowToListItem(r));

  return {
    total,
    current_page: page,
    per_page_count: perPage,
    curr_page_count: content.length,
    content,
  };
}

/** All PO rows for one vendor (for CSV export), same row shape as list items. */
export async function listVendorPurchaseOrdersAll(opts) {
  const vendorId = Number(opts.vendorId);
  if (!Number.isFinite(vendorId) || vendorId < 1) {
    throw new AppError("vendor_id is required", 400);
  }

  const kw = str(opts.searchKeyword);
  const likeParam = kw ? `%${kw.toLowerCase()}%` : null;
  const searchClause = kw
    ? ` AND (
        CAST(po.po_id AS TEXT) ILIKE $2
        OR LOWER(COALESCE(po.status, '')) LIKE $2
        OR LOWER(COALESCE(po.po_remarks, '')) LIKE $2
      )`
    : "";

  const vCheck = await query(`SELECT 1 FROM vendors WHERE id = $1`, [vendorId]);
  if (vCheck.rows.length === 0) {
    throw new AppError("Vendor not found", 404);
  }

  const listParams = kw ? [vendorId, likeParam] : [vendorId];
  const listSql = `
    SELECT po.po_id, po.vendor_id, po.vendor_name, po.source, po.expected_date, po.created_by, po.modified_by,
           po.created_at, po.updated_at, po.date_published, po.status, po.po_remarks,
           po.sku_count, po.total_quantity, po.number_of_grns, po.total_invoice_quantity,
           po.total_accepted_quantity, po.total_rejected_quantity, po.sku_fill_rate, po.quantity_fill_rate
    FROM vendor_purchase_orders po
    WHERE po.vendor_id = $1 ${searchClause}
    ORDER BY po.created_at DESC NULLS LAST, po.po_id DESC`;

  const listR = await query(listSql, listParams);
  return listR.rows.map((r) => rowToListItem(r));
}

/**
 * Paginated list across all vendors (optional `filterVendorIds`). Same JSON shape as eautomate with_filters.
 */
export async function listAllPurchaseOrdersWithFilters(opts) {
  const page = Math.max(1, Number(opts.page) || 1);
  const perPage = Math.min(200, Math.max(1, Number(opts.count) || 100));
  const offset = (page - 1) * perPage;
  const kw = str(opts.searchKeyword);

  /** Non-empty finite vendor ids (>0), deduped. */
  let filterVendorIds = null;
  const rawVid = opts.filterVendorIds;
  if (Array.isArray(rawVid) && rawVid.length > 0) {
    const ids = [
      ...new Set(
        rawVid
          .map(Number)
          .filter((n) => Number.isFinite(n) && n >= 1)
      ),
    ].sort((a, b) => a - b);
    if (ids.length > 0) {
      filterVendorIds = ids;
    }
  }

  const conditions = [];
  const params = [];
  let p = 1;

  if (filterVendorIds != null && filterVendorIds.length > 0) {
    conditions.push(`po.vendor_id = ANY($${p}::bigint[])`);
    params.push(filterVendorIds);
    p += 1;
  }

  if (kw) {
    const likeParam = `%${kw.toLowerCase()}%`;
    conditions.push(`(
      CAST(po.po_id AS TEXT) ILIKE $${p}
      OR CAST(po.vendor_id AS TEXT) ILIKE $${p}
      OR LOWER(COALESCE(po.vendor_name, '')) LIKE $${p}
      OR LOWER(COALESCE(po.status, '')) LIKE $${p}
      OR LOWER(COALESCE(po.po_remarks, '')) LIKE $${p}
    )`);
    params.push(likeParam);
    p += 1;
  }

  const fp = str(opts.filterPoId ?? "");
  if (fp) {
    conditions.push(`CAST(po.po_id AS TEXT) ILIKE $${p}`);
    params.push(`%${fp.toLowerCase()}%`);
    p += 1;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  /** Sortable columns and their SQL expressions; allowlisted to prevent injection. */
  const SORT_COLUMNS = {
    po_id: "po.po_id",
    vendor_id: "po.vendor_id",
    vendor_name: "po.vendor_name",
    status: "po.status",
    sku_count: "po.sku_count",
    total_quantity: "po.total_quantity",
    number_of_grns: "po.number_of_grns",
    total_invoice_quantity: "po.total_invoice_quantity",
    total_accepted_quantity: "po.total_accepted_quantity",
    total_rejected_quantity: "po.total_rejected_quantity",
    sku_fill_rate: "po.sku_fill_rate",
    quantity_fill_rate: "po.quantity_fill_rate",
    po_remarks: "po.po_remarks",
    created_at: "po.created_at",
    updated_at: "po.updated_at",
    date_published: "po.date_published",
    expected_date: "po.expected_date",
    created_by: "po.created_by",
  };
  const sortBy = str(opts.sortBy);
  const sortExpr = sortBy && SORT_COLUMNS[sortBy] ? SORT_COLUMNS[sortBy] : null;
  const sortDirSql = opts.sortDir === "asc" ? "ASC" : "DESC";
  const orderBy = sortExpr
    ? `ORDER BY ${sortExpr} ${sortDirSql} NULLS LAST, po.po_id DESC`
    : `ORDER BY po.created_at DESC NULLS LAST, po.po_id DESC`;

  const countR = await query(
    `SELECT COUNT(*)::int AS total FROM vendor_purchase_orders po ${where}`,
    params
  );
  const total = countR.rows[0].total;

  const listSql = `
    SELECT po.po_id, po.vendor_id, po.vendor_name, po.source, po.expected_date, po.created_by, po.modified_by,
           po.created_at, po.updated_at, po.date_published, po.status, po.po_remarks,
           po.sku_count, po.total_quantity, po.number_of_grns, po.total_invoice_quantity,
           po.total_accepted_quantity, po.total_rejected_quantity, po.sku_fill_rate, po.quantity_fill_rate
    FROM vendor_purchase_orders po
    ${where}
    ${orderBy}
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

function parseExpectedDateInput(expectedRaw) {
  if (expectedRaw == null || expectedRaw === "") {
    throw new AppError("expected_date is required", 400);
  }
  const expectedDate = new Date(
    typeof expectedRaw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(expectedRaw.trim())
      ? `${expectedRaw.trim()}T12:00:00.000Z`
      : expectedRaw
  );
  if (Number.isNaN(expectedDate.getTime())) {
    throw new AppError("Invalid expected_date", 400);
  }
  return expectedDate;
}

function normalizePoLineItems(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new AppError("At least one line item is required", 400);
  }
  const normalizedLines = [];
  const seenSku = new Set();
  for (const line of lines) {
    const skuId = str(line.sku_id, 100);
    const qty = Number(line.quantity);
    if (!skuId) continue;
    if (!Number.isFinite(qty) || qty < 1 || !Number.isInteger(qty)) {
      throw new AppError(`Invalid quantity for SKU ${skuId}`, 400);
    }
    if (seenSku.has(skuId)) {
      throw new AppError(`Duplicate SKU in lines: ${skuId}`, 400);
    }
    seenSku.add(skuId);
    normalizedLines.push({ sku_id: skuId, quantity: qty });
  }
  if (normalizedLines.length === 0) {
    throw new AppError("At least one valid line item is required", 400);
  }
  return normalizedLines;
}

async function assertSkusBelongToVendor(vendorId, normalizedLines) {
  for (const { sku_id } of normalizedLines) {
    const m = await query(
      `SELECT 1 FROM vendor_sku WHERE vendor_id = $1 AND sku_id = $2`,
      [vendorId, sku_id]
    );
    if (m.rows.length === 0) {
      throw new AppError(`SKU not linked to this vendor: ${sku_id}`, 400);
    }
  }
}

/**
 * Create PO with lines; validates each sku_id is in vendor_sku for vendor_id.
 */
export async function createVendorPurchaseOrder(input, actorEmail) {
  const vendorId = Number(input.vendor_id);
  if (!Number.isFinite(vendorId) || vendorId < 1) {
    throw new AppError("vendor_id is required", 400);
  }

  const expectedDate = parseExpectedDateInput(input.expected_date);
  const remarks = str(input.po_remarks, 2000) || null;
  const by = str(actorEmail, 100) || null;
  const normalizedLines = normalizePoLineItems(input.lines);

  const vRes = await query(
    `SELECT id, vendor_name FROM vendors WHERE id = $1`,
    [vendorId]
  );
  if (vRes.rows.length === 0) {
    throw new AppError("Vendor not found", 404);
  }
  const vendorName = vRes.rows[0].vendor_name ?? null;

  await assertSkusBelongToVendor(vendorId, normalizedLines);

  const skuCount = normalizedLines.length;
  const totalQty = normalizedLines.reduce((s, l) => s + l.quantity, 0);

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /** Allocate from a high-range sequence (10^10+) so zap-created PO ids
     * cannot collide with eAutomate's id space. Eliminates the entire class
     * of "sync brought a phantom GRN under my zap PO" bugs. */
    const seqR = await client.query(
      `SELECT nextval('vendor_purchase_orders_zap_id_seq')::bigint AS po_id`
    );
    const poId = Number(seqR.rows[0].po_id);

    await client.query(
      `INSERT INTO vendor_purchase_orders (
        po_id, vendor_id, vendor_name, expected_date, created_by, modified_by,
        created_at, updated_at, date_published, status, po_remarks,
        sku_count, total_quantity, number_of_grns, total_invoice_quantity,
        total_accepted_quantity, total_rejected_quantity, sku_fill_rate, quantity_fill_rate,
        source
      ) VALUES (
        $1, $2, $3, $4::date, $5, $5, NOW(), NOW(), NULL, 'PENDING', $6,
        $7, $8, 0, 0, 0, 0, 0, 0,
        'zap'
      )`,
      [
        poId,
        vendorId,
        vendorName,
        expectedDate.toISOString().slice(0, 10),
        by,
        remarks,
        skuCount,
        totalQty,
      ]
    );

    for (const { sku_id, quantity } of normalizedLines) {
      await client.query(
        `INSERT INTO vendor_purchase_order_lines (po_id, sku_id, quantity)
         VALUES ($1, $2, $3)`,
        [poId, sku_id, quantity]
      );
    }

    await client.query("COMMIT");

    const one = await query(
      `SELECT po.po_id, po.vendor_id, po.vendor_name, po.source, po.expected_date, po.created_by, po.modified_by,
              po.created_at, po.updated_at, po.date_published, po.status, po.po_remarks,
              po.sku_count, po.total_quantity, po.number_of_grns, po.total_invoice_quantity,
              po.total_accepted_quantity, po.total_rejected_quantity, po.sku_fill_rate, po.quantity_fill_rate
       FROM vendor_purchase_orders po WHERE po.po_id = $1`,
      [poId]
    );
    return rowToListItem(one.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
