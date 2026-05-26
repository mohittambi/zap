import { query } from "@/server/db";
import { extractListingsRowsFromSnapshot } from "@/server/services/outboundPurchaseOrdersService";
import {
  companyOutboundColumnKey,
  type OpsCompanyOutboundColumn,
  type OpsSkuPoCompanyOutbound,
  type OpsSkuPoControlListResult,
  type OpsSkuPoControlRow,
  type OpsSkuPoControlSummary,
} from "@/types/opsSkuPoControl";

export type { OpsSkuPoControlRow, OpsSkuPoControlListResult, OpsSkuPoControlSummary };
export { companyOutboundColumnKey };

/** Same open-outbound PO rules as outbound company directory rollups. */
export const OPEN_OUTBOUND_PO_SQL = `
  (o.expiry_date IS NULL OR o.expiry_date >= NOW())
  AND COALESCE(UPPER(TRIM(o.calculated_po_status)), '') NOT IN (
    'EXPIRED', 'CANCELLED', 'CLOSED', 'COMPLETED', 'DELIVERED', 'CANCEL'
  )
  AND NOT (COALESCE(o.calculated_po_status, '') ILIKE '%expir%')
  AND NOT (COALESCE(o.calculated_po_status, '') ILIKE '%cancel%')
  AND NOT (COALESCE(o.calculated_po_status, '') ILIKE '%clos%')
  AND NOT (COALESCE(o.calculated_po_status, '') ILIKE '%complet%')
  AND NOT (COALESCE(o.calculated_po_status, '') ILIKE '%deliver%')
`;

export const OPEN_INBOUND_VENDOR_PO_SQL = `
  COALESCE(UPPER(TRIM(po.status)), '') NOT IN (
    'CLOSED', 'COMPLETED', 'CANCELLED', 'CANCEL', 'DELIVERED'
  )
  AND NOT (COALESCE(po.status, '') ILIKE '%cancel%')
  AND NOT (COALESCE(po.status, '') ILIKE '%clos%')
  AND NOT (COALESCE(po.status, '') ILIKE '%complet%')
  AND NOT (COALESCE(po.status, '') ILIKE '%deliver%')
`;

export const OPS_SKU_PO_SORT_COLUMNS: Record<string, string> = {
  master_sku: "master_sku",
  open_actual_po_qty: "open_actual_po_qty",
  open_po_qty_sent: "open_po_qty_sent",
  open_po_fill_rate_pct: "open_po_fill_rate_pct",
  total_pending: "total_pending",
  order_placed_by_ops: "order_placed_by_ops",
  app_stock: "app_stock",
  order_place_pending: "order_place_pending",
};

export type OpsSkuPoOutboundLine = {
  outbound_po_id: number;
  po_number: string;
  company_name: string | null;
  po_secondary_sku: string | null;
  line_demand: number;
  line_packed: number;
  line_dispatched: number;
  line_pending: number;
};

export type OpsSkuPoInboundLine = {
  vendor_po_id: number;
  vendor_id: number;
  vendor_name: string | null;
  sku_id: string;
  line_quantity: number;
  po_status: string | null;
};

function num(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pickNum(row: Record<string, unknown>, keys: string[]): number {
  for (const k of keys) {
    const v = row[k];
    if (v == null || v === "") continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function listingObj(row: Record<string, unknown>): Record<string, unknown> | null {
  const L = row.listing;
  if (L && typeof L === "object" && !Array.isArray(L)) return L as Record<string, unknown>;
  return null;
}

export function normalizeOutboundListingLine(row: Record<string, unknown>): {
  master_sku: string | null;
  demand: number;
  packed: number;
  dispatched: number;
  qty_sent: number;
  pending_line: number;
  po_secondary_sku: string | null;
} {
  const L = listingObj(row);
  const demand = pickNum(row, ["demand", "demand_quantity", "original_demand"]) ||
    (L ? pickNum(L, ["demand", "demand_quantity"]) : 0);
  const packed =
    pickNum(row, ["packed_quantity", "packed"]) ||
    (L ? pickNum(L, ["packed_quantity", "packed"]) : 0);
  const dispatched =
    pickNum(row, ["dispatched_quantity", "dispatched"]) ||
    (L ? pickNum(L, ["dispatched_quantity", "dispatched"]) : 0);
  const qty_sent = packed + dispatched;
  const explicitPending = pickNum(row, ["pending"]);
  const pending_line =
    row.pending != null && row.pending !== ""
      ? Math.max(0, num(row.pending))
      : Math.max(0, demand - qty_sent);

  let masterSku = "";
  for (const k of ["master_sku", "masterSku"]) {
    const v = row[k];
    if (v != null && String(v).trim()) {
      masterSku = String(v).trim();
      break;
    }
  }
  if (!masterSku && L) {
    for (const k of ["master_sku", "masterSku"]) {
      const v = L[k];
      if (v != null && String(v).trim()) {
        masterSku = String(v).trim();
        break;
      }
    }
  }

  const poSecondary =
    row.po_secondary_sku != null
      ? String(row.po_secondary_sku)
      : row.poSecondarySku != null
        ? String(row.poSecondarySku)
        : null;

  return {
    master_sku: masterSku || null,
    demand,
    packed,
    dispatched,
    qty_sent,
    pending_line: explicitPending > 0 ? explicitPending : pending_line,
    po_secondary_sku: poSecondary,
  };
}

function parseInboundLineQty(raw: Record<string, unknown>): number {
  return pickNum(raw, [
    "quantity",
    "required_quantity",
    "ordered_quantity",
    "order_placed_quantity",
    "Quantity",
  ]);
}

function computeFillRatePct(sent: number, actual: number): number | null {
  if (actual <= 0) return null;
  return Math.round((sent / actual) * 10000) / 100;
}

export function computeOrderPlacePending(
  totalPending: number,
  orderPlaced: number,
  appStock: number
): number {
  if (appStock >= totalPending && orderPlaced === 0) return 0;
  return Math.max(0, totalPending - orderPlaced - appStock);
}

type Agg = {
  open_actual_po_qty: number;
  open_po_qty_sent: number;
  total_pending: number;
  order_placed_by_ops: number;
  app_stock: number;
};

function emptyAgg(): Agg {
  return {
    open_actual_po_qty: 0,
    open_po_qty_sent: 0,
    total_pending: 0,
    order_placed_by_ops: 0,
    app_stock: 0,
  };
}

function toCompanyOutbound(a: Agg): OpsSkuPoCompanyOutbound {
  const totalPending = Math.max(0, a.open_actual_po_qty - a.open_po_qty_sent);
  return {
    open_actual_po_qty: a.open_actual_po_qty,
    open_po_qty_sent: a.open_po_qty_sent,
    total_pending: totalPending,
    open_po_fill_rate_pct: computeFillRatePct(a.open_po_qty_sent, a.open_actual_po_qty),
  };
}

function toRow(
  masterSku: string,
  a: Agg,
  outboundByCompany: Record<string, OpsSkuPoCompanyOutbound>
): OpsSkuPoControlRow {
  const totalPending = Math.max(0, a.open_actual_po_qty - a.open_po_qty_sent);
  return {
    master_sku: masterSku,
    open_actual_po_qty: a.open_actual_po_qty,
    open_po_qty_sent: a.open_po_qty_sent,
    total_pending: totalPending,
    open_po_fill_rate_pct: computeFillRatePct(a.open_po_qty_sent, a.open_actual_po_qty),
    order_placed_by_ops: a.order_placed_by_ops,
    app_stock: a.app_stock,
    order_place_pending: computeOrderPlacePending(
      totalPending,
      a.order_placed_by_ops,
      a.app_stock
    ),
    outbound_by_company: outboundByCompany,
  };
}

function buildSummary(rows: OpsSkuPoControlRow[]): OpsSkuPoControlSummary {
  return rows.reduce(
    (acc, r) => ({
      summary_open_actual_po_qty: acc.summary_open_actual_po_qty + r.open_actual_po_qty,
      summary_open_po_qty_sent: acc.summary_open_po_qty_sent + r.open_po_qty_sent,
      summary_total_pending: acc.summary_total_pending + r.total_pending,
      summary_order_place_pending:
        acc.summary_order_place_pending + r.order_place_pending,
    }),
    {
      summary_open_actual_po_qty: 0,
      summary_open_po_qty_sent: 0,
      summary_total_pending: 0,
      summary_order_place_pending: 0,
    }
  );
}

export type RecomputeMeta = {
  open_outbound_po_count: number;
  open_inbound_po_count: number;
  pos_without_snapshot: number;
  unmapped_inbound_line_count: number;
  source_sync_watermark: Date | null;
};

/** Live aggregation from source tables (single source of truth). */
export async function recomputeOpsMasterSkuPoMetrics(): Promise<{
  rows: OpsSkuPoControlRow[];
  companies: OpsCompanyOutboundColumn[];
  meta: RecomputeMeta;
}> {
  const bySku = new Map<string, Agg>();
  const bySkuCompany = new Map<string, Map<number, Agg>>();
  const companyNames = new Map<number, string>();

  const ensure = (sku: string) => {
    let a = bySku.get(sku);
    if (!a) {
      a = emptyAgg();
      bySku.set(sku, a);
    }
    return a;
  };

  const ensureCompany = (sku: string, companyId: number) => {
    let perCo = bySkuCompany.get(sku);
    if (!perCo) {
      perCo = new Map();
      bySkuCompany.set(sku, perCo);
    }
    let a = perCo.get(companyId);
    if (!a) {
      a = emptyAgg();
      perCo.set(companyId, a);
    }
    return a;
  };

  let posWithoutSnapshot = 0;

  const outboundR = await query(
    `SELECT o.id, o.po_number, o.company_id, o.company_name, c.name AS company_join_name,
            o.listings_snapshot, o.eautomate_synced_at, o.updated_at
     FROM outbound_purchase_orders o
     LEFT JOIN companies c ON c.id = o.company_id
     WHERE ${OPEN_OUTBOUND_PO_SQL}`,
    []
  );

  for (const po of outboundR.rows as Record<string, unknown>[]) {
    const companyId = Number(po.company_id);
    if (!Number.isFinite(companyId) || companyId < 1) continue;
    const companyName = String(
      po.company_name ?? po.company_join_name ?? `Company ${companyId}`
    ).trim();
    companyNames.set(companyId, companyName);

    const lines = extractListingsRowsFromSnapshot(po.listings_snapshot);
    if (lines.length === 0) {
      posWithoutSnapshot += 1;
      continue;
    }
    for (const line of lines) {
      const n = normalizeOutboundListingLine(line);
      if (!n.master_sku) continue;
      const a = ensure(n.master_sku);
      a.open_actual_po_qty += n.demand;
      a.open_po_qty_sent += n.qty_sent;
      const co = ensureCompany(n.master_sku, companyId);
      co.open_actual_po_qty += n.demand;
      co.open_po_qty_sent += n.qty_sent;
    }
  }

  const companies: OpsCompanyOutboundColumn[] = [...companyNames.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([company_id, name]) => ({
      company_id,
      name,
      column_key: companyOutboundColumnKey(company_id),
    }));

  const inboundCountR = await query(
    `SELECT COUNT(*)::int AS c FROM vendor_purchase_orders po WHERE ${OPEN_INBOUND_VENDOR_PO_SQL}`,
    []
  );
  const openInboundPoCount = Number(inboundCountR.rows[0]?.c) || 0;

  let unmappedInbound = 0;

  const skuMasterR = await query(
    `SELECT sku_id, master_sku FROM listings WHERE master_sku IS NOT NULL AND TRIM(master_sku) <> ''`,
    []
  );
  const skuToMaster = new Map<string, string>();
  for (const r of skuMasterR.rows as { sku_id: string; master_sku: string }[]) {
    skuToMaster.set(r.sku_id, r.master_sku.trim());
  }

  const eautomateLinesR = await query(
    `SELECT l.po_id, l.sku_id, l.raw
     FROM inbound_po_detail_lines l
     INNER JOIN vendor_purchase_orders po ON po.po_id = l.po_id
     WHERE ${OPEN_INBOUND_VENDOR_PO_SQL}`,
    []
  );

  for (const row of eautomateLinesR.rows as {
    sku_id: string | null;
    raw: Record<string, unknown>;
  }[]) {
    const raw = row.raw ?? {};
    const skuId = (row.sku_id ?? raw.sku_id ?? raw.Sku_Id ?? "").toString().trim();
    if (!skuId) {
      unmappedInbound += 1;
      continue;
    }
    const masterKey = skuToMaster.get(skuId) ?? skuId;
    const qty = parseInboundLineQty(raw);
    if (qty <= 0) continue;
    ensure(masterKey).order_placed_by_ops += qty;
  }

  const zapLinesR = await query(
    `SELECT vl.po_id, vl.sku_id, vl.quantity
     FROM vendor_purchase_order_lines vl
     INNER JOIN vendor_purchase_orders po ON po.po_id = vl.po_id
     WHERE po.source = 'zap' AND ${OPEN_INBOUND_VENDOR_PO_SQL}`,
    []
  );

  for (const row of zapLinesR.rows as {
    sku_id: string;
    quantity: number;
  }[]) {
    const resolved = skuToMaster.get(row.sku_id) ?? row.sku_id;
    const a = ensure(resolved);
    a.order_placed_by_ops += Number(row.quantity) || 0;
  }

  const stockR = await query(
    `SELECT l.master_sku, COALESCE(SUM(b.available_quantity), 0)::int AS app_stock
     FROM listings l
     INNER JOIN bins b ON b.sku_id = l.sku_id AND b.is_deleted = false
     WHERE l.master_sku IS NOT NULL AND TRIM(l.master_sku) <> ''
     GROUP BY l.master_sku`,
    []
  );

  for (const row of stockR.rows as { master_sku: string; app_stock: number }[]) {
    const sku = row.master_sku.trim();
    const a = ensure(sku);
    a.app_stock = Number(row.app_stock) || 0;
  }

  const watermarkR = await query(
    `SELECT GREATEST(
       (SELECT MAX(eautomate_synced_at) FROM outbound_purchase_orders),
       (SELECT MAX(updated_at) FROM vendor_purchase_orders),
       (SELECT MAX(synced_at) FROM inbound_po_detail_snapshot)
     ) AS wm`,
    []
  );
  const wm = watermarkR.rows[0]?.wm;
  const sourceSyncWatermark = wm != null ? new Date(wm as string) : null;

  const rows = [...bySku.entries()]
    .map(([sku, a]) => {
      const perCo = bySkuCompany.get(sku);
      const outbound_by_company: Record<string, OpsSkuPoCompanyOutbound> = {};
      if (perCo) {
        for (const [companyId, coAgg] of perCo.entries()) {
          outbound_by_company[companyOutboundColumnKey(companyId)] =
            toCompanyOutbound(coAgg);
        }
      }
      return toRow(sku, a, outbound_by_company);
    })
    .filter((r) => r.open_actual_po_qty > 0 || r.order_placed_by_ops > 0 || r.app_stock > 0);

  return {
    rows,
    companies,
    meta: {
      open_outbound_po_count: outboundR.rows.length,
      open_inbound_po_count: openInboundPoCount,
      pos_without_snapshot: posWithoutSnapshot,
      unmapped_inbound_line_count: unmappedInbound,
      source_sync_watermark: sourceSyncWatermark,
    },
  };
}

const CACHE_TTL_HOURS = 6;

export async function refreshOpsMasterSkuPoMetricsCache(): Promise<{
  row_count: number;
  computed_at: string;
  meta: RecomputeMeta;
}> {
  const { rows, companies, meta } = await recomputeOpsMasterSkuPoMetrics();
  await query(`TRUNCATE ops_master_sku_po_metrics`, []);

  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let p = 1;
    for (const r of chunk) {
      placeholders.push(
        `($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},NOW(),$${p++},$${p++}::jsonb)`
      );
      const rowMeta = JSON.stringify({
        open_outbound_po_count: meta.open_outbound_po_count,
        open_inbound_po_count: meta.open_inbound_po_count,
        pos_without_snapshot: meta.pos_without_snapshot,
        unmapped_inbound_line_count: meta.unmapped_inbound_line_count,
        outbound_by_company: r.outbound_by_company,
        companies,
      });
      values.push(
        r.master_sku,
        r.open_actual_po_qty,
        r.open_po_qty_sent,
        r.total_pending,
        r.open_po_fill_rate_pct,
        r.order_placed_by_ops,
        r.app_stock,
        r.order_place_pending,
        meta.source_sync_watermark,
        rowMeta
      );
    }
    await query(
      `INSERT INTO ops_master_sku_po_metrics (
         master_sku, open_actual_po_qty, open_po_qty_sent, total_pending,
         open_po_fill_rate_pct, order_placed_by_ops, app_stock, order_place_pending,
         computed_at, source_sync_watermark, meta
       ) VALUES ${placeholders.join(",")}`,
      values
    );
  }

  const computedAt = new Date().toISOString();
  return { row_count: rows.length, computed_at: computedAt, meta };
}

async function readCachedRows(): Promise<{
  rows: OpsSkuPoControlRow[];
  companies: OpsCompanyOutboundColumn[];
  computed_at: string | null;
  fresh: boolean;
}> {
  const r = await query(
    `SELECT master_sku, open_actual_po_qty, open_po_qty_sent, total_pending,
            open_po_fill_rate_pct, order_placed_by_ops, app_stock, order_place_pending,
            computed_at, meta
     FROM ops_master_sku_po_metrics
     ORDER BY master_sku`,
    []
  );
  if (r.rows.length === 0) {
    return { rows: [], companies: [], computed_at: null, fresh: false };
  }
  const computedAt = r.rows[0]?.computed_at as Date | string | null;
  const computedMs = computedAt ? new Date(computedAt).getTime() : 0;
  const fresh =
    computedMs > 0 && Date.now() - computedMs < CACHE_TTL_HOURS * 3600 * 1000;

  let companies: OpsCompanyOutboundColumn[] = [];
  const rows = (r.rows as Record<string, unknown>[]).map((row) => {
    const meta = (row.meta ?? {}) as Record<string, unknown>;
    if (companies.length === 0 && Array.isArray(meta.companies)) {
      companies = meta.companies as OpsCompanyOutboundColumn[];
    }
    const outbound_by_company =
      meta.outbound_by_company && typeof meta.outbound_by_company === "object"
        ? (meta.outbound_by_company as Record<string, OpsSkuPoCompanyOutbound>)
        : {};
    return {
      master_sku: String(row.master_sku),
      open_actual_po_qty: Number(row.open_actual_po_qty) || 0,
      open_po_qty_sent: Number(row.open_po_qty_sent) || 0,
      total_pending: Number(row.total_pending) || 0,
      open_po_fill_rate_pct:
        row.open_po_fill_rate_pct != null ? Number(row.open_po_fill_rate_pct) : null,
      order_placed_by_ops: Number(row.order_placed_by_ops) || 0,
      app_stock: Number(row.app_stock) || 0,
      order_place_pending: Number(row.order_place_pending) || 0,
      outbound_by_company,
    };
  });

  return {
    rows,
    companies,
    computed_at: computedAt ? new Date(computedAt).toISOString() : null,
    fresh,
  };
}

function sortValueForRow(row: OpsSkuPoControlRow, sortKey: string): string | number {
  if (sortKey === "master_sku") return row.master_sku;
  if (sortKey.startsWith("outbound_pending_")) {
    return row.outbound_by_company[sortKey]?.total_pending ?? 0;
  }
  const v = row[sortKey as keyof OpsSkuPoControlRow];
  if (v == null) return -Infinity;
  if (typeof v === "object") return 0;
  return typeof v === "number" ? v : String(v);
}

function filterAndSortRows(
  rows: OpsSkuPoControlRow[],
  opts: {
    search?: string;
    minTotalPending?: number;
    onlyPlacePending?: boolean;
    sort?: string;
    sortDir?: "asc" | "desc";
  }
): OpsSkuPoControlRow[] {
  let out = rows;
  const t = opts.search?.trim().toLowerCase();
  if (t) {
    out = out.filter((r) => r.master_sku.toLowerCase().includes(t));
  }
  const minTotalPending = opts.minTotalPending;
  if (minTotalPending != null && minTotalPending > 0) {
    out = out.filter((r) => r.total_pending >= minTotalPending);
  }
  if (opts.onlyPlacePending) {
    out = out.filter((r) => r.order_place_pending > 0);
  }

  const sortKey =
    opts.sort &&
    (OPS_SKU_PO_SORT_COLUMNS[opts.sort] || opts.sort.startsWith("outbound_pending_"))
      ? opts.sort
      : "total_pending";
  const dir = opts.sortDir === "asc" ? 1 : -1;
  out = [...out].sort((a, b) => {
    const av = sortValueForRow(a, sortKey);
    const bv = sortValueForRow(b, sortKey);
    if (sortKey === "master_sku") {
      return dir * String(av).localeCompare(String(bv));
    }
    const an = typeof av === "number" ? av : Number(av);
    const bn = typeof bv === "number" ? bv : Number(bv);
    if (an === bn) return a.master_sku.localeCompare(b.master_sku);
    return dir * (an - bn);
  });
  return out;
}

export async function listOpsSkuPoControlPaginated(opts: {
  page: number;
  limit: number;
  search?: string;
  sort?: string;
  sortDir?: "asc" | "desc";
  minTotalPending?: number;
  onlyPlacePending?: boolean;
  useCache?: boolean;
}): Promise<OpsSkuPoControlListResult> {
  const useCache = opts.useCache !== false;
  let allRows: OpsSkuPoControlRow[];
  let companies: OpsCompanyOutboundColumn[] = [];
  let computedFromCache = false;
  let cacheComputedAt: string | null = null;
  let meta: RecomputeMeta;

  const cached = useCache
    ? await readCachedRows()
    : { rows: [], companies: [], computed_at: null, fresh: false };

  if (cached.fresh && cached.rows.length > 0) {
    allRows = cached.rows;
    companies = cached.companies;
    computedFromCache = true;
    cacheComputedAt = cached.computed_at;
    meta = {
      open_outbound_po_count: 0,
      open_inbound_po_count: 0,
      pos_without_snapshot: 0,
      unmapped_inbound_line_count: 0,
      source_sync_watermark: null,
    };
    const metaR = await query(
      `SELECT meta FROM ops_master_sku_po_metrics LIMIT 1`,
      []
    );
    const m = metaR.rows[0]?.meta as Record<string, unknown> | undefined;
    if (m) {
      meta.open_outbound_po_count = Number(m.open_outbound_po_count) || 0;
      meta.open_inbound_po_count = Number(m.open_inbound_po_count) || 0;
      meta.pos_without_snapshot = Number(m.pos_without_snapshot) || 0;
      meta.unmapped_inbound_line_count = Number(m.unmapped_inbound_line_count) || 0;
      if (Array.isArray(m.companies) && companies.length === 0) {
        companies = m.companies as OpsCompanyOutboundColumn[];
      }
    }
  } else {
    const live = await recomputeOpsMasterSkuPoMetrics();
    allRows = live.rows;
    companies = live.companies;
    meta = live.meta;
  }

  const filtered = filterAndSortRows(allRows, opts);
  const total = filtered.length;
  const offset = (opts.page - 1) * opts.limit;
  const pageRows = filtered.slice(offset, offset + opts.limit);

  return {
    total,
    current_page: opts.page,
    per_page_count: opts.limit,
    curr_page_count: pageRows.length,
    content: pageRows,
    companies,
    summary: buildSummary(filtered),
    meta: {
      computed_from_cache: computedFromCache,
      cache_computed_at: cacheComputedAt,
      open_outbound_po_count: meta.open_outbound_po_count,
      open_inbound_po_count: meta.open_inbound_po_count,
      pos_without_snapshot: meta.pos_without_snapshot,
      unmapped_inbound_line_count: meta.unmapped_inbound_line_count,
    },
  };
}

export async function getOpsSkuPoControlDetail(
  masterSku: string
): Promise<{
  master_sku: string;
  totals: OpsSkuPoControlRow | null;
  companies: OpsCompanyOutboundColumn[];
  outbound_lines: OpsSkuPoOutboundLine[];
  inbound_lines: OpsSkuPoInboundLine[];
}> {
  const sku = masterSku.trim();
  const live = await recomputeOpsMasterSkuPoMetrics();
  const totals = live.rows.find((r) => r.master_sku === sku) ?? null;

  const outbound_lines: OpsSkuPoOutboundLine[] = [];
  const outboundR = await query(
    `SELECT o.id, o.po_number, COALESCE(o.company_name, c.name) AS company_name,
            o.listings_snapshot
     FROM outbound_purchase_orders o
     LEFT JOIN companies c ON c.id = o.company_id
     WHERE ${OPEN_OUTBOUND_PO_SQL}`,
    []
  );

  for (const po of outboundR.rows as Record<string, unknown>[]) {
    const lines = extractListingsRowsFromSnapshot(po.listings_snapshot);
    for (const line of lines) {
      const n = normalizeOutboundListingLine(line);
      if (n.master_sku !== sku) continue;
      outbound_lines.push({
        outbound_po_id: Number(po.id),
        po_number: String(po.po_number ?? ""),
        company_name: po.company_name != null ? String(po.company_name) : null,
        po_secondary_sku: n.po_secondary_sku,
        line_demand: n.demand,
        line_packed: n.packed,
        line_dispatched: n.dispatched,
        line_pending: n.pending_line,
      });
    }
  }

  const inbound_lines: OpsSkuPoInboundLine[] = [];

  const eautomateLinesR = await query(
    `SELECT l.po_id, l.sku_id, l.raw, po.vendor_id, po.vendor_name, po.status
     FROM inbound_po_detail_lines l
     INNER JOIN vendor_purchase_orders po ON po.po_id = l.po_id
     WHERE ${OPEN_INBOUND_VENDOR_PO_SQL}`,
    []
  );

  const skuToMasterR = await query(
    `SELECT sku_id, master_sku FROM listings WHERE master_sku IS NOT NULL`,
    []
  );
  const skuToMaster = new Map<string, string>();
  for (const r of skuToMasterR.rows as { sku_id: string; master_sku: string }[]) {
    skuToMaster.set(r.sku_id, r.master_sku.trim());
  }

  for (const row of eautomateLinesR.rows as Record<string, unknown>[]) {
    const raw = (row.raw ?? {}) as Record<string, unknown>;
    const skuId = String(row.sku_id ?? raw.sku_id ?? "").trim();
    const masterKey = skuToMaster.get(skuId) ?? skuId;
    if (masterKey !== sku) continue;
    const qty = parseInboundLineQty(raw);
    if (qty <= 0) continue;
    inbound_lines.push({
      vendor_po_id: Number(row.po_id),
      vendor_id: Number(row.vendor_id),
      vendor_name: row.vendor_name != null ? String(row.vendor_name) : null,
      sku_id: skuId,
      line_quantity: qty,
      po_status: row.status != null ? String(row.status) : null,
    });
  }

  const zapLinesR = await query(
    `SELECT vl.po_id, vl.sku_id, vl.quantity, po.vendor_id, po.vendor_name, po.status
     FROM vendor_purchase_order_lines vl
     INNER JOIN vendor_purchase_orders po ON po.po_id = vl.po_id
     WHERE po.source = 'zap' AND ${OPEN_INBOUND_VENDOR_PO_SQL}`,
    []
  );

  for (const row of zapLinesR.rows as Record<string, unknown>[]) {
    const skuId = String(row.sku_id);
    const masterKey = skuToMaster.get(skuId) ?? skuId;
    if (masterKey !== sku) continue;
    inbound_lines.push({
      vendor_po_id: Number(row.po_id),
      vendor_id: Number(row.vendor_id),
      vendor_name: row.vendor_name != null ? String(row.vendor_name) : null,
      sku_id: skuId,
      line_quantity: Number(row.quantity) || 0,
      po_status: row.status != null ? String(row.status) : null,
    });
  }

  return { master_sku: sku, totals, outbound_lines, inbound_lines, companies: live.companies };
}

export function opsSkuPoControlRowsToCsv(
  rows: OpsSkuPoControlRow[],
  companies: OpsCompanyOutboundColumn[] = []
): string {
  const headers = [
    "master_sku",
    "open_actual_po_qty",
    "open_po_qty_sent",
    "open_po_fill_rate_pct",
    "total_pending",
    ...companies.flatMap((c) => [
      `${c.name} open_actual`,
      `${c.name} qty_sent`,
      `${c.name} pending`,
    ]),
    "order_place_pending",
    "order_placed_by_ops",
    "app_stock",
  ];
  const escape = (v: string) => {
    if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    const companyCells = companies.flatMap((c) => {
      const co = r.outbound_by_company[c.column_key];
      return [
        String(co?.open_actual_po_qty ?? 0),
        String(co?.open_po_qty_sent ?? 0),
        String(co?.total_pending ?? 0),
      ];
    });
    lines.push(
      [
        r.master_sku,
        String(r.open_actual_po_qty),
        String(r.open_po_qty_sent),
        r.open_po_fill_rate_pct != null ? String(r.open_po_fill_rate_pct) : "",
        String(r.total_pending),
        ...companyCells,
        String(r.order_place_pending),
        String(r.order_placed_by_ops),
        String(r.app_stock),
      ]
        .map(escape)
        .join(",")
    );
  }
  return `\ufeff${lines.join("\n")}`;
}
