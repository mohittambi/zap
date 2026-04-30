import { query } from "@/server/db";
import { AppError } from "@/server/errors";

function nonEmptyTrimmed(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "object") return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/**
 * DB `calculated_po_status` is often null until eAutomate sync fills it.
 * Fall back to analytics JSON and fulfilment / acknowledgement columns so list UIs are useful.
 */
function resolveDisplayedPoStatus(r: Record<string, unknown>): string | null {
  const direct = nonEmptyTrimmed(r.calculated_po_status);
  if (direct) return direct.slice(0, 120);

  const aoRaw = r.analytics_object;
  if (typeof aoRaw === "object" && aoRaw !== null && !Array.isArray(aoRaw)) {
    const ao = aoRaw as Record<string, unknown>;
    const fromAo =
      nonEmptyTrimmed(ao.calculated_po_status) ??
      nonEmptyTrimmed(ao.po_status) ??
      nonEmptyTrimmed(ao.status) ??
      nonEmptyTrimmed(ao.poStatus) ??
      nonEmptyTrimmed(ao.fulfillment_status) ??
      nonEmptyTrimmed(ao.po_fulfillment_status);
    if (fromAo) return fromAo.slice(0, 120);
  }

  const fulfil = nonEmptyTrimmed(r.po_fulfillment_status);
  if (fulfil) return fulfil.slice(0, 120);

  const ack = nonEmptyTrimmed(r.po_acknowledgement_status);
  if (ack) return ack.slice(0, 120);

  return null;
}

export type OutboundPoRow = {
  id: number;
  sold_via: string | null;
  company_id: number | null;
  po_number: string;
  delivery_city: string | null;
  delivery_address: string | null;
  billing_address: string | null;
  buyer_gstin: string | null;
  po_issue_date: string | null;
  expiry_date: string | null;
  po_type: string | null;
  po_creation_status: string | null;
  po_acknowledgement_status: string | null;
  po_fulfillment_status: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  is_wip: string | null;
  remarks: string | null;
  company_name: string | null;
  analytics_object: Record<string, unknown>;
  listings_snapshot: Record<string, unknown>;
  calculated_po_status: string | null;
  eautomate_synced_at: string | null;
};

function rowToApi(r: Record<string, unknown>): OutboundPoRow {
  const ao = r.analytics_object;
  const ls = r.listings_snapshot;
  return {
    id: Number(r.id),
    sold_via: r.sold_via as string | null,
    company_id: r.company_id != null ? Number(r.company_id) : null,
    po_number: String(r.po_number),
    delivery_city: r.delivery_city as string | null,
    delivery_address: r.delivery_address as string | null,
    billing_address: r.billing_address as string | null,
    buyer_gstin: r.buyer_gstin as string | null,
    po_issue_date: r.po_issue_date ? new Date(r.po_issue_date as string).toISOString().replace("T", " ").slice(0, 19) : null,
    expiry_date: r.expiry_date ? new Date(r.expiry_date as string).toISOString().replace("T", " ").slice(0, 19) : null,
    po_type: r.po_type as string | null,
    po_creation_status: r.po_creation_status as string | null,
    po_acknowledgement_status: r.po_acknowledgement_status as string | null,
    po_fulfillment_status: r.po_fulfillment_status as string | null,
    created_by: r.created_by as string | null,
    created_at: r.created_at ? new Date(r.created_at as string).toISOString() : null,
    updated_at: r.updated_at ? new Date(r.updated_at as string).toISOString() : null,
    is_wip: r.is_wip as string | null,
    remarks: r.remarks as string | null,
    company_name: r.company_name as string | null,
    analytics_object:
      typeof ao === "object" && ao !== null && !Array.isArray(ao)
        ? (ao as Record<string, unknown>)
        : {},
    listings_snapshot:
      typeof ls === "object" && ls !== null && !Array.isArray(ls)
        ? (ls as Record<string, unknown>)
        : {},
    calculated_po_status: resolveDisplayedPoStatus(r),
    eautomate_synced_at: r.eautomate_synced_at
      ? new Date(r.eautomate_synced_at as string).toISOString()
      : null,
  };
}

export async function listOutboundPurchaseOrders(opts: {
  page: number;
  limit: number;
  search?: string;
  wipOnly?: boolean;
  partialOnly?: boolean;
  /** When set, restrict to POs for this marketplace company */
  companyId?: number;
}) {
  const { page, limit, search, wipOnly, partialOnly, companyId } = opts;
  const offset = (page - 1) * limit;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let p = 1;

  if (wipOnly) {
    /** Match Zap web + mobile display logic (YES/yes, trimming); strict `= 'YES'` misses legacy rows. */
    conditions.push(`UPPER(TRIM(COALESCE(o.is_wip::text, ''))) = $${p}`);
    params.push("YES");
    p += 1;
  }

  if (partialOnly) {
    conditions.push(`UPPER(TRIM(COALESCE(o.po_creation_status, ''))) = 'PARTIAL'`);
  }

  if (search && search.trim()) {
    const q = `%${search.trim().toLowerCase()}%`;
    if (partialOnly) {
      conditions.push(`LOWER(o.po_number) LIKE $${p}`);
    } else {
      conditions.push(
        `(LOWER(o.po_number) LIKE $${p} OR LOWER(COALESCE(o.company_name, c.name,'')) LIKE $${p} OR LOWER(COALESCE(o.delivery_city,'')) LIKE $${p})`
      );
    }
    params.push(q);
    p += 1;
  }

  if (companyId != null && Number.isFinite(companyId) && companyId > 0) {
    conditions.push(`o.company_id = $${p}`);
    params.push(companyId);
    p += 1;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const fromPoJoinCompany = `FROM outbound_purchase_orders o
     LEFT JOIN companies c ON c.id = o.company_id`;

  const countR = await query(
    `SELECT COUNT(*)::int AS total ${fromPoJoinCompany} ${where}`,
    params
  );
  const total = countR.rows[0].total as number;

  const listR = await query(
    `SELECT o.id, o.sold_via, o.company_id, o.po_number, o.delivery_city, o.delivery_address, o.billing_address,
            o.buyer_gstin, o.po_issue_date, o.expiry_date, o.po_type, o.po_creation_status,
            o.po_acknowledgement_status, o.po_fulfillment_status, o.created_by, o.created_at, o.updated_at,
            o.is_wip, o.remarks,
            COALESCE(o.company_name, c.name) AS company_name,
            o.analytics_object, o.calculated_po_status, o.eautomate_synced_at
     ${fromPoJoinCompany}
     ${where}
     ORDER BY o.created_at DESC NULLS LAST, o.id DESC
     LIMIT $${p} OFFSET $${p + 1}`,
    [...params, limit, offset]
  );

  const content = listR.rows.map((r) => rowToApi(r as Record<string, unknown>));

  return {
    total,
    current_page: page,
    per_page_count: limit,
    curr_page_count: content.length,
    content,
  };
}

export type OutboundSoldViaOption = { code: string; label: string };

export type OutboundCompanyOption = {
  id: number;
  name: string | null;
  description: string | null;
};

export async function listOutboundSoldViaOptions(): Promise<OutboundSoldViaOption[]> {
  const r = await query(
    `SELECT code, label FROM outbound_sold_via ORDER BY id ASC`
  );
  return r.rows.map((row) => ({
    code: String(row.code),
    label: String(row.label),
  }));
}

function companyDescriptionFromAttributes(
  attributes: unknown
): string | null {
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
    return null;
  }
  const d = (attributes as Record<string, unknown>).description;
  if (d == null || d === "") return null;
  return String(d);
}

export async function listOutboundCompaniesForForm(): Promise<OutboundCompanyOption[]> {
  const r = await query(
    `SELECT id, name, attributes
     FROM companies
     WHERE COALESCE(is_active, 1) = 1
     ORDER BY name NULLS LAST, id`
  );
  return r.rows.map((row) => ({
    id: Number(row.id),
    name: row.name != null ? String(row.name) : null,
    description: companyDescriptionFromAttributes(row.attributes),
  }));
}

export type OutboundCompanyDirectoryRow = {
  id: number;
  name: string | null;
  logo_url: string | null;
  status: string | null;
  ack_pending: number;
  open_pos: number;
  expired_pos: number;
  cancelled_pos: number;
  last_po_at: string | null;
};

/** Rolled-up metrics across all companies matching the same filters as the directory list. */
export type OutboundCompanyDirectorySummary = {
  company_count: number;
  ack_pending: number;
  open_pos: number;
  expired_pos: number;
  cancelled_pos: number;
  last_po_at: string | null;
};

function companyLogoFromAttributes(attributes: unknown): string | null {
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
    return null;
  }
  const att = attributes as Record<string, unknown>;
  const raw =
    att.logo_url ?? att.logoUrl ?? att.logo ?? att.company_logo_url ?? att.companyLogoUrl;
  if (raw == null || typeof raw !== "string") return null;
  const t = raw.trim();
  return t.length ? t : null;
}

/**
 * Same per-company PO metrics as {@link listOutboundCompaniesPaginated}, aggregated for a summary strip.
 * Keep FILTER clauses in sync with the list query.
 */
async function summarizeOutboundCompaniesDirectory(
  whereSql: string,
  params: unknown[]
): Promise<OutboundCompanyDirectorySummary> {
  const r = await query(
    `WITH roll AS (
       SELECT
         MAX(o.updated_at) AS last_po_at,
         COUNT(o.id) FILTER (
           WHERE (o.expiry_date IS NULL OR o.expiry_date >= NOW())
             AND COALESCE(UPPER(TRIM(o.calculated_po_status)), '') NOT IN (
               'EXPIRED', 'CANCELLED', 'CLOSED', 'COMPLETED', 'DELIVERED', 'CANCEL'
             )
             AND NOT (COALESCE(o.calculated_po_status, '') ILIKE '%expir%')
             AND NOT (COALESCE(o.calculated_po_status, '') ILIKE '%cancel%')
             AND NOT (COALESCE(o.calculated_po_status, '') ILIKE '%clos%')
             AND NOT (COALESCE(o.calculated_po_status, '') ILIKE '%complet%')
             AND NOT (COALESCE(o.calculated_po_status, '') ILIKE '%deliver%')
         )::int AS open_pos,
         COUNT(o.id) FILTER (
           WHERE o.expiry_date IS NOT NULL AND o.expiry_date < NOW()
         )::int AS expired_pos,
         COUNT(o.id) FILTER (
           WHERE COALESCE(o.calculated_po_status, '') ILIKE '%CANCEL%'
              OR COALESCE(UPPER(TRIM(o.calculated_po_status)), '') IN ('CANCELLED', 'CANCEL')
         )::int AS cancelled_pos,
         COUNT(o.id) FILTER (
           WHERE COALESCE(o.po_acknowledgement_status, '') ILIKE '%PENDING%'
              OR UPPER(TRIM(COALESCE(o.po_acknowledgement_status, ''))) IN ('NO', 'N', 'UNACK', 'PENDING')
         )::int AS ack_pending
       FROM companies c
       LEFT JOIN outbound_purchase_orders o ON o.company_id = c.id
       ${whereSql}
       GROUP BY c.id, c.name, c.attributes
     )
     SELECT
       COUNT(*)::int AS company_count,
       COALESCE(SUM(roll.open_pos), 0)::int AS open_pos,
       COALESCE(SUM(roll.expired_pos), 0)::int AS expired_pos,
       COALESCE(SUM(roll.cancelled_pos), 0)::int AS cancelled_pos,
       COALESCE(SUM(roll.ack_pending), 0)::int AS ack_pending,
       MAX(roll.last_po_at) AS last_po_at
     FROM roll`,
    params
  );
  const row = r.rows[0] as Record<string, unknown>;
  return {
    company_count: Number(row.company_count) || 0,
    ack_pending: Number(row.ack_pending) || 0,
    open_pos: Number(row.open_pos) || 0,
    expired_pos: Number(row.expired_pos) || 0,
    cancelled_pos: Number(row.cancelled_pos) || 0,
    last_po_at:
      row.last_po_at != null ? new Date(row.last_po_at as string).toISOString() : null,
  };
}

/** Paginated companies + PO rollups — used by mobile Outbound journey (All Companies). */
export async function listOutboundCompaniesPaginated(opts: {
  page: number;
  limit: number;
  search?: string;
}): Promise<{
  total: number;
  current_page: number;
  per_page_count: number;
  curr_page_count: number;
  content: OutboundCompanyDirectoryRow[];
  summary: OutboundCompanyDirectorySummary;
}> {
  const { page, limit } = opts;
  const offset = (page - 1) * limit;
  /** Include inactive rows if they still have outbound POs (web PO lists show those POs). */
  const conditions: string[] = [
    "(COALESCE(c.is_active, 1) = 1 OR EXISTS (SELECT 1 FROM outbound_purchase_orders o2 WHERE o2.company_id = c.id))",
  ];
  const params: unknown[] = [];
  let p = 1;

  if (opts.search && opts.search.trim()) {
    const q = `%${opts.search.trim().toLowerCase()}%`;
    conditions.push(
      `(LOWER(c.name) LIKE $${p} OR CAST(c.id AS TEXT) LIKE $${p} OR LOWER(COALESCE(c.code_primary,'')) LIKE $${p})`
    );
    params.push(q);
    p += 1;
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const countR = await query(`SELECT COUNT(*)::int AS n FROM companies c ${whereSql}`, params);
  const total = countR.rows[0].n as number;

  const summary = await summarizeOutboundCompaniesDirectory(whereSql, params);

  const listR = await query(
    `SELECT
       c.id,
       c.name,
       c.attributes,
       MAX(o.updated_at) AS last_po_at,
       COUNT(o.id) FILTER (
         WHERE (o.expiry_date IS NULL OR o.expiry_date >= NOW())
           AND COALESCE(UPPER(TRIM(o.calculated_po_status)), '') NOT IN (
             'EXPIRED', 'CANCELLED', 'CLOSED', 'COMPLETED', 'DELIVERED', 'CANCEL'
           )
           AND NOT (COALESCE(o.calculated_po_status, '') ILIKE '%expir%')
           AND NOT (COALESCE(o.calculated_po_status, '') ILIKE '%cancel%')
           AND NOT (COALESCE(o.calculated_po_status, '') ILIKE '%clos%')
           AND NOT (COALESCE(o.calculated_po_status, '') ILIKE '%complet%')
           AND NOT (COALESCE(o.calculated_po_status, '') ILIKE '%deliver%')
       )::int AS open_pos,
       COUNT(o.id) FILTER (
         WHERE o.expiry_date IS NOT NULL AND o.expiry_date < NOW()
       )::int AS expired_pos,
       COUNT(o.id) FILTER (
         WHERE COALESCE(o.calculated_po_status, '') ILIKE '%CANCEL%'
            OR COALESCE(UPPER(TRIM(o.calculated_po_status)), '') IN ('CANCELLED', 'CANCEL')
       )::int AS cancelled_pos,
       COUNT(o.id) FILTER (
         WHERE COALESCE(o.po_acknowledgement_status, '') ILIKE '%PENDING%'
            OR UPPER(TRIM(COALESCE(o.po_acknowledgement_status, ''))) IN ('NO', 'N', 'UNACK', 'PENDING')
       )::int AS ack_pending
     FROM companies c
     LEFT JOIN outbound_purchase_orders o ON o.company_id = c.id
     ${whereSql}
     GROUP BY c.id, c.name, c.attributes
     ORDER BY c.name NULLS LAST, c.id ASC
     LIMIT $${p} OFFSET $${p + 1}`,
    [...params, limit, offset]
  );

  const content: OutboundCompanyDirectoryRow[] = listR.rows.map((row) => {
    const r = row as Record<string, unknown>;
    const attr = r.attributes;
    return {
      id: Number(r.id),
      name: r.name != null ? String(r.name) : null,
      logo_url: companyLogoFromAttributes(attr),
      status: null,
      ack_pending: Number(r.ack_pending) || 0,
      open_pos: Number(r.open_pos) || 0,
      expired_pos: Number(r.expired_pos) || 0,
      cancelled_pos: Number(r.cancelled_pos) || 0,
      last_po_at: r.last_po_at != null ? new Date(r.last_po_at as string).toISOString() : null,
    };
  });

  return {
    total,
    current_page: page,
    per_page_count: limit,
    curr_page_count: content.length,
    content,
    summary,
  };
}

export async function createOutboundPurchaseOrderRow(input: {
  sold_via: string;
  company_id: number;
  delivery_city: string;
  delivery_address: string;
  billing_address: string;
  buyer_gstin: string | null;
  po_issue_date: Date;
  expiry_date: Date;
  po_type: string;
  company_name: string | null;
  created_by: string | null;
}): Promise<{ id: number; po_number: string }> {
  const idR = await query(
    `SELECT COALESCE(MAX(id), 0)::bigint AS m FROM outbound_purchase_orders`
  );
  const nextId = BigInt(String(idR.rows[0].m)) + BigInt(1);
  const po_number = `ZAP-PO-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

  await query(
    `INSERT INTO outbound_purchase_orders (
       id, sold_via, company_id, po_number, delivery_city, delivery_address, billing_address,
       buyer_gstin, po_issue_date, expiry_date, po_type, po_creation_status,
       created_by, created_at, updated_at, is_wip, company_name, analytics_object
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW(), $14, $15, '{}'::jsonb
     )`,
    [
      nextId.toString(),
      input.sold_via,
      input.company_id,
      po_number,
      input.delivery_city,
      input.delivery_address,
      input.billing_address,
      input.buyer_gstin,
      input.po_issue_date,
      input.expiry_date,
      input.po_type,
      "SUBMITTED",
      input.created_by,
      "YES",
      input.company_name,
    ]
  );

  return { id: Number(nextId), po_number };
}

export async function insertOutboundPoAttachment(input: {
  outbound_po_id: number;
  original_filename: string;
  content_type: string | null;
  size_bytes: number;
  stored_path: string;
  kind: string;
}): Promise<void> {
  await query(
    `INSERT INTO outbound_po_attachments (
       outbound_po_id, original_filename, content_type, size_bytes, stored_path, kind
     ) VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      input.outbound_po_id,
      input.original_filename.slice(0, 500),
      input.content_type,
      input.size_bytes,
      input.stored_path,
      input.kind,
    ]
  );
}

export async function deleteOutboundPurchaseOrderById(id: number): Promise<void> {
  await query(`DELETE FROM outbound_purchase_orders WHERE id = $1`, [id]);
}

export async function getOutboundPurchaseOrderById(
  id: number
): Promise<OutboundPoRow | null> {
  if (!Number.isFinite(id) || id < 1) return null;
  const r = await query(
    `SELECT id, sold_via, company_id, po_number, delivery_city, delivery_address, billing_address,
            buyer_gstin, po_issue_date, expiry_date, po_type, po_creation_status,
            po_acknowledgement_status, po_fulfillment_status, created_by, created_at, updated_at,
            is_wip, remarks, company_name, analytics_object, listings_snapshot, calculated_po_status, eautomate_synced_at
     FROM outbound_purchase_orders WHERE id = $1 LIMIT 1`,
    [id]
  );
  if (r.rows.length === 0) return null;
  return rowToApi(r.rows[0] as Record<string, unknown>);
}

export type OutboundPoEditableField =
  | "po_type"
  | "delivery_city"
  | "delivery_address"
  | "billing_address"
  | "expiry_date"
  | "remarks";

/** Patch a single editable PO column (Zap DB); does not call eAutomate. */
export async function patchOutboundPurchaseOrderField(
  id: number,
  field: OutboundPoEditableField,
  value: string | null
): Promise<void> {
  if (!Number.isFinite(id) || id < 1) {
    throw new AppError("Invalid PO id", 400);
  }
  let sqlVal: unknown;
  if (field === "expiry_date") {
    if (value == null || !String(value).trim()) {
      sqlVal = null;
    } else {
      const d = new Date(String(value).trim());
      sqlVal = Number.isNaN(d.getTime()) ? null : d;
    }
  } else if (value != null) {
    const s = String(value).trim();
    if (field === "remarks") {
      sqlVal = s;
    } else if (field === "delivery_address" || field === "billing_address") {
      sqlVal = s.slice(0, 20_000);
    } else if (field === "po_type") {
      sqlVal = s.slice(0, 80);
    } else if (field === "delivery_city") {
      sqlVal = s.slice(0, 120);
    } else {
      sqlVal = s;
    }
  } else {
    sqlVal = null;
  }

  const colSql: Record<OutboundPoEditableField, string> = {
    po_type: "po_type",
    delivery_city: "delivery_city",
    delivery_address: "delivery_address",
    billing_address: "billing_address",
    expiry_date: "expiry_date",
    remarks: "remarks",
  };
  const column = colSql[field];
  await query(
    `UPDATE outbound_purchase_orders SET ${column} = $2, updated_at = NOW() WHERE id = $1`,
    [id, sqlVal]
  );
}

/** Mark PO as acknowledged in local DB (reference-system independent). */
export async function acknowledgeOutboundPo(id: number): Promise<void> {
  if (!Number.isFinite(id) || id < 1) {
    throw new AppError("Invalid PO id", 400);
  }
  await query(
    `UPDATE outbound_purchase_orders
     SET po_acknowledgement_status = 'YES', updated_at = NOW()
     WHERE id = $1`,
    [id]
  );
}

/** Mark PO as cancelled in local DB (reference-system independent). */
export async function cancelOutboundPo(id: number): Promise<void> {
  if (!Number.isFinite(id) || id < 1) {
    throw new AppError("Invalid PO id", 400);
  }
  await query(
    `UPDATE outbound_purchase_orders
     SET calculated_po_status = 'CANCELLED',
         po_fulfillment_status = 'CANCELLED',
         updated_at = NOW()
     WHERE id = $1`,
    [id]
  );
}

export async function updateOutboundPoListingsSnapshot(
  outboundPoId: number,
  snapshot: unknown
): Promise<void> {
  if (!Number.isFinite(outboundPoId) || outboundPoId < 1) return;
  const json =
    snapshot && typeof snapshot === "object"
      ? JSON.stringify(snapshot)
      : "{}";
  await query(
    `UPDATE outbound_purchase_orders SET listings_snapshot = $2::jsonb WHERE id = $1`,
    [outboundPoId, json]
  );
}

/**
 * Line-item rows from `listings_snapshot` (eAutomate paginated envelope stored as JSON, or legacy shapes).
 */
export function extractListingsRowsFromSnapshot(
  snapshot: unknown
): Record<string, unknown>[] {
  if (snapshot == null) {
    return [];
  }
  if (Array.isArray(snapshot)) {
    return snapshot as Record<string, unknown>[];
  }
  if (typeof snapshot !== "object") {
    return [];
  }
  const o = snapshot as Record<string, unknown>;
  for (const k of ["content", "items", "data", "rows", "results"] as const) {
    const a = o[k];
    if (Array.isArray(a)) {
      return a as Record<string, unknown>[];
    }
  }
  return [];
}

function csvEscapeCell(cell: string): string {
  if (/[",\n\r]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

function csvCellValue(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

/**
 * SKU / line listing export from cached `listings_snapshot` (same rows as the PO line-items UI).
 * UTF-8 BOM prefix helps Excel open UTF-8 CSV correctly on Windows.
 */
type SkuReportColumn =
  | "buyer_name"
  | "po_number"
  | "po_release_date"
  | "po_expiry_date"
  | "po_addition_date"
  | "po_type"
  | "delivery_location"
  | "po_secondary_sku"
  | "master_sku"
  | "inventory_sku_id"
  | "pack_combo_sku_id"
  | "sku_type"
  | "company_code_primary"
  | "company_code_secondary"
  | "title"
  | "mrp"
  | "rate_without_tax"
  | "tax_rate"
  | "hsn"
  | "size"
  | "color"
  | "ops_tag"
  | "warehouse_quantity"
  | "demand"
  | "packed"
  | "dispatched"
  | "pending"
  | "fill_rate_percent";

const SKU_REPORT_COLUMNS: SkuReportColumn[] = [
  "buyer_name",
  "po_number",
  "po_release_date",
  "po_expiry_date",
  "po_addition_date",
  "po_type",
  "delivery_location",
  "po_secondary_sku",
  "master_sku",
  "inventory_sku_id",
  "pack_combo_sku_id",
  "sku_type",
  "company_code_primary",
  "company_code_secondary",
  "title",
  "mrp",
  "rate_without_tax",
  "tax_rate",
  "hsn",
  "size",
  "color",
  "ops_tag",
  "warehouse_quantity",
  "demand",
  "packed",
  "dispatched",
  "pending",
  "fill_rate_percent",
];

function numberFromUnknown(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function reportCellFromRow(
  row: Record<string, unknown>,
  po: OutboundPoRow,
  col: SkuReportColumn
): string {
  if (col === "buyer_name") return csvCellValue(po.company_name ?? row.buyer_name);
  if (col === "po_number") return csvCellValue(po.po_number);
  if (col === "po_release_date") return csvCellValue(po.po_issue_date);
  if (col === "po_expiry_date") return csvCellValue(po.expiry_date);
  if (col === "po_addition_date") return csvCellValue(row.po_addition_date ?? po.created_at);
  if (col === "po_type") return csvCellValue(po.po_type);
  if (col === "delivery_location") {
    return csvCellValue(row.delivery_location ?? po.delivery_city);
  }
  if (col === "pending") {
    const explicit = numberFromUnknown(row.pending);
    if (explicit != null) return String(explicit);
    const demand = numberFromUnknown(row.demand) ?? 0;
    const packed = numberFromUnknown(row.packed) ?? 0;
    const dispatched = numberFromUnknown(row.dispatched) ?? 0;
    return String(demand - (packed + dispatched));
  }
  return csvCellValue(row[col]);
}

export function outboundPoListingsSnapshotToCsv(
  snapshot: unknown,
  po: OutboundPoRow
): string {
  const rows = extractListingsRowsFromSnapshot(snapshot);
  const lines: string[] = [];

  if (rows.length === 0) {
    return `\ufeff${csvEscapeCell("message")}\n${csvEscapeCell(
      "No line items in listings_snapshot. Sync this PO from eCraft (PO detail) or upload a received PO spreadsheet to populate listings."
    )}`;
  }

  lines.push(SKU_REPORT_COLUMNS.map((h) => csvEscapeCell(h)).join(","));
  for (const row of rows) {
    const obj = row as Record<string, unknown>;
    lines.push(
      SKU_REPORT_COLUMNS.map((h) =>
        csvEscapeCell(reportCellFromRow(obj, po, h))
      ).join(",")
    );
  }
  return `\ufeff${lines.join("\n")}`;
}

function filterListingsRowsBySearch(
  rows: Record<string, unknown>[],
  search: string | undefined
): Record<string, unknown>[] {
  const t = search?.trim().toLowerCase();
  if (!t) {
    return rows;
  }
  return rows.filter((row) => {
    try {
      return JSON.stringify(row).toLowerCase().includes(t);
    } catch {
      return false;
    }
  });
}

/**
 * Paginated slice of PO line items (from snapshot rows). Matches Zap list envelope fields.
 */
export function paginateOutboundPoLineItemRows(opts: {
  rows: Record<string, unknown>[];
  page: number;
  limit: number;
}): {
  total: number;
  current_page: number;
  per_page_count: number;
  curr_page_count: number;
  content: Record<string, unknown>[];
} {
  const { rows, page, limit } = opts;
  const total = rows.length;
  const offset = (page - 1) * limit;
  const content = rows.slice(offset, offset + limit);
  return {
    total,
    current_page: page,
    per_page_count: limit,
    curr_page_count: content.length,
    content,
  };
}

/** Build paginated items payload from `listings_snapshot` (used by GET …/purchase-orders/:id/items). */
export function buildOutboundPoItemsPayloadFromSnapshot(
  snapshot: unknown,
  opts: { page: number; limit: number; search?: string }
): {
  total: number;
  current_page: number;
  per_page_count: number;
  curr_page_count: number;
  content: Record<string, unknown>[];
} {
  const all = extractListingsRowsFromSnapshot(snapshot);
  const filtered = filterListingsRowsBySearch(all, opts.search);
  return paginateOutboundPoLineItemRows({
    rows: filtered,
    page: opts.page,
    limit: opts.limit,
  });
}

export type OutboundPoEautomateFileRow = {
  eautomate_file_id: number;
  file_name: string;
  file_uploaded_by: string | null;
  created_at: string | null;
  file_type: string | null;
  zap_storage_path: string | null;
};

export async function listOutboundPoEautomateFiles(
  outboundPoId: number
): Promise<OutboundPoEautomateFileRow[]> {
  const r = await query(
    `SELECT eautomate_file_id, file_name, file_uploaded_by, created_at, file_type, zap_storage_path
     FROM outbound_po_eautomate_files
     WHERE outbound_po_id = $1
     ORDER BY eautomate_file_id ASC`,
    [outboundPoId]
  );
  return r.rows.map((row) => ({
    eautomate_file_id: Number(row.eautomate_file_id),
    file_name: String(row.file_name),
    file_uploaded_by:
      row.file_uploaded_by != null ? String(row.file_uploaded_by) : null,
    created_at: row.created_at
      ? new Date(row.created_at as string).toISOString()
      : null,
    file_type: row.file_type != null ? String(row.file_type) : null,
    zap_storage_path:
      row.zap_storage_path != null ? String(row.zap_storage_path) : null,
  }));
}

/** Zap-uploaded file (negative eautomate_file_id key space). */
export async function insertOutboundPoZapStoredFile(
  outboundPoId: number,
  opts: {
    file_name: string;
    zap_storage_path: string;
    uploaded_by: string | null;
  }
): Promise<number> {
  const po = await query(
    `SELECT po_number FROM outbound_purchase_orders WHERE id = $1`,
    [outboundPoId]
  );
  if (po.rows.length === 0) throw new AppError("Outbound PO not found", 404);
  const po_number = String(po.rows[0].po_number);

  const negR = await query(
    `SELECT COALESCE(MIN(eautomate_file_id), 0) - 1 AS next_id
     FROM outbound_po_eautomate_files
     WHERE outbound_po_id = $1 AND eautomate_file_id < 0`,
    [outboundPoId]
  );
  const fid = Number(negR.rows[0].next_id);

  await query(
    `INSERT INTO outbound_po_eautomate_files (
      eautomate_file_id, outbound_po_id, po_number, file_name, zap_storage_path,
      file_uploaded_by, created_at, updated_at, raw
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), $7::jsonb)`,
    [
      fid,
      outboundPoId,
      po_number.slice(0, 80),
      opts.file_name.slice(0, 500),
      opts.zap_storage_path,
      opts.uploaded_by,
      JSON.stringify({ source: "zap_storage_upload" }),
    ]
  );
  return fid;
}

export type OutboundPoZapAttachmentRow = {
  id: number;
  original_filename: string;
  content_type: string | null;
  size_bytes: number;
  kind: string;
  created_at: string | null;
};

export async function listOutboundPoZapAttachments(
  outboundPoId: number
): Promise<OutboundPoZapAttachmentRow[]> {
  const r = await query(
    `SELECT id, original_filename, content_type, size_bytes, kind, created_at
     FROM outbound_po_attachments
     WHERE outbound_po_id = $1
     ORDER BY id ASC`,
    [outboundPoId]
  );
  return r.rows.map((row) => ({
    id: Number(row.id),
    original_filename: String(row.original_filename),
    content_type: row.content_type != null ? String(row.content_type) : null,
    size_bytes: Number(row.size_bytes),
    kind: String(row.kind ?? "other"),
    created_at: row.created_at
      ? new Date(row.created_at as string).toISOString()
      : null,
  }));
}

/** Delete only when po_creation_status is PARTIAL (eCraft partial PO). */
export async function deleteOutboundPartialPurchaseOrderById(
  id: number
): Promise<{ deleted: boolean }> {
  const r = await query(
    `DELETE FROM outbound_purchase_orders
     WHERE id = $1 AND UPPER(TRIM(COALESCE(po_creation_status, ''))) = 'PARTIAL'
     RETURNING id`,
    [id]
  );
  return { deleted: (r.rowCount ?? 0) > 0 };
}

export async function replaceOutboundPoEautomateFiles(
  outboundPoId: number,
  poNumber: string,
  rows: unknown[]
): Promise<void> {
  await query(`DELETE FROM outbound_po_eautomate_files WHERE outbound_po_id = $1`, [
    outboundPoId,
  ]);
  const pn = poNumber.slice(0, 80);
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const fid = Number(r.id);
    if (!Number.isFinite(fid) || fid < 1) continue;
    const consignment_id =
      r.consignment_id != null && r.consignment_id !== ""
        ? Math.trunc(Number(r.consignment_id))
        : null;
    const invoice_id =
      r.invoice_id != null && r.invoice_id !== ""
        ? Math.trunc(Number(r.invoice_id))
        : null;
    const appointment_id =
      r.appointment_id != null && r.appointment_id !== ""
        ? Math.trunc(Number(r.appointment_id))
        : null;
    const file_type =
      r.file_type != null ? String(r.file_type).slice(0, 80) : null;
    const file_name =
      r.file_name != null ? String(r.file_name).slice(0, 500) : `file-${fid}`;
    const saved_file_name =
      r.saved_file_name != null ? String(r.saved_file_name).slice(0, 500) : null;
    const file_path = r.file_path != null ? String(r.file_path) : null;
    const file_uploaded_by =
      r.file_uploaded_by != null ? String(r.file_uploaded_by).slice(0, 120) : null;
    const created_at = parseEautomateTimestamp(r.created_at);
    const updated_at = parseEautomateTimestamp(r.updated_at);
    await query(
      `INSERT INTO outbound_po_eautomate_files (
        eautomate_file_id, outbound_po_id, po_number, consignment_id, invoice_id, appointment_id,
        file_type, file_name, saved_file_name, file_path, file_uploaded_by, created_at, updated_at, raw
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`,
      [
        fid,
        outboundPoId,
        pn,
        consignment_id,
        invoice_id,
        appointment_id,
        file_type,
        file_name,
        saved_file_name,
        file_path,
        file_uploaded_by,
        created_at,
        updated_at,
        JSON.stringify(row),
      ]
    );
  }
}

/** Parse eAutomate "YYYY-MM-DD HH:mm:ss" or ISO timestamps into a Date for TIMESTAMPTZ. */
function parseEautomateTimestamp(v: unknown): Date | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}):(\d{2}))?/
  );
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const hh = m[4] != null ? Number(m[4]) : 0;
    const mi = m[5] != null ? Number(m[5]) : 0;
    const ss = m[6] != null ? Number(m[6]) : 0;
    return new Date(Date.UTC(y, mo - 1, d, hh, mi, ss));
  }
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

/**
 * Upsert one row from GET /public/api/incoming_purchase_orders/partial.
 * Uses eAutomate `id` as primary key. Preserves analytics_object and calculated_po_status on update.
 * On unique po_number conflict (different existing id), updates by po_number and keeps DB id.
 */
export async function upsertOutboundPoFromEautomatePartial(
  raw: Record<string, unknown>
): Promise<void> {
  const id = Number(raw.id);
  if (!Number.isFinite(id) || id < 1) {
    throw new Error("eAutomate partial PO row missing positive numeric id");
  }
  const po_number = String(raw.po_number ?? "")
    .trim()
    .slice(0, 80);
  if (!po_number) throw new Error("eAutomate partial PO row missing po_number");

  const sold_via =
    raw.sold_via != null && String(raw.sold_via).trim() !== ""
      ? String(raw.sold_via).slice(0, 80)
      : null;
  let company_id =
    raw.company_id != null &&
    raw.company_id !== "" &&
    Number.isFinite(Number(raw.company_id))
      ? Math.trunc(Number(raw.company_id))
      : null;
  if (company_id != null) {
    const chk = await query(`SELECT 1 AS ok FROM companies WHERE id = $1 LIMIT 1`, [
      company_id,
    ]);
    if (chk.rows.length === 0) company_id = null;
  }
  const delivery_city =
    raw.delivery_city != null ? String(raw.delivery_city).slice(0, 120) : null;
  const delivery_address =
    raw.delivery_address != null ? String(raw.delivery_address) : null;
  const billing_address =
    raw.billing_address != null ? String(raw.billing_address) : null;
  const buyer_gstin =
    raw.buyer_gstin != null ? String(raw.buyer_gstin).slice(0, 32) : null;
  const po_issue_date = parseEautomateTimestamp(raw.po_issue_date);
  const expiry_date = parseEautomateTimestamp(raw.expiry_date);
  let po_type =
    raw.po_type != null && String(raw.po_type).trim() !== ""
      ? String(raw.po_type).slice(0, 80)
      : null;
  if (po_type) po_type = po_type.replace(/\\\//g, "/");
  const po_creation_status =
    raw.po_creation_status != null
      ? String(raw.po_creation_status).slice(0, 80)
      : null;
  const po_acknowledgement_status =
    raw.po_acknowledgement_status != null
      ? String(raw.po_acknowledgement_status).slice(0, 80)
      : null;
  const po_fulfillment_status =
    raw.po_fulfillment_status != null
      ? String(raw.po_fulfillment_status).slice(0, 80)
      : null;
  const created_by =
    raw.created_by != null ? String(raw.created_by).slice(0, 120) : null;
  const created_at = parseEautomateTimestamp(raw.created_at);
  const updated_at = parseEautomateTimestamp(raw.updated_at);
  const is_wip =
    raw.is_wip != null ? String(raw.is_wip).slice(0, 10) : null;
  const remarks = raw.remarks != null ? String(raw.remarks) : null;
  const company_name =
    raw.company_name != null ? String(raw.company_name).slice(0, 220) : null;

  const eautomate_raw = JSON.stringify(raw ?? {});

  const paramsInsert: unknown[] = [
    id,
    sold_via,
    company_id,
    po_number,
    delivery_city,
    delivery_address,
    billing_address,
    buyer_gstin,
    po_issue_date,
    expiry_date,
    po_type,
    po_creation_status,
    po_acknowledgement_status,
    po_fulfillment_status,
    created_by,
    created_at,
    updated_at,
    is_wip,
    remarks,
    company_name,
    eautomate_raw,
  ];

  const insertSql = `
INSERT INTO outbound_purchase_orders (
  id, sold_via, company_id, po_number, delivery_city, delivery_address, billing_address,
  buyer_gstin, po_issue_date, expiry_date, po_type,
  po_creation_status, po_acknowledgement_status, po_fulfillment_status,
  created_by, created_at, updated_at, is_wip, remarks, company_name,
  analytics_object, calculated_po_status, eautomate_raw, eautomate_synced_at
) VALUES (
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20, '{}'::jsonb, NULL, $21::jsonb, NOW()
)
ON CONFLICT (id) DO UPDATE SET
  sold_via = EXCLUDED.sold_via,
  company_id = EXCLUDED.company_id,
  po_number = EXCLUDED.po_number,
  delivery_city = EXCLUDED.delivery_city,
  delivery_address = EXCLUDED.delivery_address,
  billing_address = EXCLUDED.billing_address,
  buyer_gstin = EXCLUDED.buyer_gstin,
  po_issue_date = EXCLUDED.po_issue_date,
  expiry_date = EXCLUDED.expiry_date,
  po_type = EXCLUDED.po_type,
  po_creation_status = EXCLUDED.po_creation_status,
  po_acknowledgement_status = EXCLUDED.po_acknowledgement_status,
  po_fulfillment_status = EXCLUDED.po_fulfillment_status,
  created_by = EXCLUDED.created_by,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at,
  is_wip = EXCLUDED.is_wip,
  remarks = EXCLUDED.remarks,
  company_name = EXCLUDED.company_name,
  analytics_object = outbound_purchase_orders.analytics_object,
  calculated_po_status = outbound_purchase_orders.calculated_po_status,
  eautomate_raw = EXCLUDED.eautomate_raw,
  eautomate_synced_at = EXCLUDED.eautomate_synced_at`;

  try {
    await query(insertSql, paramsInsert);
  } catch (e: unknown) {
    const err = e as { code?: string; constraint?: string };
    if (err.code === "23505" && String(err.constraint || "").includes("po_number")) {
      const updateSql = `
UPDATE outbound_purchase_orders SET
  sold_via = $2,
  company_id = $3,
  delivery_city = $4,
  delivery_address = $5,
  billing_address = $6,
  buyer_gstin = $7,
  po_issue_date = $8,
  expiry_date = $9,
  po_type = $10,
  po_creation_status = $11,
  po_acknowledgement_status = $12,
  po_fulfillment_status = $13,
  created_by = $14,
  created_at = $15,
  updated_at = $16,
  is_wip = $17,
  remarks = $18,
  company_name = $19,
  eautomate_raw = $20::jsonb,
  eautomate_synced_at = NOW()
WHERE po_number = $1`;
      await query(updateSql, [
        po_number,
        sold_via,
        company_id,
        delivery_city,
        delivery_address,
        billing_address,
        buyer_gstin,
        po_issue_date,
        expiry_date,
        po_type,
        po_creation_status,
        po_acknowledgement_status,
        po_fulfillment_status,
        created_by,
        created_at,
        updated_at,
        is_wip,
        remarks,
        company_name,
        eautomate_raw,
      ]);
      return;
    }
    throw e;
  }
}

/**
 * Upsert from GET /public/api/incoming_purchase_orders/{po_number} (full detail).
 * Overwrites analytics_object and calculated_po_status from eAutomate.
 */
export async function upsertOutboundPoFromEautomateDetail(
  raw: Record<string, unknown>
): Promise<void> {
  const id = Number(raw.id);
  if (!Number.isFinite(id) || id < 1) {
    throw new Error("eAutomate PO detail missing positive numeric id");
  }
  const po_number = String(raw.po_number ?? "")
    .trim()
    .slice(0, 80);
  if (!po_number) throw new Error("eAutomate PO detail missing po_number");

  const sold_via =
    raw.sold_via != null && String(raw.sold_via).trim() !== ""
      ? String(raw.sold_via).slice(0, 80)
      : null;
  let company_id =
    raw.company_id != null &&
    raw.company_id !== "" &&
    Number.isFinite(Number(raw.company_id))
      ? Math.trunc(Number(raw.company_id))
      : null;
  if (company_id != null) {
    const chk = await query(`SELECT 1 AS ok FROM companies WHERE id = $1 LIMIT 1`, [
      company_id,
    ]);
    if (chk.rows.length === 0) company_id = null;
  }
  const delivery_city =
    raw.delivery_city != null ? String(raw.delivery_city).slice(0, 120) : null;
  const delivery_address =
    raw.delivery_address != null ? String(raw.delivery_address) : null;
  const billing_address =
    raw.billing_address != null ? String(raw.billing_address) : null;
  const buyer_gstin =
    raw.buyer_gstin != null ? String(raw.buyer_gstin).slice(0, 32) : null;
  const po_issue_date = parseEautomateTimestamp(raw.po_issue_date);
  const expiry_date = parseEautomateTimestamp(raw.expiry_date);
  let po_type =
    raw.po_type != null && String(raw.po_type).trim() !== ""
      ? String(raw.po_type).slice(0, 80)
      : null;
  if (po_type) po_type = po_type.replace(/\\\//g, "/");
  const po_creation_status =
    raw.po_creation_status != null
      ? String(raw.po_creation_status).slice(0, 80)
      : null;
  const po_acknowledgement_status =
    raw.po_acknowledgement_status != null
      ? String(raw.po_acknowledgement_status).slice(0, 80)
      : null;
  const po_fulfillment_status =
    raw.po_fulfillment_status != null
      ? String(raw.po_fulfillment_status).slice(0, 80)
      : null;
  const created_by =
    raw.created_by != null ? String(raw.created_by).slice(0, 120) : null;
  const created_at = parseEautomateTimestamp(raw.created_at);
  const updated_at = parseEautomateTimestamp(raw.updated_at);
  const is_wip =
    raw.is_wip != null ? String(raw.is_wip).slice(0, 10) : null;
  const remarks = raw.remarks != null ? String(raw.remarks) : null;
  const company_name =
    raw.company_name != null ? String(raw.company_name).slice(0, 220) : null;

  const ao = raw.analytics_object;
  const analyticsJson =
    ao && typeof ao === "object" && !Array.isArray(ao)
      ? JSON.stringify(ao)
      : "{}";
  const calculated_po_status =
    raw.calculated_po_status != null
      ? String(raw.calculated_po_status).slice(0, 120)
      : null;

  const eautomate_raw = JSON.stringify(raw ?? {});

  const paramsInsert: unknown[] = [
    id,
    sold_via,
    company_id,
    po_number,
    delivery_city,
    delivery_address,
    billing_address,
    buyer_gstin,
    po_issue_date,
    expiry_date,
    po_type,
    po_creation_status,
    po_acknowledgement_status,
    po_fulfillment_status,
    created_by,
    created_at,
    updated_at,
    is_wip,
    remarks,
    company_name,
    analyticsJson,
    calculated_po_status,
    eautomate_raw,
  ];

  const insertSql = `
INSERT INTO outbound_purchase_orders (
  id, sold_via, company_id, po_number, delivery_city, delivery_address, billing_address,
  buyer_gstin, po_issue_date, expiry_date, po_type,
  po_creation_status, po_acknowledgement_status, po_fulfillment_status,
  created_by, created_at, updated_at, is_wip, remarks, company_name,
  analytics_object, calculated_po_status, eautomate_raw, eautomate_synced_at
) VALUES (
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
  $21::jsonb, $22, $23::jsonb, NOW()
)
ON CONFLICT (id) DO UPDATE SET
  sold_via = EXCLUDED.sold_via,
  company_id = EXCLUDED.company_id,
  po_number = EXCLUDED.po_number,
  delivery_city = EXCLUDED.delivery_city,
  delivery_address = EXCLUDED.delivery_address,
  billing_address = EXCLUDED.billing_address,
  buyer_gstin = EXCLUDED.buyer_gstin,
  po_issue_date = EXCLUDED.po_issue_date,
  expiry_date = EXCLUDED.expiry_date,
  po_type = EXCLUDED.po_type,
  po_creation_status = EXCLUDED.po_creation_status,
  po_acknowledgement_status = EXCLUDED.po_acknowledgement_status,
  po_fulfillment_status = EXCLUDED.po_fulfillment_status,
  created_by = EXCLUDED.created_by,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at,
  is_wip = EXCLUDED.is_wip,
  remarks = EXCLUDED.remarks,
  company_name = EXCLUDED.company_name,
  analytics_object = EXCLUDED.analytics_object,
  calculated_po_status = EXCLUDED.calculated_po_status,
  eautomate_raw = EXCLUDED.eautomate_raw,
  eautomate_synced_at = EXCLUDED.eautomate_synced_at`;

  try {
    await query(insertSql, paramsInsert);
  } catch (e: unknown) {
    const err = e as { code?: string; constraint?: string };
    if (err.code === "23505" && String(err.constraint || "").includes("po_number")) {
      const updateSql = `
UPDATE outbound_purchase_orders SET
  sold_via = $2,
  company_id = $3,
  delivery_city = $4,
  delivery_address = $5,
  billing_address = $6,
  buyer_gstin = $7,
  po_issue_date = $8,
  expiry_date = $9,
  po_type = $10,
  po_creation_status = $11,
  po_acknowledgement_status = $12,
  po_fulfillment_status = $13,
  created_by = $14,
  created_at = $15,
  updated_at = $16,
  is_wip = $17,
  remarks = $18,
  company_name = $19,
  analytics_object = $20::jsonb,
  calculated_po_status = $21,
  eautomate_raw = $22::jsonb,
  eautomate_synced_at = NOW()
WHERE po_number = $1`;
      await query(updateSql, [
        po_number,
        sold_via,
        company_id,
        delivery_city,
        delivery_address,
        billing_address,
        buyer_gstin,
        po_issue_date,
        expiry_date,
        po_type,
        po_creation_status,
        po_acknowledgement_status,
        po_fulfillment_status,
        created_by,
        created_at,
        updated_at,
        is_wip,
        remarks,
        company_name,
        analyticsJson,
        calculated_po_status,
        eautomate_raw,
      ]);
      return;
    }
    throw e;
  }
}
