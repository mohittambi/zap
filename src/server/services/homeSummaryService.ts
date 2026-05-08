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

export type TrendPoint = { day: string; v: number; v_prev_year: number };

export type HomeSummary = {
  range: { from: string; to: string };
  kpis: {
    sales_qty: Delta;
    sales_pos: Delta;
    fill_rate_pct: Delta;
    inbound_qty: Delta | null;
    skus_below_reorder: { value: number; prev_mom: null; prev_yoy: null };
  };
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

  const out: TrendPoint[] = [];
  for (let t = trendStart.getTime(); t < trendEnd.getTime(); t += DAY_MS) {
    const day = isoDay(new Date(t));
    out.push({
      day,
      v: curMap.get(day) ?? 0,
      v_prev_year: prevMap.get(day) ?? 0,
    });
  }
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

  const [salesQty, salesPos, fillRate, inboundQty, reorder, salesTrend, inboundTrend] =
    await Promise.all([
      sumWindow(salesQtySql(companyId, companyName), windows),
      sumWindow(salesPosSql(companyId, companyName), windows),
      sumWindow(fillRateSql(companyId, companyName), windows),
      // Inbound is vendor-keyed — when a company filter is active we don't
      // attribute it (would need a join via listing_order_details, deferred).
      companyId == null ? sumWindow(inboundQtySql(), windows) : Promise.resolve(null),
      getReorderMetrics({ alertsOnly: true, page: 1, limit: 8 }),
      dailyTrend("outbound_consignments", windows, companyId, companyName),
      companyId == null
        ? dailyTrend("inbound_grns", windows, null, null)
        : Promise.resolve([] as TrendPoint[]),
    ]);

  return {
    range: { from: isoDay(windows.curStart), to: isoDay(windows.curEnd) },
    kpis: {
      sales_qty: asDelta(salesQty),
      sales_pos: asDelta(salesPos),
      fill_rate_pct: asDelta(fillRate),
      inbound_qty: inboundQty == null ? null : asDelta(inboundQty),
      skus_below_reorder: { value: reorder.total, prev_mom: null, prev_yoy: null },
    },
    trends: {
      sales_qty_daily: salesTrend,
      inbound_qty_daily: inboundTrend,
    },
    reorder_top: reorder.data,
  };
}
