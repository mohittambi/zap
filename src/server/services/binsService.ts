// @ts-nocheck
import getPool, { query } from '@/server/db';
import { AppError } from '@/server/errors';
import { recordMovement, type MovementType } from '@/server/services/reorderService';

type BinRow = {
  id: number;
  warehouse_id: number;
  sku_id: string;
  bin_id: string;
  available_quantity: number;
  is_deleted: boolean;
  created_at: unknown;
  updated_at: unknown;
};

type AdjustBinInventoryParams = {
  bin_id: string;
  sku_id: string;
  operation: 'ADD' | 'REMOVE';
  quantity: number;
  user_id: string;
  movement_type?: MovementType;
  /** When provided and the bin row doesn't exist, it will be auto-created with qty=0. */
  warehouse_id?: number;
};

type AdjustBinInventoryResult = {
  bin: BinRow;
  new_quantity: number;
};

function mapBinRow(r): BinRow {
  return {
    id: Number(r.id),
    warehouse_id: Number(r.warehouse_id),
    sku_id: r.sku_id,
    bin_id: r.bin_id,
    available_quantity: r.available_quantity,
    is_deleted: Boolean(r.is_deleted),
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export async function getBins(filters = {}, page, limit) {
  const { warehouse_id, sku_id, bin_id } = filters;
  const offset = (page - 1) * limit;

  const conditions = ['is_deleted = false'];
  const params = [];
  let paramIndex = 1;
  if (warehouse_id != null && warehouse_id !== '') {
    params.push(Number(warehouse_id));
    conditions.push(`warehouse_id = $${paramIndex++}`);
  }
  if (sku_id != null && sku_id !== '') {
    params.push(String(sku_id).trim());
    conditions.push(`sku_id = $${paramIndex++}`);
  }
  if (bin_id != null && bin_id !== '') {
    params.push(String(bin_id).trim());
    conditions.push(`bin_id = $${paramIndex++}`);
  }
  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM bins ${whereClause}`,
    params
  );
  const total = countResult.rows[0].total;

  const limitParam = paramIndex;
  const offsetParam = paramIndex + 1;
  const listParams = [...params, limit, offset];

  const listResult = await query(
    `SELECT id, warehouse_id, sku_id, bin_id, available_quantity, is_deleted, created_at, updated_at
     FROM bins ${whereClause}
     ORDER BY id LIMIT $${limitParam} OFFSET $${offsetParam}`,
    listParams
  );

  return {
    total,
    page,
    limit,
    data: listResult.rows.map(mapBinRow),
  };
}

export async function updateBinQuantity(id: number, skuId: string, availableQuantity: number) {
  const result = await query(
    `UPDATE bins SET available_quantity = $1
     WHERE id = $2 AND sku_id = $3 AND is_deleted = false
     RETURNING id, warehouse_id, sku_id, bin_id, available_quantity, is_deleted, created_at, updated_at`,
    [availableQuantity, id, skuId]
  );
  if (result.rows.length === 0) return null;
  return mapBinRow(result.rows[0]);
}

export async function getBinById(id) {
  const result = await query(
    `SELECT id, warehouse_id, sku_id, bin_id, available_quantity, is_deleted, created_at, updated_at
     FROM bins WHERE id = $1`,
    [id]
  );
  if (result.rows.length === 0) return null;
  return mapBinRow(result.rows[0]);
}

export async function getBinByBinIdAndSku(binId: string, skuId: string): Promise<BinRow | null> {
  const result = await query(
    `SELECT id, warehouse_id, sku_id, bin_id, available_quantity, is_deleted, created_at, updated_at
     FROM bins WHERE bin_id = $1 AND sku_id = $2 AND is_deleted = false LIMIT 1`,
    [binId.trim(), skuId.trim()]
  );
  if (result.rows.length === 0) return null;
  return mapBinRow(result.rows[0]);
}

export type BinBreakdown = { id: number; bin_id: string; available_quantity: number };
export type SkuSummary = {
  sku_id: string;
  warehouse_id: number;
  description: string | null;
  total_quantity: number;
  bins: BinBreakdown[];
};

export async function getSkuInventorySummary(
  filters: { warehouse_id?: string | number; keyword?: string },
  page: number,
  limit: number
): Promise<{ total: number; page: number; limit: number; data: SkuSummary[] }> {
  const conditions = ['b.is_deleted = false'];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters.warehouse_id != null && filters.warehouse_id !== '') {
    params.push(Number(filters.warehouse_id));
    conditions.push(`b.warehouse_id = $${paramIndex++}`);
  }
  if (filters.keyword?.trim()) {
    params.push(`%${filters.keyword.trim()}%`);
    const kIdx = paramIndex++;
    conditions.push(`(b.sku_id ILIKE $${kIdx} OR l.description ILIKE $${kIdx})`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countResult = await query(
    `SELECT COUNT(DISTINCT b.sku_id)::int AS total
     FROM bins b LEFT JOIN listings l ON l.sku_id = b.sku_id
     ${whereClause}`,
    params
  );
  const total = countResult.rows[0].total;

  const offset = (page - 1) * limit;
  const listResult = await query(
    `SELECT b.sku_id, b.warehouse_id, l.description,
            SUM(b.available_quantity)::int AS total_quantity,
            json_agg(
              json_build_object('id', b.id::bigint, 'bin_id', b.bin_id, 'available_quantity', b.available_quantity::int)
              ORDER BY b.bin_id
            ) AS bins
     FROM bins b LEFT JOIN listings l ON l.sku_id = b.sku_id
     ${whereClause}
     GROUP BY b.sku_id, b.warehouse_id, l.description
     ORDER BY b.sku_id
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  return {
    total,
    page,
    limit,
    data: listResult.rows.map(r => ({
      sku_id: r.sku_id,
      warehouse_id: Number(r.warehouse_id),
      description: r.description ?? null,
      total_quantity: Number(r.total_quantity),
      bins: r.bins as BinBreakdown[],
    })),
  };
}

/**
 * Adjust one bin row using an existing transaction (caller runs BEGIN/COMMIT).
 * Used by GRN receive-inventory to book multiple bins atomically.
 */
export async function adjustBinInventoryInTransaction(
  client,
  params: AdjustBinInventoryParams
): Promise<AdjustBinInventoryResult> {
  // Auto-create the bin row if warehouse_id is provided and the row doesn't exist yet.
  // This lets GRN receipt book into a bin that hasn't been pre-created via sync.
  if (params.warehouse_id != null) {
    await client.query(
      `INSERT INTO bins (warehouse_id, sku_id, bin_id, available_quantity)
       VALUES ($1, $2, $3, 0)
       ON CONFLICT (warehouse_id, sku_id, bin_id) DO NOTHING`,
      [params.warehouse_id, params.sku_id.trim(), params.bin_id.trim()]
    );
  }

  const lockResult = await client.query(
    `SELECT id, warehouse_id, sku_id, bin_id, available_quantity
     FROM bins WHERE bin_id = $1 AND sku_id = $2 AND is_deleted = false
     FOR UPDATE`,
    [params.bin_id.trim(), params.sku_id.trim()]
  );

  if (lockResult.rows.length === 0) {
    throw new AppError('Bin not found for the given bin_id and sku_id', 404);
  }

  const row = lockResult.rows[0];
  const current: number = Number(row.available_quantity);
  const new_quantity =
    params.operation === 'ADD'
      ? current + params.quantity
      : current - params.quantity;

  if (new_quantity < 0) {
    throw new AppError(
      `REMOVE would result in negative quantity (current: ${current}, requested: ${params.quantity})`,
      400
    );
  }

  const updateResult = await client.query(
    `UPDATE bins SET available_quantity = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, warehouse_id, sku_id, bin_id, available_quantity, is_deleted, created_at, updated_at`,
    [new_quantity, row.id]
  );

  const movementType: MovementType = params.movement_type ??
    (params.operation === 'ADD' ? 'ADJUSTMENT_IN' : 'SALE');
  await recordMovement({
    client,
    warehouse_id: Number(row.warehouse_id),
    sku_id: params.sku_id.trim(),
    bin_id: params.bin_id.trim(),
    quantity: params.quantity,
    movement_type: movementType,
    user_id: params.user_id,
  });

  return {
    bin: mapBinRow(updateResult.rows[0]),
    new_quantity,
  };
}

export async function adjustBinInventory(
  params: AdjustBinInventoryParams
): Promise<AdjustBinInventoryResult> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await adjustBinInventoryInTransaction(client, params);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ── Bin locations (all distinct warehouse+bin combos for a given SKU context) ──

export type BinLocation = {
  warehouse_id: number;
  bin_id: string;
  /** Total units across ALL SKUs in this bin. */
  bin_total_qty: number;
  /** Units of the requested SKU already in this bin (0 if not yet assigned). */
  sku_qty: number;
  /** True if this SKU already has a row for this bin (even with qty 0). */
  already_assigned: boolean;
};

export async function getBinLocations(skuId: string): Promise<BinLocation[]> {
  const result = await query(
    `SELECT
       b.warehouse_id,
       b.bin_id,
       SUM(b.available_quantity)::int                                        AS bin_total_qty,
       COALESCE(MAX(CASE WHEN b.sku_id = $1 THEN b.available_quantity END), 0)::int
                                                                             AS sku_qty,
       BOOL_OR(b.sku_id = $1)                                               AS already_assigned
     FROM bins b
     WHERE b.is_deleted = false
     GROUP BY b.warehouse_id, b.bin_id
     ORDER BY b.warehouse_id, b.bin_id`,
    [skuId.trim()]
  );
  return result.rows.map((r) => ({
    warehouse_id: Number(r.warehouse_id),
    bin_id: String(r.bin_id),
    bin_total_qty: Number(r.bin_total_qty ?? 0),
    sku_qty: Number(r.sku_qty ?? 0),
    already_assigned: Boolean(r.already_assigned),
  }));
}

// ── Admin bin management ──────────────────────────────────────────────────────

export async function createBin(
  warehouseId: number,
  skuId: string,
  binId: string
): Promise<BinRow> {
  const skuCheck = await query(
    `SELECT 1 FROM listings WHERE sku_id = $1 LIMIT 1`,
    [skuId.trim()]
  );
  if (skuCheck.rows.length === 0) {
    throw new AppError(`SKU '${skuId}' not found in listings`, 400);
  }

  const result = await query(
    `INSERT INTO bins (warehouse_id, sku_id, bin_id, available_quantity)
     VALUES ($1, $2, $3, 0)
     ON CONFLICT (warehouse_id, sku_id, bin_id) DO NOTHING
     RETURNING id, warehouse_id, sku_id, bin_id, available_quantity, is_deleted, created_at, updated_at`,
    [warehouseId, skuId.trim(), binId.trim()]
  );

  if (result.rows.length === 0) {
    throw new AppError('Bin already exists for this warehouse/SKU/bin combination', 409);
  }
  return mapBinRow(result.rows[0]);
}

export async function deleteBin(id: number): Promise<void> {
  const result = await query(
    `UPDATE bins SET is_deleted = true, updated_at = NOW()
     WHERE id = $1 AND available_quantity = 0 AND is_deleted = false
     RETURNING id`,
    [id]
  );

  if (result.rows.length === 0) {
    // Determine whether it's a not-found or has-stock error
    const check = await query(
      `SELECT id, available_quantity, is_deleted FROM bins WHERE id = $1`,
      [id]
    );
    if (check.rows.length === 0 || check.rows[0].is_deleted) {
      throw new AppError('Bin not found', 404);
    }
    throw new AppError('Cannot delete a bin with remaining stock', 409);
  }
}

// ── Bin changes log ───────────────────────────────────────────────────────────

export type BinChangeRow = {
  id: number;
  created_at: string;
  warehouse_id: number;
  sku_id: string;
  description: string | null;
  bin_id: string | null;
  inventory_operation_type: string;
  movement_type: string | null;
  quantity: number;
  user_id: string | null;
};

export type BinChangesFilters = {
  sku_id?: string;
  bin_id?: string;
  movement_type?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
};

export async function getBinChanges(
  filters: BinChangesFilters
): Promise<{ total: number; page: number; limit: number; data: BinChangeRow[] }> {
  const { page, limit } = filters;
  const offset = (page - 1) * limit;
  const params: unknown[] = [];
  const where: string[] = [];

  if (filters.sku_id) {
    params.push(`%${filters.sku_id}%`);
    where.push(`w.sku_id ILIKE $${params.length}`);
  }
  if (filters.bin_id) {
    params.push(`%${filters.bin_id}%`);
    where.push(`w.bin_id ILIKE $${params.length}`);
  }
  if (filters.movement_type && filters.movement_type !== 'ALL') {
    params.push(filters.movement_type);
    where.push(`w.movement_type = $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    where.push(`w.created_at >= $${params.length}`);
  }
  if (filters.to) {
    params.push(filters.to);
    where.push(`w.created_at <= $${params.length}`);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const countRes = await query(
    `SELECT COUNT(*)::int AS total
       FROM warehouse_inventory_dump w
       ${whereClause}`,
    params
  );
  const total = Number(countRes.rows[0]?.total ?? 0);

  params.push(limit, offset);
  const dataRes = await query(
    `SELECT w.id, w.created_at, w.warehouse_id, w.sku_id,
            l.description,
            w.bin_id, w.inventory_operation_type, w.movement_type,
            w.quantity, w.user_id
       FROM warehouse_inventory_dump w
       LEFT JOIN listings l ON l.sku_id = w.sku_id
       ${whereClause}
       ORDER BY w.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    total,
    page,
    limit,
    data: dataRes.rows.map((r) => ({
      id: Number(r.id),
      created_at: String(r.created_at ?? ''),
      warehouse_id: Number(r.warehouse_id),
      sku_id: String(r.sku_id ?? ''),
      description: r.description ?? null,
      bin_id: r.bin_id ?? null,
      inventory_operation_type: String(r.inventory_operation_type ?? ''),
      movement_type: r.movement_type ?? null,
      quantity: Number(r.quantity ?? 0),
      user_id: r.user_id ?? null,
    })),
  };
}
