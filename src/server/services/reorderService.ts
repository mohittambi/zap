import { query } from '@/server/db';
import getPool from '@/server/db';

export type MovementType =
  | 'SALE'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'GRN_RECEIPT';

export type ReorderMetric = {
  sku_id: string;
  description: string | null;
  current_qty: number;
  expected_qty: number;
  available_qty: number;
  sold_30d: number;
  min_reorder_qty: number;
  lead_time_days: number;
  use_advanced: boolean;
  is_below_reorder: boolean;
};

export type ReorderConfig = {
  sku_id: string;
  lead_time_days: number;
  use_advanced: boolean;
};

// ── Core CTE fragment ─────────────────────────────────────────────────────────
// Returns computed columns for every listings row joined to this fragment.
// Caller appends WHERE / ORDER BY / LIMIT.

const METRICS_CTE = `
  WITH
  sales_30d AS (
    SELECT sku_id, SUM(quantity)::int AS sold_30d
    FROM   warehouse_inventory_dump
    WHERE  inventory_operation_type = 'REMOVE'
      AND  (movement_type IS NULL OR movement_type = 'SALE')
      AND  created_at >= NOW() - INTERVAL '30 days'
    GROUP  BY sku_id
  ),
  current_stock AS (
    SELECT sku_id, SUM(available_quantity)::int AS current_qty
    FROM   bins
    WHERE  is_deleted = false
    GROUP  BY sku_id
  ),
  expected_inbound AS (
    SELECT sku_id, SUM(quantity)::int AS expected_qty
    FROM   incoming_quantity
    GROUP  BY sku_id
  ),
  metrics AS (
    SELECT
      l.sku_id,
      l.description,
      COALESCE(cs.current_qty,  0)  AS current_qty,
      COALESCE(ei.expected_qty, 0)  AS expected_qty,
      COALESCE(cs.current_qty,  0) + COALESCE(ei.expected_qty, 0) AS available_qty,
      COALESCE(s.sold_30d,      0)  AS sold_30d,
      COALESCE(rc.lead_time_days, 7)   AS lead_time_days,
      COALESCE(rc.use_advanced,  false) AS use_advanced,
      CASE
        WHEN COALESCE(rc.use_advanced, false) THEN
          GREATEST(0, ROUND(
            (COALESCE(s.sold_30d, 0)::numeric / 30.0)
            * COALESCE(rc.lead_time_days, 7)
          ))::int
        ELSE
          COALESCE(s.sold_30d, 0)
      END AS min_reorder_qty,
      (
        COALESCE(cs.current_qty, 0) + COALESCE(ei.expected_qty, 0)
      ) < CASE
        WHEN COALESCE(rc.use_advanced, false) THEN
          GREATEST(0, ROUND(
            (COALESCE(s.sold_30d, 0)::numeric / 30.0)
            * COALESCE(rc.lead_time_days, 7)
          ))::int
        ELSE
          COALESCE(s.sold_30d, 0)
      END AS is_below_reorder
    FROM   listings l
    LEFT   JOIN sales_30d      s  ON s.sku_id  = l.sku_id
    LEFT   JOIN current_stock  cs ON cs.sku_id = l.sku_id
    LEFT   JOIN expected_inbound ei ON ei.sku_id = l.sku_id
    LEFT   JOIN sku_reorder_config rc ON rc.sku_id = l.sku_id
  )
`;

function mapRow(r: Record<string, unknown>): ReorderMetric {
  return {
    sku_id:          String(r.sku_id),
    description:     r.description != null ? String(r.description) : null,
    current_qty:     Number(r.current_qty),
    expected_qty:    Number(r.expected_qty),
    available_qty:   Number(r.available_qty),
    sold_30d:        Number(r.sold_30d),
    min_reorder_qty: Number(r.min_reorder_qty),
    lead_time_days:  Number(r.lead_time_days),
    use_advanced:    Boolean(r.use_advanced),
    is_below_reorder: Boolean(r.is_below_reorder),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Paginated list of all SKU reorder metrics.
 * Pass alertsOnly=true to return only SKUs where available_qty < min_reorder_qty.
 */
export async function getReorderMetrics(opts: {
  keyword?: string;
  alertsOnly?: boolean;
  page: number;
  limit: number;
}): Promise<{ total: number; page: number; limit: number; data: ReorderMetric[] }> {
  const { keyword, alertsOnly = false, page, limit } = opts;
  const params: unknown[] = [];
  let p = 1;

  const conditions: string[] = [];
  if (alertsOnly) {
    conditions.push('m.is_below_reorder = true');
  }
  if (keyword?.trim()) {
    params.push(`%${keyword.trim()}%`);
    conditions.push(`(m.sku_id ILIKE $${p} OR m.description ILIKE $${p})`);
    p++;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(
    `${METRICS_CTE}
     SELECT COUNT(*)::int AS total FROM metrics m ${whereClause}`,
    params
  );
  const total = countResult.rows[0].total as number;

  const offset = (page - 1) * limit;
  const listResult = await query(
    `${METRICS_CTE}
     SELECT * FROM metrics m ${whereClause}
     ORDER BY m.is_below_reorder DESC, m.available_qty ASC, m.sku_id ASC
     LIMIT $${p} OFFSET $${p + 1}`,
    [...params, limit, offset]
  );

  return { total, page, limit, data: listResult.rows.map(mapRow) };
}

/**
 * Single-SKU reorder metrics.
 */
export async function getReorderMetricForSku(
  skuId: string
): Promise<ReorderMetric | null> {
  const result = await query(
    `${METRICS_CTE}
     SELECT * FROM metrics m WHERE m.sku_id = $1`,
    [skuId]
  );
  if (result.rows.length === 0) return null;
  return mapRow(result.rows[0]);
}

/**
 * Upsert lead_time_days and formula preference for a SKU.
 */
export async function upsertReorderConfig(
  skuId: string,
  config: { lead_time_days: number; use_advanced: boolean }
): Promise<ReorderConfig> {
  const result = await query(
    `INSERT INTO sku_reorder_config (sku_id, lead_time_days, use_advanced, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (sku_id) DO UPDATE
       SET lead_time_days = EXCLUDED.lead_time_days,
           use_advanced   = EXCLUDED.use_advanced,
           updated_at     = NOW()
     RETURNING sku_id, lead_time_days, use_advanced`,
    [skuId, config.lead_time_days, config.use_advanced]
  );
  const r = result.rows[0];
  return {
    sku_id:         String(r.sku_id),
    lead_time_days: Number(r.lead_time_days),
    use_advanced:   Boolean(r.use_advanced),
  };
}

/**
 * Record a movement in warehouse_inventory_dump with an explicit movement_type.
 * Called from binsService after every inventory change.
 */
export async function recordMovement(opts: {
  client: Awaited<ReturnType<ReturnType<typeof getPool>['connect']>>;
  warehouse_id: number;
  sku_id: string;
  bin_id: string;
  quantity: number;
  movement_type: MovementType;
  user_id: string;
}): Promise<void> {
  const { client, warehouse_id, sku_id, bin_id, quantity, movement_type, user_id } = opts;
  const operation = movement_type === 'SALE' || movement_type === 'TRANSFER_OUT' || movement_type === 'ADJUSTMENT_OUT'
    ? 'REMOVE'
    : 'ADD';
  await client.query(
    `INSERT INTO warehouse_inventory_dump
       (warehouse_id, sku_id, inventory_operation_type, quantity, bin_id, user_id, movement_type, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
    [warehouse_id, sku_id, operation, quantity, bin_id, user_id, movement_type]
  );
}
