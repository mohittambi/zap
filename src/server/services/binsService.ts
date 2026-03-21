// @ts-nocheck
import { query } from '@/server/db';

export async function getBins(filters = {}, page, limit) {
  const { warehouse_id, sku_id } = filters;
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

  const content = listResult.rows.map((r) => ({
    id: Number(r.id),
    warehouse_id: Number(r.warehouse_id),
    sku_id: r.sku_id,
    bin_id: r.bin_id,
    available_quantity: r.available_quantity,
    is_deleted: Boolean(r.is_deleted),
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));

  return {
    total,
    page,
    limit,
    data: content,
  };
}

export async function getBinById(id) {
  const result = await query(
    `SELECT id, warehouse_id, sku_id, bin_id, available_quantity, is_deleted, created_at, updated_at
     FROM bins WHERE id = $1`,
    [id]
  );
  if (result.rows.length === 0) return null;
  const r = result.rows[0];
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
