// @ts-nocheck
import { query } from '@/server/db';

export async function getAllWarehouses() {
  const result = await query(
    `SELECT id, name, created_at, updated_at FROM warehouses ORDER BY id`
  );
  return result.rows.map((r) => ({
    id: Number(r.id),
    name: r.name ?? '',
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

export async function getWarehouseById(id) {
  const result = await query(
    `SELECT id, name, created_at, updated_at FROM warehouses WHERE id = $1`,
    [id]
  );
  if (result.rows.length === 0) return null;
  const r = result.rows[0];
  return {
    id: Number(r.id),
    name: r.name ?? '',
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}
