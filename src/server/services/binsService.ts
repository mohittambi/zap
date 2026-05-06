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

export type BinBreakdown = { bin_id: string; available_quantity: number };
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
              json_build_object('bin_id', b.bin_id, 'available_quantity', b.available_quantity::int)
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

export async function adjustBinInventory(
  params: AdjustBinInventoryParams
): Promise<AdjustBinInventoryResult> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    const lockResult = await client.query(
      `SELECT id, warehouse_id, sku_id, bin_id, available_quantity
       FROM bins WHERE bin_id = $1 AND sku_id = $2 AND is_deleted = false
       FOR UPDATE`,
      [params.bin_id.trim(), params.sku_id.trim()]
    );

    if (lockResult.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new AppError('Bin not found for the given bin_id and sku_id', 404);
    }

    const row = lockResult.rows[0];
    const current: number = Number(row.available_quantity);
    const new_quantity =
      params.operation === 'ADD'
        ? current + params.quantity
        : current - params.quantity;

    if (new_quantity < 0) {
      await client.query('ROLLBACK');
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

    await client.query('COMMIT');

    return {
      bin: mapBinRow(updateResult.rows[0]),
      new_quantity,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
