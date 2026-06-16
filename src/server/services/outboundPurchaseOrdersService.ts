import * as XLSX from "xlsx";
import { resolveCompanyLogoFromAttributes } from "@/lib/company-brand-logo";
import { pickListingImageFromRow } from "@/lib/listing-image-url";
import { normalizeOutboundPoWipForStorage } from "@/lib/outbound-po-wip";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import type { SkuReportItemRow } from "@/server/services/outboundConsignmentItemsService";
import {
  enrichOutboundReportRow,
  enrichRowsWithZapEan,
  loadOutboundSkuLookups,
  type OutboundSkuLookups,
} from "@/server/services/eanMappingsService";
import { parseOutboundPoLineItemsSpreadsheet } from "@/server/utils/outboundPoListingSpreadsheetParse";

/**
 * Keys eAutomate may merge into `analytics_object` that are NOT numeric PO KPIs — e.g. form payloads
 * (graphics_report) whose values render as unreadable JSON in UIs meant for SKU/dispatch metrics only.
 */
const ANALYTICS_NON_METRIC_KEYS = new Set([
  "graphics_report",
  "Graphics_Report",
]);

function sanitizeAnalyticsObjectForMetrics(
  ao: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...ao };
  for (const k of ANALYTICS_NON_METRIC_KEYS) delete out[k];
  return out;
}

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
        ? sanitizeAnalyticsObjectForMetrics(ao as Record<string, unknown>)
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

/** Sortable columns and their SQL expressions. Allowlisted to prevent injection. */
const OUTBOUND_PO_SORT_COLUMNS: Record<string, string> = {
  po_number: "o.po_number",
  po_type: "o.po_type",
  company_name: "COALESCE(o.company_name, c.name)",
  delivery_city: "o.delivery_city",
  calculated_po_status: "o.calculated_po_status",
  is_wip: "o.is_wip",
  remarks: "o.remarks",
  po_issue_date: "o.po_issue_date",
  expiry_date: "o.expiry_date",
  created_at: "o.created_at",
  created_by: "o.created_by",
  sku_count: "(o.analytics_object->>'sku_count')::numeric",
  total_demand: "(o.analytics_object->>'total_demand')::numeric",
  total_dispatched: "(o.analytics_object->>'total_dispatched')::numeric",
  total_packed: "(o.analytics_object->>'total_packed')::numeric",
  total_pending: "(o.analytics_object->>'total_pending')::numeric",
  quantity_fill_rate: "(o.analytics_object->>'quantity_fill_rate')::numeric",
  sku_fill_rate: "(o.analytics_object->>'sku_fill_rate')::numeric",
  total_consignments: "(o.analytics_object->>'total_consignments')::numeric",
  boxes_dispatched: "(o.analytics_object->>'boxes_dispatched')::numeric",
  boxes_packed: "(o.analytics_object->>'boxes_packed')::numeric",
};

export const OUTBOUND_PO_SORTABLE_COLUMNS = Object.keys(OUTBOUND_PO_SORT_COLUMNS);

export async function listOutboundPurchaseOrders(opts: {
  page: number;
  limit: number;
  search?: string;
  wipOnly?: boolean;
  partialOnly?: boolean;
  /** Optional substring match against po_number (column-level filter). */
  poNumber?: string;
  /** Multi-select; matches any of the supplied marketplace company ids. */
  companyIds?: number[];
  /** Multi-select; matches any of the supplied delivery cities (case-insensitive). */
  deliveryCities?: string[];
  /** Multi-select; matches any of the supplied calculated PO statuses (case-insensitive). */
  poStatuses?: string[];
  /** Multi-select; matches any of the supplied PO types (case-insensitive). */
  poTypes?: string[];
  /** Column key from OUTBOUND_PO_SORTABLE_COLUMNS; falls back to created_at DESC. */
  sortBy?: string;
  /** "asc" or "desc"; defaults to "desc". */
  sortDir?: "asc" | "desc";
}) {
  const {
    page, limit, search, wipOnly, partialOnly,
    poNumber, companyIds, deliveryCities, poStatuses, poTypes,
    sortBy, sortDir,
  } = opts;
  const offset = (page - 1) * limit;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let p = 1;

  if (wipOnly) {
    conditions.push(`UPPER(TRIM(COALESCE(o.is_wip::text, ''))) IN ('Y', 'YES')`);
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

  if (poNumber && poNumber.trim()) {
    conditions.push(`LOWER(o.po_number) LIKE $${p}`);
    params.push(`%${poNumber.trim().toLowerCase()}%`);
    p += 1;
  }

  const validCompanyIds = (companyIds ?? []).filter(
    (n) => Number.isFinite(n) && n > 0
  );
  if (validCompanyIds.length > 0) {
    conditions.push(`o.company_id = ANY($${p}::bigint[])`);
    params.push(validCompanyIds);
    p += 1;
  }

  const cityList = (deliveryCities ?? [])
    .map((s) => (typeof s === "string" ? s.trim().toLowerCase() : ""))
    .filter((s) => s.length > 0);
  if (cityList.length > 0) {
    conditions.push(`LOWER(COALESCE(o.delivery_city, '')) = ANY($${p}::text[])`);
    params.push(cityList);
    p += 1;
  }

  const statusList = (poStatuses ?? [])
    .map((s) => (typeof s === "string" ? s.trim().toLowerCase() : ""))
    .filter((s) => s.length > 0);
  if (statusList.length > 0) {
    conditions.push(`LOWER(COALESCE(o.calculated_po_status, '')) = ANY($${p}::text[])`);
    params.push(statusList);
    p += 1;
  }

  const typeList = (poTypes ?? [])
    .map((s) => (typeof s === "string" ? s.trim().toLowerCase() : ""))
    .filter((s) => s.length > 0);
  if (typeList.length > 0) {
    conditions.push(`LOWER(COALESCE(o.po_type, '')) = ANY($${p}::text[])`);
    params.push(typeList);
    p += 1;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const fromPoJoinCompany = `FROM outbound_purchase_orders o
     LEFT JOIN companies c ON c.id = o.company_id`;

  const sortExpr =
    sortBy && OUTBOUND_PO_SORT_COLUMNS[sortBy]
      ? OUTBOUND_PO_SORT_COLUMNS[sortBy]
      : null;
  const sortDirSql = sortDir === "asc" ? "ASC" : "DESC";
  const orderBy = sortExpr
    ? `ORDER BY ${sortExpr} ${sortDirSql} NULLS LAST, o.id DESC`
    : `ORDER BY o.created_at DESC NULLS LAST, o.id DESC`;

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
     ${orderBy}
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
  logo_url: string | null;
};

export type OutboundDeliveryLocationOption = {
  id: number;
  name: string;
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
    logo_url: resolveCompanyLogoFromAttributes(
      row.name != null ? String(row.name) : null,
      row.attributes
    ),
  }));
}

export async function listOutboundDeliveryLocationsForForm(): Promise<OutboundDeliveryLocationOption[]> {
  const r = await query(
    `SELECT id, name
     FROM delivery_locations
     WHERE TRIM(COALESCE(name, '')) <> ''
     ORDER BY name ASC, id ASC`
  );
  return r.rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
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
      logo_url: resolveCompanyLogoFromAttributes(
        r.name != null ? String(r.name) : null,
        attr
      ),
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

export async function outboundPoNumberExists(po_number: string): Promise<boolean> {
  const r = await query(
    `SELECT 1 FROM outbound_purchase_orders WHERE po_number = $1 LIMIT 1`,
    [po_number]
  );
  return (r.rowCount ?? 0) > 0;
}

export async function createOutboundPurchaseOrderRow(input: {
  sold_via: string;
  company_id: number;
  po_number: string;
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

  try {
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
        input.po_number,
        input.delivery_city,
        input.delivery_address,
        input.billing_address,
        input.buyer_gstin,
        input.po_issue_date,
        input.expiry_date,
        input.po_type,
        "SUBMITTED",
        input.created_by,
        "Y",
        input.company_name,
      ]
    );
  } catch (err) {
    if ((err as { code?: string } | null)?.code === "23505") {
      throw new AppError(
        `PO Number "${input.po_number}" already exists. Enter a different one.`,
        409
      );
    }
    throw err;
  }

  return { id: Number(nextId), po_number: input.po_number };
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

export async function getOutboundPurchaseOrderByPoNumber(
  poNumber: string
): Promise<OutboundPoRow | null> {
  const pn = String(poNumber || "").trim();
  if (!pn) return null;
  const r = await query(
    `SELECT id, sold_via, company_id, po_number, delivery_city, delivery_address, billing_address,
            buyer_gstin, po_issue_date, expiry_date, po_type, po_creation_status,
            po_acknowledgement_status, po_fulfillment_status, created_by, created_at, updated_at,
            is_wip, remarks, company_name, analytics_object, listings_snapshot, calculated_po_status, eautomate_synced_at
     FROM outbound_purchase_orders WHERE po_number = $1 LIMIT 1`,
    [pn]
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
  | "remarks"
  | "is_wip";

const PO_FIELD_COLUMN: Record<OutboundPoEditableField, string> = {
  po_type: "po_type",
  delivery_city: "delivery_city",
  delivery_address: "delivery_address",
  billing_address: "billing_address",
  expiry_date: "expiry_date",
  remarks: "remarks",
  is_wip: "is_wip",
};

function normalizePatchValue(field: OutboundPoEditableField, value: string | null): unknown {
  if (field === "expiry_date") {
    if (!value?.trim()) return null;
    const d = new Date(value.trim());
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (field === "is_wip") {
    const normalized = normalizeOutboundPoWipForStorage(value);
    if (value != null && String(value).trim() !== "" && normalized == null) {
      throw new AppError("is_wip must be Y, YES, N, NO, or null", 400);
    }
    return normalized;
  }
  if (value == null) return null;
  const s = String(value).trim();
  if (field === "delivery_address" || field === "billing_address") return s.slice(0, 20_000);
  if (field === "po_type") return s.slice(0, 80);
  if (field === "delivery_city") return s.slice(0, 120);
  return s;
}

/** Patch a single editable PO column (Zap DB); does not call eAutomate. */
export async function patchOutboundPurchaseOrderField(
  id: number,
  field: OutboundPoEditableField,
  value: string | null
): Promise<void> {
  if (!Number.isFinite(id) || id < 1) throw new AppError("Invalid PO id", 400);
  const sqlVal = normalizePatchValue(field, value);
  const column = PO_FIELD_COLUMN[field];
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

export async function updateOutboundPoAnalyticsObject(
  outboundPoId: number,
  analytics: Record<string, unknown>
): Promise<void> {
  if (!Number.isFinite(outboundPoId) || outboundPoId < 1) return;
  await query(
    `UPDATE outbound_purchase_orders SET analytics_object = $2::jsonb WHERE id = $1`,
    [outboundPoId, JSON.stringify(analytics)]
  );
}

/** Refresh `total_consignments` on PO analytics from `outbound_consignments` count. */
export async function refreshOutboundPoConsignmentCountAnalytics(
  outboundPoId: number,
  poNumber: string
): Promise<void> {
  if (!Number.isFinite(outboundPoId) || outboundPoId < 1) return;
  const pn = String(poNumber || "").trim();
  if (!pn) return;
  const po = await getOutboundPurchaseOrderById(outboundPoId);
  if (!po) return;
  const countR = await query(
    `SELECT COUNT(*)::int AS n FROM outbound_consignments WHERE po_number = $1`,
    [pn]
  );
  const n = Number(countR.rows[0]?.n) || 0;
  const ao =
    po.analytics_object && typeof po.analytics_object === "object"
      ? { ...(po.analytics_object as Record<string, unknown>) }
      : {};
  ao.total_consignments = n;
  await updateOutboundPoAnalyticsObject(outboundPoId, ao);
}

function lineDemandFromRow(row: Record<string, unknown>): number {
  const n = Number(row.original_demand ?? row.demand ?? row.box_quantity);
  return Number.isFinite(n) ? n : 0;
}

function lineNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** PO value before/after tax from line commercial fields (spreadsheet or eAutomate rows). */
export function computeCommercialTotalsFromRows(
  rows: Record<string, unknown>[]
): { total_before_tax: number; total_after_tax: number } {
  let before = 0;
  let after = 0;
  for (const r of rows) {
    const demand = lineDemandFromRow(r);
    if (demand <= 0) continue;

    const totalAmount = lineNum(r.total_amount);
    const rateWithoutTax = lineNum(r.rate_without_tax);
    const landingRate = lineNum(r.landing_rate);
    const taxRatePct = lineNum(r.tax_rate);
    const taxMult = taxRatePct > 0 ? 1 + taxRatePct / 100 : 1;

    if (totalAmount > 0) {
      after += totalAmount;
      if (rateWithoutTax > 0) {
        before += rateWithoutTax * demand;
      } else if (taxMult > 1) {
        before += totalAmount / taxMult;
      } else {
        before += totalAmount;
      }
    } else if (rateWithoutTax > 0) {
      const lineBefore = rateWithoutTax * demand;
      before += lineBefore;
      after += lineBefore * taxMult;
    } else if (landingRate > 0) {
      const lineBefore = landingRate * demand;
      before += lineBefore;
      after += lineBefore * taxMult;
    }
  }
  return {
    total_before_tax: roundMoney(before),
    total_after_tax: roundMoney(after),
  };
}

function commercialTotalsPresent(analytics: Record<string, unknown>): boolean {
  const before = Number(analytics.total_before_tax);
  const after = Number(analytics.total_after_tax);
  return (
    Number.isFinite(before) &&
    Number.isFinite(after) &&
    (before > 0 || after > 0)
  );
}

/** Fill Commercial summary when analytics came from spreadsheet rollup (no eAutomate $ fields). */
export function mergeCommercialIntoAnalytics(
  analytics: Record<string, unknown>,
  snapshot: unknown
): Record<string, unknown> {
  if (commercialTotalsPresent(analytics)) return analytics;
  const rows = extractListingsRowsFromSnapshot(snapshot);
  if (rows.length === 0) return analytics;
  const commercial = computeCommercialTotalsFromRows(rows);
  if (commercial.total_before_tax <= 0 && commercial.total_after_tax <= 0) {
    return analytics;
  }
  return { ...analytics, ...commercial };
}

/** Basic KPI rollup from parsed spreadsheet / listing rows (no eAutomate sync). */
export function computeAnalyticsFromListingsRows(
  rows: Record<string, unknown>[]
): Record<string, unknown> {
  const totalDemand = rows.reduce((s, r) => s + lineDemandFromRow(r), 0);
  return {
    sku_count: rows.length,
    total_demand: totalDemand,
    total_pending: totalDemand,
    total_packed: 0,
    total_dispatched: 0,
    boxes_packed: 0,
    boxes_dispatched: 0,
    total_consignments: 0,
    sku_fill_rate: 0,
    quantity_fill_rate: 0,
    ...computeCommercialTotalsFromRows(rows),
  };
}

/** Parse spreadsheet buffer and persist listings + summary KPIs when rows are found. */
export async function applySpreadsheetToOutboundPo(
  outboundPoId: number,
  buf: Buffer,
  filename: string
): Promise<{ listingsUpdated: boolean; rowsParsed: number }> {
  const envelope = parseOutboundPoLineItemsSpreadsheet(buf, filename);
  if (envelope.content.length === 0) {
    return { listingsUpdated: false, rowsParsed: 0 };
  }
  await updateOutboundPoListingsSnapshot(outboundPoId, envelope);
  await updateOutboundPoAnalyticsObject(
    outboundPoId,
    computeAnalyticsFromListingsRows(envelope.content)
  );
  return { listingsUpdated: true, rowsParsed: envelope.content.length };
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
  | "zap_ean"
  | "universal_ean"
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
  "zap_ean",
  "universal_ean",
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

function isNumericCommercialValue(v: unknown): boolean {
  if (v == null || v === "") return false;
  const s = String(v).trim();
  return /^-?\d+(\.\d+)?$/.test(s);
}

function looksLikeGstPercent(v: unknown): boolean {
  const n = numberFromUnknown(v);
  return n != null && Number.isInteger(n) && n >= 0 && n <= 28;
}

function mergeTitleWithColorFragment(title: string, fragment: string): string {
  const base = title.trimEnd();
  const tail = fragment.trim();
  if (!tail) return base;
  if (base.endsWith('"')) {
    return `${base}${tail.startsWith(",") ? "" : ", "}${tail}`;
  }
  if (/[\("(][^)]*$/.test(base)) {
    return `${base}${tail}`;
  }
  return `${base}, ${tail}`;
}

/**
 * Repair listing rows where a comma inside the title (common with inch marks like 6.2")
 * was parsed as a column boundary, leaving color text in rate_without_tax and the
 * actual rate in tax_rate.
 */
export function repairOutboundListingCommercialFields(
  row: Record<string, unknown>
): Record<string, unknown> {
  const rateRaw = row.rate_without_tax;
  const rateText = rateRaw == null ? "" : String(rateRaw).trim();
  if (!rateText || isNumericCommercialValue(rateRaw)) return row;

  const shiftedRate = numberFromUnknown(row.tax_rate);
  const taxColumnLooksLikePrice =
    shiftedRate != null && shiftedRate > 28 && /[a-zA-Z]/.test(rateText);
  if (!taxColumnLooksLikePrice) return row;

  const out: Record<string, unknown> = { ...row };
  out.title = mergeTitleWithColorFragment(String(row.title ?? ""), rateText);
  out.rate_without_tax = row.tax_rate;

  const demandMaybeTax =
    numberFromUnknown(out.demand) ?? numberFromUnknown(out.original_demand);
  if (looksLikeGstPercent(demandMaybeTax)) {
    out.tax_rate = demandMaybeTax;
    delete out.demand;
    delete out.original_demand;
  } else {
    delete out.tax_rate;
  }

  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function parsePercentLike(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const text = String(value).trim();
  if (!text) return null;
  const stripped = text.replace(/%/g, "").trim();
  const n = Number(stripped);
  return Number.isFinite(n) ? n : null;
}

function firstPresentTaxRate(
  row: Record<string, unknown>,
  fallback?: Record<string, unknown>
): number | null {
  const keys = [
    "tax_rate",
    "gst_rate",
    "igst",
    "igst_percent",
    "gst_percent",
  ] as const;
  for (const key of keys) {
    const parsed = parsePercentLike(row[key]);
    if (parsed != null) return parsed;
    if (fallback) {
      const parsedFallback = parsePercentLike(fallback[key]);
      if (parsedFallback != null) return parsedFallback;
    }
  }
  return null;
}

function readListingObject(row: Record<string, unknown>): Record<string, unknown> {
  const listing = row.listing;
  if (listing && typeof listing === "object" && !Array.isArray(listing)) {
    return listing as Record<string, unknown>;
  }
  return {};
}

export function resolveSnapshotReportMasterSku(
  row: Record<string, unknown>,
  lookups?: OutboundSkuLookups
): string {
  if (lookups) {
    return enrichOutboundReportRow(row, lookups).master_sku;
  }
  const listing = readListingObject(row);
  return csvCellValue(
    row.master_sku ??
      listing.master_sku ??
      row.inventory_sku_id ??
      listing.inventory_sku_id ??
      ""
  );
}

function numberFromRow(row: Record<string, unknown>, key: string): number | null {
  return numberFromUnknown(row[key]);
}

function skuReportSafeFilename(poNumber: string): string {
  return String(poNumber || "po").replace(/[/\\?%*:|"<>]/g, "_");
}

/** Build one SKU report row (all columns) for CSV or XLSX export. */
export function buildSkuReportRowCells(
  row: Record<string, unknown>,
  po: OutboundPoRow,
  lookups: OutboundSkuLookups
): Record<SkuReportColumn, string> {
  const enriched = enrichOutboundReportRow(row, lookups);
  const demand =
    numberFromRow(row, "demand") ??
    numberFromRow(row, "original_demand") ??
    numberFromRow(row, "box_quantity") ??
    0;
  const packed = numberFromRow(row, "packed") ?? 0;
  const dispatched = numberFromRow(row, "dispatched") ?? 0;
  const explicitPending = numberFromRow(row, "pending");
  const pending =
    explicitPending != null ? explicitPending : demand - (packed + dispatched);
  const taxPct = computeSnapshotReportTaxRatePct(row);
  const fillRate = row.fill_rate_percent ?? row.fill_rate;
  const listing = readListingObject(row);

  return {
    buyer_name: csvCellValue(po.company_name ?? row.buyer_name),
    po_number: csvCellValue(po.po_number),
    po_release_date: csvCellValue(po.po_issue_date),
    po_expiry_date: csvCellValue(po.expiry_date),
    po_addition_date: csvCellValue(row.po_addition_date ?? po.created_at),
    po_type: csvCellValue(po.po_type ?? row.po_type),
    delivery_location: csvCellValue(row.delivery_location ?? po.delivery_city),
    po_secondary_sku: csvCellValue(row.po_secondary_sku),
    master_sku: csvCellValue(enriched.master_sku),
    inventory_sku_id: csvCellValue(enriched.inventory_sku_id),
    pack_combo_sku_id: csvCellValue(row.pack_combo_sku_id),
    sku_type: csvCellValue(row.sku_type ?? listing.sku_type),
    company_code_primary: csvCellValue(enriched.company_code_primary),
    company_code_secondary: csvCellValue(
      enriched.company_code_secondary || row.company_code_secondary
    ),
    zap_ean: csvCellValue(enriched.zap_ean),
    universal_ean: csvCellValue(enriched.universal_ean),
    title: csvCellValue(row.title),
    mrp: csvCellValue(row.mrp),
    rate_without_tax: csvCellValue(row.rate_without_tax),
    tax_rate: taxPct != null ? String(taxPct) : "",
    hsn: csvCellValue(row.hsn_code ?? row.hsn),
    size: csvCellValue(row.size ?? listing.size),
    color: csvCellValue(row.color ?? listing.color),
    ops_tag: csvCellValue(row.ops_tag ?? listing.ops_tag),
    warehouse_quantity:
      enriched.warehouse_quantity != null
        ? String(enriched.warehouse_quantity)
        : "",
    demand: String(demand),
    packed: String(packed),
    dispatched: String(dispatched),
    pending: String(pending),
    fill_rate_percent: csvCellValue(fillRate),
  };
}

/** Header row + data rows for SKU report (array-of-arrays). */
export function buildSkuReportAoa(
  rows: Record<string, unknown>[],
  po: OutboundPoRow,
  lookups: OutboundSkuLookups
): string[][] {
  const header = [...SKU_REPORT_COLUMNS];
  const data = rows.map((row) =>
    SKU_REPORT_COLUMNS.map((h) => buildSkuReportRowCells(row, po, lookups)[h])
  );
  return [header, ...data];
}

export function buildSkuReportXlsxBuffer(
  rows: Record<string, unknown>[],
  po: OutboundPoRow,
  lookups: OutboundSkuLookups
): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(buildSkuReportAoa(rows, po, lookups)),
    "SKU Report"
  );
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export async function buildSkuReportXlsxFromRows(
  rows: Record<string, unknown>[],
  po: OutboundPoRow
): Promise<{ buffer: Buffer; filename: string }> {
  const repairedRows = rows.map(repairOutboundListingCommercialFields);
  const lookups = await loadOutboundSkuLookups(repairedRows, po.company_id);
  const enriched = await enrichRowsWithZapEan(repairedRows, po.company_id);
  const pn = skuReportSafeFilename(String(po.po_number ?? "po"));
  return {
    buffer: buildSkuReportXlsxBuffer(enriched, po, lookups),
    filename: `sku-report-${pn}.xlsx`,
  };
}

export function skuReportFromEnrichedRows(
  rows: Record<string, unknown>[],
  po: OutboundPoRow,
  lookups: OutboundSkuLookups
): string {
  if (rows.length === 0) {
    return `\ufeff${csvEscapeCell("message")}\r\n${csvEscapeCell(
      "No line items in listings_snapshot. Sync this PO from eCraft (PO detail) or upload a received PO spreadsheet to populate listings."
    )}`;
  }

  const aoa = buildSkuReportAoa(rows, po, lookups);
  const lines = aoa.map((line, idx) =>
    idx === 0
      ? line.map((h) => csvEscapeCell(h)).join(",")
      : line.map((c) => csvEscapeCell(c)).join(",")
  );

  return `\ufeff${lines.join("\r\n")}`;
}

/** Map consignment DB rows to snapshot-shaped line items for SKU report enrichment. */
export function consignmentItemsToSkuReportRows(
  items: SkuReportItemRow[]
): Record<string, unknown>[] {
  return items.map((item) => {
    const raw = repairOutboundListingCommercialFields(item.raw ?? {});
    const listing = raw.listing;
    const listObj =
      listing && typeof listing === "object" && !Array.isArray(listing)
        ? (listing as Record<string, unknown>)
        : {};
    const demand =
      numberFromUnknown(raw.demand) ??
      item.original_demand ??
      numberFromUnknown(raw.original_demand) ??
      0;
    const packed =
      numberFromUnknown(raw.packed) ?? item.consignment_quantity ?? 0;
    const dispatched =
      numberFromUnknown(raw.dispatched) ??
      numberFromUnknown(raw.dispatched_quantity) ??
      item.dispatched_quantity ??
      0;
    return {
      ...raw,
      po_secondary_sku: item.po_secondary_sku ?? raw.po_secondary_sku,
      company_code_primary: item.company_code_primary ?? raw.company_code_primary,
      company_code_secondary:
        item.company_code_secondary ?? raw.company_code_secondary,
      mrp: item.mrp ?? raw.mrp,
      demand,
      original_demand: item.original_demand ?? raw.original_demand,
      packed,
      dispatched,
      fill_rate_percent:
        item.overall_fill_rate ?? raw.fill_rate_percent ?? raw.fill_rate,
      listing: raw.listing ?? (Object.keys(listObj).length ? listObj : undefined),
    };
  });
}

export async function buildSkuReportCsvFromRows(
  rows: Record<string, unknown>[],
  po: OutboundPoRow
): Promise<string> {
  const lookups = await loadOutboundSkuLookups(rows, po.company_id);
  const enriched = await enrichRowsWithZapEan(rows, po.company_id);
  return skuReportFromEnrichedRows(enriched, po, lookups);
}

export function computeSnapshotReportTaxRatePct(row: Record<string, unknown>): number | null {
  const listing = readListingObject(row);
  const explicitTaxRate = firstPresentTaxRate(row, listing);
  if (explicitTaxRate != null) return round2(Math.max(0, explicitTaxRate));

  const demand =
    numberFromUnknown(row.demand) ??
    numberFromUnknown(row.original_demand) ??
    numberFromUnknown(row.box_quantity) ??
    0;
  const rateWithoutTax = numberFromUnknown(row.rate_without_tax);
  const totalAmount = numberFromUnknown(row.total_amount);

  if (
    totalAmount != null &&
    totalAmount > 0 &&
    rateWithoutTax != null &&
    rateWithoutTax > 0 &&
    demand > 0
  ) {
    const pct = ((totalAmount / (rateWithoutTax * demand)) - 1) * 100;
    if (Number.isFinite(pct)) {
      const bounded = round2(Math.max(0, pct));
      return bounded <= 100 ? bounded : null;
    }
  }

  const landingRate = numberFromUnknown(row.landing_rate);
  if (
    landingRate != null &&
    landingRate > 0 &&
    rateWithoutTax != null &&
    rateWithoutTax > 0
  ) {
    const pct = ((landingRate / rateWithoutTax) - 1) * 100;
    if (Number.isFinite(pct)) {
      const bounded = round2(Math.max(0, pct));
      return bounded <= 100 ? bounded : null;
    }
  }
  return null;
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
  if (col === "master_sku") {
    return resolveSnapshotReportMasterSku(row);
  }
  if (col === "tax_rate") {
    const pct = computeSnapshotReportTaxRatePct(row);
    return pct != null ? String(pct) : "";
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

function listingSkuKeysForImageLookup(row: Record<string, unknown>): string[] {
  const keys = new Set<string>();
  const add = (v: unknown) => {
    const s = v != null ? String(v).trim() : "";
    if (!s || s === "NA" || s === "—") return;
    keys.add(s);
  };
  add(row.master_sku);
  add(row.inventory_sku_id);
  add(row.pack_combo_sku_id);
  add(row.po_secondary_sku);
  add(row.sku_id);
  const listing = row.listing;
  if (listing && typeof listing === "object" && !Array.isArray(listing)) {
    const L = listing as Record<string, unknown>;
    add(L.sku_id);
    add(L.master_sku);
    add(L.inventory_sku_id);
  }
  return [...keys];
}

/**
 * Attach warehouse `listings` image fields when snapshot rows lack `listing.img_*`
 * (e.g. spreadsheet-only PO lines).
 */
export async function enrichRowsWithListingImages(
  rows: Record<string, unknown>[]
): Promise<Record<string, unknown>[]> {
  const needsKeys = new Set<string>();
  for (const row of rows) {
    if (pickListingImageFromRow(row)) continue;
    for (const k of listingSkuKeysForImageLookup(row)) needsKeys.add(k);
  }
  if (needsKeys.size === 0) return rows;

  const keyList = [...needsKeys];
  const r = await query(
    `SELECT sku_id, master_sku, inventory_sku_id,
            img_hd, img_white, img_wdim, img_link1, img_link2
     FROM listings
     WHERE sku_id = ANY($1::text[])
        OR master_sku = ANY($1::text[])
        OR inventory_sku_id = ANY($1::text[])`,
    [keyList]
  );

  const imageBySku = new Map<string, Record<string, unknown>>();
  for (const dbRow of r.rows) {
    const patch: Record<string, unknown> = {};
    for (const col of [
      "img_hd",
      "img_white",
      "img_wdim",
      "img_link1",
      "img_link2",
    ] as const) {
      const v = dbRow[col];
      if (v != null && String(v).trim()) patch[col] = v;
    }
    if (Object.keys(patch).length === 0) continue;
    for (const id of [dbRow.sku_id, dbRow.master_sku, dbRow.inventory_sku_id]) {
      if (id != null && String(id).trim()) imageBySku.set(String(id).trim(), patch);
    }
  }

  if (imageBySku.size === 0) return rows;

  return rows.map((row) => {
    if (pickListingImageFromRow(row)) return row;
    for (const k of listingSkuKeysForImageLookup(row)) {
      const patch = imageBySku.get(k);
      if (!patch) continue;
      const existing =
        row.listing && typeof row.listing === "object" && !Array.isArray(row.listing)
          ? (row.listing as Record<string, unknown>)
          : {};
      return { ...row, listing: { ...patch, ...existing } };
    }
    return row;
  });
}

/** Enrich `{ content: [...] }` listings snapshot with warehouse images. */
export async function enrichListingsSnapshotWithListingImages(
  snapshot: unknown
): Promise<unknown> {
  if (snapshot == null || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    if (Array.isArray(snapshot)) {
      return enrichRowsWithListingImages(snapshot as Record<string, unknown>[]);
    }
    return snapshot;
  }
  const o = snapshot as Record<string, unknown>;
  const content = o.content;
  if (!Array.isArray(content)) return snapshot;
  const enriched = await enrichRowsWithListingImages(
    content.filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
  );
  return { ...o, content: enriched };
}

/** Build paginated items payload from `listings_snapshot` (used by GET …/purchase-orders/:id/items). */
export async function buildOutboundPoItemsPayloadFromSnapshot(
  snapshot: unknown,
  opts: {
    page: number;
    limit: number;
    search?: string;
    companyId?: number | null;
  }
): Promise<{
  total: number;
  current_page: number;
  per_page_count: number;
  curr_page_count: number;
  content: Record<string, unknown>[];
}> {
  const all = extractListingsRowsFromSnapshot(snapshot);
  const filtered = filterListingsRowsBySearch(all, opts.search);
  const withEan = await enrichRowsWithZapEan(filtered, opts.companyId ?? null);
  const enriched = await enrichRowsWithListingImages(withEan);
  return paginateOutboundPoLineItemRows({
    rows: enriched,
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
 * Upsert from POST /public/api/incoming_purchase_orders/all/with_filters list rows.
 * Unlike partial-list sync, this variant persists analytics_object + calculated_po_status.
 */
export async function upsertOutboundPoFromEautomateList(
  raw: Record<string, unknown>
): Promise<void> {
  const id = Number(raw.id);
  if (!Number.isFinite(id) || id < 1) {
    throw new Error("eAutomate list PO row missing positive numeric id");
  }
  const po_number = String(raw.po_number ?? "")
    .trim()
    .slice(0, 80);
  if (!po_number) throw new Error("eAutomate list PO row missing po_number");

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
  const analytics_object =
    raw.analytics_object && typeof raw.analytics_object === "object" && !Array.isArray(raw.analytics_object)
      ? JSON.stringify(
          sanitizeAnalyticsObjectForMetrics(raw.analytics_object as Record<string, unknown>)
        )
      : "{}";
  const calculated_po_status =
    raw.calculated_po_status != null && String(raw.calculated_po_status).trim() !== ""
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
    analytics_object,
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
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb,$22,$23::jsonb, NOW()
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
        analytics_object,
        calculated_po_status,
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
      ? JSON.stringify(sanitizeAnalyticsObjectForMetrics(ao as Record<string, unknown>))
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
