import { query } from "@/server/db";

export interface MyInventoryLogRow {
  source: "secondary_listings" | "bin_change";
  id: number;
  action: string;
  sku_id: string | null;
  bin_id: string | null;
  quantity: number | null;
  movement_type: string | null;
  field_name: string | null;
  created_by: string | null;
  created_at: string;
  details: Record<string, unknown> | null;
}

export interface GetMyInventoryLogsParams {
  user_id: number;
  user_email: string;
  limit: number;
  offset: number;
  /** Free-text match against sku_id / bin_id / field_name (case-insensitive). */
  q?: string;
  /** Filter to a specific bin movement type. When set, secondary-listings rows
   *  are excluded (they have no movement_type). */
  movement_type?: string;
}

export async function getMyInventoryLogs(
  params: GetMyInventoryLogsParams
): Promise<{ total: number; logs: MyInventoryLogRow[] }> {
  const {
    user_id,
    user_email,
    limit,
    offset,
    q,
    movement_type,
  } = params;

  // $1=user_email, $2=user_id, $3=q (nullable), $4=movement_type (nullable)
  const baseParams: unknown[] = [
    user_email,
    user_id,
    q && q.trim() ? q.trim() : null,
    movement_type && movement_type.trim() ? movement_type.trim() : null,
  ];

  // Shared SQL for both COUNT and SELECT. Each UNION arm honours filters
  // independently because the two source tables don't share all columns.
  const baseSql = `
    (
      SELECT
        'secondary_listings'::text AS source,
        id,
        operation AS action,
        secondary_sku AS sku_id,
        NULL::text AS bin_id,
        NULL::numeric AS quantity,
        NULL::text AS movement_type,
        field_name,
        created_by,
        created_at,
        jsonb_build_object(
          'company_id', company_id,
          'old_value', old_value,
          'new_value', new_value
        ) AS details
      FROM secondary_listings_logs
      WHERE created_by = $1
        AND (
          $3::text IS NULL
          OR secondary_sku ILIKE '%' || $3 || '%'
          OR field_name   ILIKE '%' || $3 || '%'
        )
        AND $4::text IS NULL  -- this arm has no movement_type; drop it when filtering by movement_type
    )
    UNION ALL
    (
      SELECT
        'bin_change'::text AS source,
        id,
        inventory_operation_type AS action,
        sku_id,
        bin_id,
        quantity::numeric AS quantity,
        movement_type,
        NULL::text AS field_name,
        $1 AS created_by,
        created_at,
        jsonb_build_object('warehouse_id', warehouse_id) AS details
      FROM warehouse_inventory_dump
      WHERE user_id = $2
        AND (
          $3::text IS NULL
          OR sku_id ILIKE '%' || $3 || '%'
          OR bin_id ILIKE '%' || $3 || '%'
        )
        AND ($4::text IS NULL OR movement_type = $4)
    )
  `;

  const countRes = await query(
    `SELECT COUNT(*)::int AS total FROM (${baseSql}) AS combined`,
    baseParams
  );
  const total = Number(countRes.rows[0]?.total ?? 0);

  const dataRes = await query(
    `SELECT * FROM (${baseSql}) AS combined
     ORDER BY created_at DESC
     LIMIT $5 OFFSET $6`,
    [...baseParams, limit, offset]
  );

  const logs: MyInventoryLogRow[] = dataRes.rows.map((r) => ({
    source: r.source,
    id: Number(r.id),
    action: String(r.action ?? ""),
    sku_id: r.sku_id != null ? String(r.sku_id) : null,
    bin_id: r.bin_id != null ? String(r.bin_id) : null,
    quantity: r.quantity != null ? Number(r.quantity) : null,
    movement_type: r.movement_type ?? null,
    field_name: r.field_name ?? null,
    created_by: r.created_by ?? null,
    created_at: String(r.created_at ?? ""),
    details: r.details ?? null,
  }));

  return { total, logs };
}
