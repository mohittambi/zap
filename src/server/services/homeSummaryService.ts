import { query } from "@/server/db";
import { getReorderMetrics } from "@/server/services/reorderService";
import { AppError } from "@/server/errors";
import {
  defaultSummaryRange,
  isIsoDay,
  parseIsoDayUtc,
} from "@/lib/dashboard-date-range";

// KPI windows use caller-selected [from, to) (exclusive end). MoM compares to the
// previous period of equal length; YoY compares to the same window one year earlier.

export type Delta = {
  value: number;
  prev_mom: number | null;
  prev_yoy: number | null;
  delta_mom_pct: number | null;
  delta_yoy_pct: number | null;
};

export type TrendPoint = {
  day: string;
  v: number;
  v_prev_year: number;
  // Signed z-score over a trailing 30-day window when |z| >= ANOMALY_Z_THRESHOLD,
  // null otherwise. Renders as a red dot on the chart.
  anomaly_z: number | null;
};

const ANOMALY_Z_THRESHOLD = 2.5;
const ANOMALY_WINDOW_DAYS = 30;

/**
 * Flag points that are >|2.5σ| from the trailing-30-day mean. Returns z-score
 * keyed by `day`. Points before the warmup are never flagged (insufficient
 * history to be statistically meaningful).
 */
export function flagAnomalies(
  series: { day: string; v: number }[]
): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = ANOMALY_WINDOW_DAYS; i < series.length; i++) {
    const win = series.slice(i - ANOMALY_WINDOW_DAYS, i);
    const mean = win.reduce((s, p) => s + p.v, 0) / ANOMALY_WINDOW_DAYS;
    const variance =
      win.reduce((s, p) => s + (p.v - mean) ** 2, 0) / ANOMALY_WINDOW_DAYS;
    const sd = Math.sqrt(variance);
    if (sd === 0) continue;
    const z = (series[i].v - mean) / sd;
    if (Math.abs(z) >= ANOMALY_Z_THRESHOLD) out.set(series[i].day, z);
  }
  return out;
}

// ── Phase 2 additions ────────────────────────────────────────────────────────

export type OpsQueues = {
  audit_pending: number;
  invoice_collection_pending: number;
  debit_credit_notes_pending: number;
};

export type OpenPosStat = { open: number; aged_over_7d: number };

export type VendorQuality = {
  // Both rates are 0–100; deltas computed against the 30-day trailing window.
  acceptance_rate_pct: Delta;
  shortage_rate_pct: Delta;
};

export type InventorySnapshot = { units_on_hand: number; skus_at_zero: number };

export type ChannelMixRow = { company: string; qty: number };

export type SkuMovementRow = {
  sku_id: string;
  description: string | null;
  qty_30d: number;
  qty_60d: number;
  qty_90d: number;
  available_qty: number;
};

export type DeadStockRow = {
  sku_id: string;
  description: string | null;
  available_qty: number;
  // Days since the last 'SALE' movement; null if never sold.
  days_since_last_sale: number | null;
};

export type StockoutRiskRow = {
  sku_id: string;
  description: string | null;
  available_qty: number;
  sold_30d: number;
  // Calendar days of cover at current 30d burn rate. Null when sold_30d == 0
  // (treated separately as "dead stock" — see dead_stock card).
  days_of_cover: number | null;
};

// Catalogue health by velocity — constants + type live in @/lib/skuVelocity
// so Client Components can import them without pulling in the server bundle.
export {
  SKU_VELOCITY_FAST_THRESHOLD,
  SKU_VELOCITY_MEDIUM_THRESHOLD,
  type SkuVelocityBuckets,
} from "@/lib/skuVelocity";
import {
  SKU_VELOCITY_FAST_THRESHOLD,
  SKU_VELOCITY_MEDIUM_THRESHOLD,
  type SkuVelocityBuckets,
} from "@/lib/skuVelocity";

export type HomeSummary = {
  range: { from: string; to: string };
  scoped: { company_id: number | null; company_name: string | null };
  // inbound is currently never company-scoped — vendor purchase order lines and
  // the company_secondary_sku map are sparsely populated, so true attribution
  // would yield near-zero values. We always show it across all vendors.
  inbound_scope: "all_vendors";
  kpis: {
    sales_qty: Delta;
    sales_pos: Delta;
    fill_rate_pct: Delta;
    inbound_qty: Delta;
    skus_below_reorder: { value: number; prev_mom: null; prev_yoy: null };
    gmv_value_30d: Delta;
  };
  ops_queues: OpsQueues;
  open_pos: OpenPosStat;
  vendor_quality: VendorQuality;
  inventory_snapshot: InventorySnapshot;
  // null when a company filter is active — channel-mix is only meaningful unfiltered.
  channel_mix: ChannelMixRow[] | null;
  trends: {
    sales_qty_daily: TrendPoint[];
    inbound_qty_daily: TrendPoint[];
  };
  reorder_top: Awaited<ReturnType<typeof getReorderMetrics>>["data"];
  sku_movement: SkuMovementRow[];
  dead_stock: DeadStockRow[];
  stockout_risk: StockoutRiskRow[];
  sku_velocity: SkuVelocityBuckets;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_DAYS = 365;
const MAX_RANGE_DAYS = 365;

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type SummaryWindows = {
  curStart: Date;
  curEnd: Date;
  momStart: Date;
  momEnd: Date;
  yoyStart: Date;
  yoyEnd: Date;
};

/** Build MoM/YoY comparison windows from the selected [curStart, curEnd) range. */
export function buildWindows(curStart: Date, curEnd: Date): SummaryWindows {
  const spanMs = curEnd.getTime() - curStart.getTime();
  const momEnd = curStart;
  const momStart = new Date(momEnd.getTime() - spanMs);
  const yoyEnd = new Date(curEnd.getTime() - YEAR_DAYS * DAY_MS);
  const yoyStart = new Date(curStart.getTime() - YEAR_DAYS * DAY_MS);
  return { curStart, curEnd, momStart, momEnd, yoyStart, yoyEnd };
}

export function resolveSummaryDateRange(opts: {
  from?: string;
  to?: string;
  now?: Date;
}): { curStart: Date; curEnd: Date } {
  const now = opts.now ?? new Date();
  const todayStart = startOfUtcDay(now);

  if (opts.from == null && opts.to == null) {
    const fallback = defaultSummaryRange(now);
    return {
      curStart: parseIsoDayUtc(fallback.from),
      curEnd: parseIsoDayUtc(fallback.to),
    };
  }

  if (opts.from == null || opts.to == null) {
    throw new AppError("Both from and to are required when specifying a date range", 400);
  }
  if (!isIsoDay(opts.from) || !isIsoDay(opts.to)) {
    throw new AppError("from and to must be YYYY-MM-DD", 400);
  }

  const curStart = parseIsoDayUtc(opts.from);
  const curEnd = parseIsoDayUtc(opts.to);

  if (curStart.getTime() >= curEnd.getTime()) {
    throw new AppError("from must be before to", 400);
  }
  if (curEnd.getTime() > todayStart.getTime()) {
    throw new AppError("to cannot be in the future", 400);
  }

  const spanDays = (curEnd.getTime() - curStart.getTime()) / DAY_MS;
  if (spanDays > MAX_RANGE_DAYS) {
    throw new AppError(`Date range cannot exceed ${MAX_RANGE_DAYS} days`, 400);
  }

  return { curStart, curEnd };
}

export function computeDelta(value: number, prev: number | null): number | null {
  if (prev == null || prev === 0) return null;
  return ((value - prev) / prev) * 100;
}

type Windows = SummaryWindows;

async function sumWindow(
  sql: (start: string, end: string, paramOffset: number) => { text: string; params: unknown[] },
  windows: Windows
): Promise<{ value: number; prev_mom: number; prev_yoy: number }> {
  const cur = sql(isoDay(windows.curStart), isoDay(windows.curEnd), 0);
  const mom = sql(isoDay(windows.momStart), isoDay(windows.momEnd), 0);
  const yoy = sql(isoDay(windows.yoyStart), isoDay(windows.yoyEnd), 0);
  const [curR, momR, yoyR] = await Promise.all([
    query(cur.text, cur.params),
    query(mom.text, mom.params),
    query(yoy.text, yoy.params),
  ]);
  return {
    value: Number(curR.rows[0]?.v ?? 0),
    prev_mom: Number(momR.rows[0]?.v ?? 0),
    prev_yoy: Number(yoyR.rows[0]?.v ?? 0),
  };
}

function asDelta(v: { value: number; prev_mom: number; prev_yoy: number }): Delta {
  return {
    value: v.value,
    prev_mom: v.prev_mom,
    prev_yoy: v.prev_yoy,
    delta_mom_pct: computeDelta(v.value, v.prev_mom),
    delta_yoy_pct: computeDelta(v.value, v.prev_yoy),
  };
}

// ── KPI builders ─────────────────────────────────────────────────────────────

// outbound_consignments.company_id is currently NULL on every row in production
// data (only company_name is populated by the upstream sync). Match on either
// so the company filter actually returns those rows; the OR is harmless when
// company_id is correctly populated (e.g. on outbound_purchase_orders).
function buildCompanyFilter(
  alias: string,
  companyId: number | null,
  companyName: string | null,
  startIdx: number
): { sql: string; params: unknown[] } {
  if (companyId == null) return { sql: "", params: [] };
  const idP = `$${startIdx}`;
  if (companyName == null) {
    return { sql: ` AND ${alias}company_id = ${idP}`, params: [companyId] };
  }
  const nameP = `$${startIdx + 1}`;
  return {
    sql: ` AND (${alias}company_id = ${idP} OR ${alias}company_name = ${nameP})`,
    params: [companyId, companyName],
  };
}

async function lookupCompanyName(companyId: number): Promise<string | null> {
  const r = await query(
    `SELECT name FROM companies WHERE id = $1 LIMIT 1`,
    [companyId]
  );
  const name = r.rows[0]?.name;
  return name == null ? null : String(name);
}

function salesQtySql(companyId: number | null, companyName: string | null) {
  return (start: string, end: string) => {
    const params: unknown[] = [start, end];
    const filter = buildCompanyFilter("", companyId, companyName, 3);
    params.push(...filter.params);
    return {
      text: `SELECT COALESCE(SUM(total_quantity), 0)::bigint AS v
             FROM outbound_consignments
             WHERE marked_rtd_at >= $1::timestamptz
               AND marked_rtd_at < $2::timestamptz${filter.sql}`,
      params,
    };
  };
}

function salesPosSql(companyId: number | null, companyName: string | null) {
  return (start: string, end: string) => {
    const params: unknown[] = [start, end];
    const filter = buildCompanyFilter("", companyId, companyName, 3);
    params.push(...filter.params);
    return {
      text: `SELECT COUNT(*)::bigint AS v
             FROM outbound_purchase_orders
             WHERE po_issue_date >= $1::timestamptz
               AND po_issue_date < $2::timestamptz${filter.sql}`,
      params,
    };
  };
}

function fillRateSql(companyId: number | null, companyName: string | null) {
  return (start: string, end: string) => {
    const params: unknown[] = [start, end];
    const filter = buildCompanyFilter("c.", companyId, companyName, 3);
    params.push(...filter.params);
    // overall_fill_rate is stored as a fraction (0–1); multiply by 100 for percent.
    return {
      text: `SELECT COALESCE(
                SUM(ci.overall_fill_rate * COALESCE(ci.consignment_quantity, ci.dispatched_quantity))
                  / NULLIF(SUM(COALESCE(ci.consignment_quantity, ci.dispatched_quantity)), 0) * 100,
                0)::numeric AS v
             FROM outbound_consignment_items ci
             JOIN outbound_consignments c ON c.id = ci.consignment_id
             WHERE c.marked_rtd_at >= $1::timestamptz
               AND c.marked_rtd_at < $2::timestamptz${filter.sql}`,
      params,
    };
  };
}

function inboundQtySql() {
  return (start: string, end: string) => ({
    text: `SELECT COALESCE(SUM(grn_accepted_quantity), 0)::bigint AS v
           FROM inbound_grns
           WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz`,
    params: [start, end],
  });
}

// Dispatched MRP value: sum(consignment_quantity * mrp) for consignments
// marked RTD in the window. Rows missing mrp contribute 0 to the sum.
function gmvValueSql(companyId: number | null, companyName: string | null) {
  return (start: string, end: string) => {
    const params: unknown[] = [start, end];
    const filter = buildCompanyFilter("c.", companyId, companyName, 3);
    params.push(...filter.params);
    return {
      text: `SELECT COALESCE(
                SUM(COALESCE(ci.consignment_quantity, ci.dispatched_quantity) * ci.mrp),
                0)::numeric AS v
             FROM outbound_consignment_items ci
             JOIN outbound_consignments c ON c.id = ci.consignment_id
             WHERE c.marked_rtd_at >= $1::timestamptz
               AND c.marked_rtd_at < $2::timestamptz${filter.sql}`,
      params,
    };
  };
}

// ── Phase 2 aggregations ─────────────────────────────────────────────────────

async function getOpsQueues(): Promise<OpsQueues> {
  // All three are "pending" tables by definition — the upstream sync truncates
  // and repopulates with rows that still need action. No status filter needed.
  const r = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM inbound_grn_pending_audit)              AS audit_pending,
       (SELECT COUNT(*)::int FROM inbound_grn_pending_invoice_collection) AS invoice_collection_pending,
       (SELECT COUNT(*)::int FROM inbound_pending_debit_credit_notes)     AS debit_credit_notes_pending`
  );
  const row = r.rows[0] as {
    audit_pending: number;
    invoice_collection_pending: number;
    debit_credit_notes_pending: number;
  };
  return {
    audit_pending: Number(row.audit_pending),
    invoice_collection_pending: Number(row.invoice_collection_pending),
    debit_credit_notes_pending: Number(row.debit_credit_notes_pending),
  };
}

async function getOpenPos(
  companyId: number | null,
  companyName: string | null
): Promise<OpenPosStat> {
  const filter = buildCompanyFilter("", companyId, companyName, 1);
  const params = filter.params;
  const r = await query(
    `SELECT
       COUNT(*)::int                                                   AS open,
       COUNT(*) FILTER (WHERE po_issue_date < NOW() - INTERVAL '7 days')::int AS aged_over_7d
     FROM   outbound_purchase_orders
     WHERE  calculated_po_status IN ('OPEN', 'ACKNOWLEDGEMENT PENDING')${filter.sql}`,
    params
  );
  const row = r.rows[0] as { open: number; aged_over_7d: number };
  return { open: Number(row.open), aged_over_7d: Number(row.aged_over_7d) };
}

function vendorRateSql(rateColumn: "grn_accepted_quantity" | "grn_shortage_quantity") {
  return (start: string, end: string) => ({
    text: `SELECT COALESCE(
              SUM(${rateColumn})::numeric / NULLIF(SUM(grn_invoice_quantity), 0) * 100,
              0)::numeric AS v
           FROM inbound_grns
           WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz`,
    params: [start, end],
  });
}

async function getInventorySnapshot(): Promise<InventorySnapshot> {
  const r = await query(
    `SELECT
       (SELECT COALESCE(SUM(available_quantity), 0)::bigint
          FROM bins WHERE is_deleted = false)                                AS units_on_hand,
       (SELECT COUNT(*)::int FROM (
          SELECT 1
          FROM   listings l
          LEFT   JOIN bins b ON b.sku_id = l.sku_id AND b.is_deleted = false
          GROUP  BY l.sku_id
          HAVING COALESCE(SUM(b.available_quantity), 0) = 0
        ) x)                                                                 AS skus_at_zero`
  );
  const row = r.rows[0] as { units_on_hand: string | number; skus_at_zero: number };
  return {
    units_on_hand: Number(row.units_on_hand),
    skus_at_zero: Number(row.skus_at_zero),
  };
}

// ── SKU movement / health builders ───────────────────────────────────────────

/**
 * Top N SKUs by 30-day movement (units sold). Returns 30/60/90-day totals so
 * callers can compare velocity trends, plus current on-hand availability.
 */
async function getSkuMovement(limit: number): Promise<SkuMovementRow[]> {
  const r = await query(
    `WITH movement AS (
       SELECT sku_id,
              SUM(quantity) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS qty_30d,
              SUM(quantity) FILTER (WHERE created_at >= NOW() - INTERVAL '60 days')::int AS qty_60d,
              SUM(quantity) FILTER (WHERE created_at >= NOW() - INTERVAL '90 days')::int AS qty_90d
       FROM   warehouse_inventory_dump
       WHERE  inventory_operation_type = 'REMOVE'
         AND  (movement_type IS NULL OR movement_type = 'SALE')
         AND  created_at >= NOW() - INTERVAL '90 days'
       GROUP  BY sku_id
     ),
     on_hand AS (
       SELECT sku_id, SUM(available_quantity)::int AS available_qty
       FROM   bins
       WHERE  is_deleted = false
       GROUP  BY sku_id
     )
     SELECT l.sku_id,
            l.description,
            COALESCE(m.qty_30d, 0)            AS qty_30d,
            COALESCE(m.qty_60d, 0)            AS qty_60d,
            COALESCE(m.qty_90d, 0)            AS qty_90d,
            COALESCE(oh.available_qty, 0)     AS available_qty
     FROM   listings l
     JOIN   movement m   ON m.sku_id  = l.sku_id
     LEFT   JOIN on_hand oh ON oh.sku_id = l.sku_id
     ORDER  BY m.qty_30d DESC NULLS LAST, m.qty_60d DESC NULLS LAST
     LIMIT  $1`,
    [limit]
  );
  return r.rows.map((row) => ({
    sku_id: String(row.sku_id),
    description: row.description == null ? null : String(row.description),
    qty_30d: Number(row.qty_30d),
    qty_60d: Number(row.qty_60d),
    qty_90d: Number(row.qty_90d),
    available_qty: Number(row.available_qty),
  }));
}

/**
 * SKUs with on-hand stock but no SALE movement in the last 60 days.
 * "days_since_last_sale" is null when the SKU has never been sold.
 */
async function getDeadStock(limit: number): Promise<DeadStockRow[]> {
  const r = await query(
    `WITH last_sale AS (
       SELECT sku_id, MAX(created_at) AS last_sale_at
       FROM   warehouse_inventory_dump
       WHERE  inventory_operation_type = 'REMOVE'
         AND  (movement_type IS NULL OR movement_type = 'SALE')
       GROUP  BY sku_id
     ),
     on_hand AS (
       SELECT sku_id, SUM(available_quantity)::int AS available_qty
       FROM   bins
       WHERE  is_deleted = false
       GROUP  BY sku_id
       HAVING SUM(available_quantity) > 0
     )
     SELECT l.sku_id,
            l.description,
            oh.available_qty,
            CASE WHEN ls.last_sale_at IS NULL THEN NULL
                 ELSE EXTRACT(EPOCH FROM (NOW() - ls.last_sale_at))::numeric / 86400
            END AS days_since_last_sale
     FROM   on_hand oh
     JOIN   listings  l  ON l.sku_id  = oh.sku_id
     LEFT   JOIN last_sale ls ON ls.sku_id = oh.sku_id
     WHERE  ls.last_sale_at IS NULL
        OR  ls.last_sale_at < NOW() - INTERVAL '60 days'
     ORDER  BY oh.available_qty DESC, ls.last_sale_at ASC NULLS FIRST
     LIMIT  $1`,
    [limit]
  );
  return r.rows.map((row) => ({
    sku_id: String(row.sku_id),
    description: row.description == null ? null : String(row.description),
    available_qty: Number(row.available_qty),
    days_since_last_sale:
      row.days_since_last_sale == null
        ? null
        : Math.floor(Number(row.days_since_last_sale)),
  }));
}

/**
 * SKUs projected to run out within 14 days at current 30-day burn rate.
 * Excludes SKUs with no 30-day sales (those are dead stock, not stockout risk).
 */
async function getStockoutRisk(limit: number): Promise<StockoutRiskRow[]> {
  const r = await query(
    `WITH sales_30d AS (
       SELECT sku_id, SUM(quantity)::int AS sold_30d
       FROM   warehouse_inventory_dump
       WHERE  inventory_operation_type = 'REMOVE'
         AND  (movement_type IS NULL OR movement_type = 'SALE')
         AND  created_at >= NOW() - INTERVAL '30 days'
       GROUP  BY sku_id
       HAVING SUM(quantity) > 0
     ),
     on_hand AS (
       SELECT sku_id, SUM(available_quantity)::int AS available_qty
       FROM   bins
       WHERE  is_deleted = false
       GROUP  BY sku_id
     )
     SELECT l.sku_id,
            l.description,
            COALESCE(oh.available_qty, 0)               AS available_qty,
            s.sold_30d,
            COALESCE(oh.available_qty, 0)::numeric
              / NULLIF(s.sold_30d, 0) * 30              AS days_of_cover
     FROM   sales_30d s
     JOIN   listings l   ON l.sku_id  = s.sku_id
     LEFT   JOIN on_hand oh ON oh.sku_id = s.sku_id
     WHERE  COALESCE(oh.available_qty, 0)::numeric
              / NULLIF(s.sold_30d, 0) * 30 < 14
     ORDER  BY days_of_cover ASC NULLS FIRST, s.sold_30d DESC
     LIMIT  $1`,
    [limit]
  );
  return r.rows.map((row) => ({
    sku_id: String(row.sku_id),
    description: row.description == null ? null : String(row.description),
    available_qty: Number(row.available_qty),
    sold_30d: Number(row.sold_30d),
    days_of_cover:
      row.days_of_cover == null ? null : Number(row.days_of_cover),
  }));
}

async function getSkuVelocityBuckets(): Promise<SkuVelocityBuckets> {
  const r = await query(
    `WITH sales_30d AS (
       SELECT sku_id, SUM(quantity)::int AS sold_30d
       FROM   warehouse_inventory_dump
       WHERE  inventory_operation_type = 'REMOVE'
         AND  (movement_type IS NULL OR movement_type = 'SALE')
         AND  created_at >= NOW() - INTERVAL '30 days'
       GROUP  BY sku_id
     ),
     on_hand AS (
       SELECT sku_id, SUM(available_quantity)::int AS available_qty
       FROM   bins
       WHERE  is_deleted = false
       GROUP  BY sku_id
     )
     SELECT
       COUNT(*) FILTER (WHERE COALESCE(s.sold_30d, 0) >= $1)::int                                                   AS fast,
       COUNT(*) FILTER (WHERE COALESCE(s.sold_30d, 0) >= $2 AND COALESCE(s.sold_30d, 0) < $1)::int                  AS medium,
       COUNT(*) FILTER (WHERE COALESCE(s.sold_30d, 0) >  0 AND COALESCE(s.sold_30d, 0) < $2)::int                   AS slow,
       COUNT(*) FILTER (WHERE COALESCE(s.sold_30d, 0) =  0 AND COALESCE(oh.available_qty, 0) > 0)::int              AS dead
     FROM   listings l
     LEFT   JOIN sales_30d s ON s.sku_id  = l.sku_id
     LEFT   JOIN on_hand  oh ON oh.sku_id = l.sku_id`,
    [SKU_VELOCITY_FAST_THRESHOLD, SKU_VELOCITY_MEDIUM_THRESHOLD]
  );
  const row = r.rows[0] as {
    fast: number;
    medium: number;
    slow: number;
    dead: number;
  };
  return {
    fast: Number(row.fast),
    medium: Number(row.medium),
    slow: Number(row.slow),
    dead: Number(row.dead),
  };
}

async function getChannelMix(windows: Windows): Promise<ChannelMixRow[]> {
  const r = await query(
    `SELECT COALESCE(c.name, oc.company_name) AS company,
            SUM(oc.total_quantity)::bigint     AS qty
     FROM   outbound_consignments oc
     LEFT   JOIN companies c
            ON c.id = oc.company_id OR c.name = oc.company_name
     WHERE  oc.marked_rtd_at >= $1::timestamptz
       AND  oc.marked_rtd_at < $2::timestamptz
       AND  COALESCE(c.name, oc.company_name) IS NOT NULL
     GROUP  BY 1
     ORDER  BY qty DESC NULLS LAST
     LIMIT  5`,
    [isoDay(windows.curStart), isoDay(windows.curEnd)]
  );
  return r.rows.map((row) => ({
    company: String(row.company),
    qty: Number(row.qty),
  }));
}

// ── Daily trend series ───────────────────────────────────────────────────────

async function dailyTrend(
  table: "outbound_consignments" | "inbound_grns",
  windows: Windows,
  companyId: number | null,
  companyName: string | null
): Promise<TrendPoint[]> {
  const trendStart = windows.curStart;
  const trendEnd = windows.curEnd;
  const prevYearStart = new Date(trendStart.getTime() - YEAR_DAYS * DAY_MS);
  const prevYearEnd = new Date(trendEnd.getTime() - YEAR_DAYS * DAY_MS);

  let curText: string;
  let prevText: string;
  const curParams: unknown[] = [isoDay(trendStart), isoDay(trendEnd)];
  const prevParams: unknown[] = [isoDay(prevYearStart), isoDay(prevYearEnd)];

  if (table === "outbound_consignments") {
    const filter = buildCompanyFilter("", companyId, companyName, 3);
    curParams.push(...filter.params);
    prevParams.push(...filter.params);
    curText = `
      SELECT date_trunc('day', marked_rtd_at)::date::text AS day,
             COALESCE(SUM(total_quantity), 0)::bigint AS v
      FROM   outbound_consignments
      WHERE  marked_rtd_at >= $1::timestamptz
        AND  marked_rtd_at < $2::timestamptz${filter.sql}
      GROUP  BY 1`;
    prevText = curText;
  } else {
    curText = `
      SELECT date_trunc('day', created_at)::date::text AS day,
             COALESCE(SUM(grn_accepted_quantity), 0)::bigint AS v
      FROM   inbound_grns
      WHERE  created_at >= $1::timestamptz AND created_at < $2::timestamptz
      GROUP  BY 1`;
    prevText = curText;
  }

  const [curR, prevR] = await Promise.all([query(curText, curParams), query(prevText, prevParams)]);

  const curMap = new Map<string, number>();
  for (const r of curR.rows as { day: string; v: string | number }[]) {
    curMap.set(r.day, Number(r.v));
  }
  const prevMap = new Map<string, number>();
  for (const r of prevR.rows as { day: string; v: string | number }[]) {
    // Re-key prev-year rows to the corresponding current-year day so the chart can overlay.
    const d = new Date(`${r.day}T00:00:00Z`);
    const aligned = new Date(d.getTime() + YEAR_DAYS * DAY_MS);
    prevMap.set(isoDay(aligned), Number(r.v));
  }

  const dense: { day: string; v: number; v_prev_year: number }[] = [];
  for (let t = trendStart.getTime(); t < trendEnd.getTime(); t += DAY_MS) {
    const day = isoDay(new Date(t));
    dense.push({
      day,
      v: curMap.get(day) ?? 0,
      v_prev_year: prevMap.get(day) ?? 0,
    });
  }
  const anomalies = flagAnomalies(dense.map((p) => ({ day: p.day, v: p.v })));
  const out: TrendPoint[] = dense.map((p) => ({
    ...p,
    anomaly_z: anomalies.get(p.day) ?? null,
  }));
  return out;
}

// ── Public ───────────────────────────────────────────────────────────────────

export async function getHomeSummary(opts: {
  companyId?: number | null;
  from?: string;
  to?: string;
  now?: Date;
}): Promise<HomeSummary> {
  const companyId = opts.companyId ?? null;
  const now = opts.now ?? new Date();
  const { curStart, curEnd } = resolveSummaryDateRange({
    from: opts.from,
    to: opts.to,
    now,
  });
  const windows = buildWindows(curStart, curEnd);
  const companyName = companyId == null ? null : await lookupCompanyName(companyId);

  // Inbound is always company-agnostic — see HomeSummary.inbound_scope.
  const [
    salesQty,
    salesPos,
    fillRate,
    inboundQty,
    gmvValue,
    reorder,
    salesTrend,
    inboundTrend,
    opsQueues,
    openPos,
    acceptanceRate,
    shortageRate,
    inventorySnapshot,
    channelMix,
    skuMovement,
    deadStock,
    stockoutRisk,
    skuVelocity,
  ] = await Promise.all([
    sumWindow(salesQtySql(companyId, companyName), windows),
    sumWindow(salesPosSql(companyId, companyName), windows),
    sumWindow(fillRateSql(companyId, companyName), windows),
    sumWindow(inboundQtySql(), windows),
    sumWindow(gmvValueSql(companyId, companyName), windows),
    getReorderMetrics({ alertsOnly: true, page: 1, limit: 8 }),
    dailyTrend("outbound_consignments", windows, companyId, companyName),
    dailyTrend("inbound_grns", windows, null, null),
    getOpsQueues(),
    getOpenPos(companyId, companyName),
    sumWindow(vendorRateSql("grn_accepted_quantity"), windows),
    sumWindow(vendorRateSql("grn_shortage_quantity"), windows),
    getInventorySnapshot(),
    // channel-mix only when no company filter — otherwise the breakdown is meaningless.
    companyId == null ? getChannelMix(windows) : Promise.resolve(null),
    getSkuMovement(15),
    getDeadStock(15),
    getStockoutRisk(15),
    getSkuVelocityBuckets(),
  ]);

  return {
    range: { from: isoDay(windows.curStart), to: isoDay(windows.curEnd) },
    scoped: { company_id: companyId, company_name: companyName },
    inbound_scope: "all_vendors",
    kpis: {
      sales_qty: asDelta(salesQty),
      sales_pos: asDelta(salesPos),
      fill_rate_pct: asDelta(fillRate),
      inbound_qty: asDelta(inboundQty),
      skus_below_reorder: { value: reorder.total, prev_mom: null, prev_yoy: null },
      gmv_value_30d: asDelta(gmvValue),
    },
    ops_queues: opsQueues,
    open_pos: openPos,
    vendor_quality: {
      acceptance_rate_pct: asDelta(acceptanceRate),
      shortage_rate_pct: asDelta(shortageRate),
    },
    inventory_snapshot: inventorySnapshot,
    channel_mix: channelMix,
    trends: {
      sales_qty_daily: salesTrend,
      inbound_qty_daily: inboundTrend,
    },
    reorder_top: reorder.data,
    sku_movement: skuMovement,
    dead_stock: deadStock,
    stockout_risk: stockoutRisk,
    sku_velocity: skuVelocity,
  };
}
