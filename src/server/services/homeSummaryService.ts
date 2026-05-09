import { query } from "@/server/db";
import { getReorderMetrics } from "@/server/services/reorderService";

// Trailing-30-day windows anchored at "today 00:00 UTC". MoM compares to the
// 30 days before that; YoY compares to the same 30-day window one year earlier.

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
};

const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_DAYS = 365;

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function computeDelta(value: number, prev: number | null): number | null {
  if (prev == null || prev === 0) return null;
  return ((value - prev) / prev) * 100;
}

type Windows = {
  curStart: Date;
  curEnd: Date;
  momStart: Date;
  momEnd: Date;
  yoyStart: Date;
  yoyEnd: Date;
};

function buildWindows(now: Date): Windows {
  const curEnd = startOfUtcDay(now);
  const curStart = new Date(curEnd.getTime() - 30 * DAY_MS);
  const momEnd = curStart;
  const momStart = new Date(momEnd.getTime() - 30 * DAY_MS);
  const yoyEnd = new Date(curEnd.getTime() - YEAR_DAYS * DAY_MS);
  const yoyStart = new Date(yoyEnd.getTime() - 30 * DAY_MS);
  return { curStart, curEnd, momStart, momEnd, yoyStart, yoyEnd };
}

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
                SUM(ci.overall_fill_rate * ci.consignment_quantity)
                  / NULLIF(SUM(ci.consignment_quantity), 0) * 100,
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
  const trendStart = new Date(windows.curEnd.getTime() - 90 * DAY_MS);
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
  now?: Date;
}): Promise<HomeSummary> {
  const companyId = opts.companyId ?? null;
  const now = opts.now ?? new Date();
  const windows = buildWindows(now);
  const companyName = companyId == null ? null : await lookupCompanyName(companyId);

  // Inbound is always company-agnostic — see HomeSummary.inbound_scope.
  const [
    salesQty,
    salesPos,
    fillRate,
    inboundQty,
    reorder,
    salesTrend,
    inboundTrend,
    opsQueues,
    openPos,
    acceptanceRate,
    shortageRate,
    inventorySnapshot,
    channelMix,
  ] = await Promise.all([
    sumWindow(salesQtySql(companyId, companyName), windows),
    sumWindow(salesPosSql(companyId, companyName), windows),
    sumWindow(fillRateSql(companyId, companyName), windows),
    sumWindow(inboundQtySql(), windows),
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
  };
}
