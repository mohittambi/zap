import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import type { AuthUser } from "@/server/rbac";

// ── Types ────────────────────────────────────────────────────────────────────

export type ParamSpec =
  | { name: string; type: "date"; label: string; required?: boolean; default?: "today" | "30d_ago" | "90d_ago" | "365d_ago" }
  | { name: string; type: "company"; label: string; required?: boolean }
  | { name: string; type: "select"; label: string; options: { value: string; label: string }[]; required?: boolean };

export type ResultShape = "table" | "bar" | "line";

export type QueryResult = { columns: string[]; rows: unknown[][] };

export type SavedQueryDef = {
  id: string;
  label: string;
  description: string;
  params: ParamSpec[];
  resultShape: ResultShape;
  run: (params: Record<string, unknown>, user: AuthUser) => Promise<QueryResult>;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function requireDate(p: Record<string, unknown>, name: string): string {
  const v = p[name];
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    throw new AppError(`Param "${name}" must be YYYY-MM-DD`, 400);
  }
  return v;
}

function optionalCompanyId(p: Record<string, unknown>, name: string): number | null {
  const v = p[name];
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new AppError(`Param "${name}" must be a number`, 400);
  return n;
}

// ── Query definitions ────────────────────────────────────────────────────────

const top_skus_by_sales: SavedQueryDef = {
  id: "top_skus_by_sales",
  label: "Top SKUs by sales (qty)",
  description: "Top 20 SKUs by units shipped in the date range.",
  params: [
    { name: "from", type: "date", label: "From", required: true, default: "365d_ago" },
    { name: "to", type: "date", label: "To", required: true, default: "today" },
    { name: "company_id", type: "company", label: "Company (optional)" },
  ],
  resultShape: "table",
  async run(p) {
    const from = requireDate(p, "from");
    const to = requireDate(p, "to");
    const companyId = optionalCompanyId(p, "company_id");
    const params: unknown[] = [from, to];
    let where = `c.marked_rtd_at >= $1::timestamptz AND c.marked_rtd_at < $2::timestamptz`;
    if (companyId != null) {
      params.push(companyId);
      where += ` AND c.company_id = $3`;
    }
    const r = await query(
      `SELECT ci.po_secondary_sku AS sku,
              SUM(ci.dispatched_quantity)::bigint AS shipped_qty,
              COUNT(DISTINCT c.id)::int AS shipments
       FROM   outbound_consignment_items ci
       JOIN   outbound_consignments c ON c.id = ci.consignment_id
       WHERE  ${where}
         AND  ci.po_secondary_sku IS NOT NULL
       GROUP  BY ci.po_secondary_sku
       ORDER  BY shipped_qty DESC
       LIMIT  20`,
      params
    );
    return {
      columns: ["sku", "shipped_qty", "shipments"],
      rows: r.rows.map((row) => [row.sku, Number(row.shipped_qty), Number(row.shipments)]),
    };
  },
};

const slow_movers: SavedQueryDef = {
  id: "slow_movers",
  label: "Slow-moving SKUs",
  description: "SKUs with stock on hand but zero outward movement in the last 30 days.",
  params: [],
  resultShape: "table",
  async run() {
    const r = await query(
      `SELECT l.sku_id,
              l.description,
              SUM(b.available_quantity)::int AS current_qty,
              COALESCE(MAX(a.outward_30d), 0)::int AS outward_30d
       FROM   listings l
       JOIN   bins b           ON b.sku_id = l.sku_id AND b.is_deleted = false
       LEFT   JOIN sku_analytics a ON a.sku_id = l.sku_id
       GROUP  BY l.sku_id, l.description
       HAVING SUM(b.available_quantity) > 0
          AND COALESCE(MAX(a.outward_30d), 0) = 0
       ORDER  BY current_qty DESC
       LIMIT  50`
    );
    return {
      columns: ["sku_id", "description", "current_qty", "outward_30d"],
      rows: r.rows.map((row) => [row.sku_id, row.description, Number(row.current_qty), Number(row.outward_30d)]),
    };
  },
};

const vendor_grn_volume: SavedQueryDef = {
  id: "vendor_grn_volume",
  label: "Top vendors by GRN accepted qty",
  description: "Top 10 vendors by accepted quantity in the date range.",
  params: [
    { name: "from", type: "date", label: "From", required: true, default: "30d_ago" },
    { name: "to", type: "date", label: "To", required: true, default: "today" },
  ],
  resultShape: "bar",
  async run(p) {
    const from = requireDate(p, "from");
    const to = requireDate(p, "to");
    const r = await query(
      `SELECT COALESCE(v.vendor_name, g.vendor_name, g.vendor_id::text) AS vendor,
              SUM(g.grn_accepted_quantity)::bigint AS accepted_qty
       FROM   inbound_grns g
       LEFT   JOIN vendors v ON v.id = g.vendor_id
       WHERE  g.created_at >= $1::timestamptz AND g.created_at < $2::timestamptz
       GROUP  BY 1
       ORDER  BY accepted_qty DESC
       LIMIT  10`,
      [from, to]
    );
    return {
      columns: ["vendor", "accepted_qty"],
      rows: r.rows.map((row) => [row.vendor, Number(row.accepted_qty)]),
    };
  },
};

const daily_outbound_trend: SavedQueryDef = {
  id: "daily_outbound_trend",
  label: "Daily outbound trend (qty)",
  description: "Daily shipped quantity in the date range.",
  params: [
    { name: "from", type: "date", label: "From", required: true, default: "30d_ago" },
    { name: "to", type: "date", label: "To", required: true, default: "today" },
    { name: "company_id", type: "company", label: "Company (optional)" },
  ],
  resultShape: "line",
  async run(p) {
    const from = requireDate(p, "from");
    const to = requireDate(p, "to");
    const companyId = optionalCompanyId(p, "company_id");
    const params: unknown[] = [from, to];
    let where = `marked_rtd_at >= $1::timestamptz AND marked_rtd_at < $2::timestamptz`;
    if (companyId != null) {
      params.push(companyId);
      where += ` AND company_id = $3`;
    }
    const r = await query(
      `SELECT date_trunc('day', marked_rtd_at)::date::text AS day,
              SUM(total_quantity)::bigint AS shipped_qty
       FROM   outbound_consignments
       WHERE  ${where}
       GROUP  BY 1
       ORDER  BY 1`,
      params
    );
    return {
      columns: ["day", "shipped_qty"],
      rows: r.rows.map((row) => [row.day, Number(row.shipped_qty)]),
    };
  },
};

const fill_rate_by_company: SavedQueryDef = {
  id: "fill_rate_by_company",
  label: "Fill-rate by company",
  description: "Weighted average fill-rate per company in the date range.",
  params: [
    { name: "from", type: "date", label: "From", required: true, default: "365d_ago" },
    { name: "to", type: "date", label: "To", required: true, default: "today" },
  ],
  resultShape: "bar",
  async run(p) {
    const from = requireDate(p, "from");
    const to = requireDate(p, "to");
    const r = await query(
      `SELECT COALESCE(c.company_name, c.company_id::text, '—') AS company,
              ROUND((SUM(ci.overall_fill_rate * COALESCE(ci.consignment_quantity, ci.dispatched_quantity))
                       / NULLIF(SUM(COALESCE(ci.consignment_quantity, ci.dispatched_quantity)), 0) * 100)::numeric, 1) AS fill_rate_pct
       FROM   outbound_consignment_items ci
       JOIN   outbound_consignments c ON c.id = ci.consignment_id
       WHERE  c.marked_rtd_at >= $1::timestamptz AND c.marked_rtd_at < $2::timestamptz
       GROUP  BY 1
       HAVING SUM(COALESCE(ci.consignment_quantity, ci.dispatched_quantity)) > 0
       ORDER  BY fill_rate_pct DESC NULLS LAST
       LIMIT  20`,
      [from, to]
    );
    return {
      columns: ["company", "fill_rate_pct"],
      rows: r.rows.map((row) => [row.company, Number(row.fill_rate_pct)]),
    };
  },
};

// ── Registry ─────────────────────────────────────────────────────────────────

export const HOME_SAVED_QUERIES: SavedQueryDef[] = [
  top_skus_by_sales,
  slow_movers,
  vendor_grn_volume,
  daily_outbound_trend,
  fill_rate_by_company,
];

export function listSavedQueries() {
  return HOME_SAVED_QUERIES.map(({ id, label, description, params, resultShape }) => ({
    id,
    label,
    description,
    params,
    resultShape,
  }));
}

export function findSavedQuery(id: string): SavedQueryDef | undefined {
  return HOME_SAVED_QUERIES.find((q) => q.id === id);
}
