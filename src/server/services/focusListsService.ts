// @ts-nocheck
import { query } from "@/server/db";

export async function listFocusLists(filters = {}) {
  const { is_public } = filters;
  let where = "WHERE 1=1";
  const params = [];
  if (typeof is_public === "boolean") {
    params.push(is_public);
    where += ` AND is_public = $${params.length}`;
  }
  const r = await query(
    `SELECT f.id, f.title, f.description, f.is_public, f.created_by, f.created_at, f.updated_at,
            (SELECT COUNT(*)::int FROM focus_list_items i WHERE i.focus_list_id = f.id) AS item_count
     FROM focus_lists f ${where}
     ORDER BY f.created_at DESC`,
    params
  );
  return r.rows;
}

export async function getFocusList(id) {
  const r = await query(
    `SELECT f.id, f.title, f.description, f.is_public, f.created_by, f.created_at, f.updated_at,
            (SELECT COUNT(*)::int FROM focus_list_items i WHERE i.focus_list_id = f.id) AS item_count
     FROM focus_lists f WHERE f.id = $1`,
    [id]
  );
  return r.rows[0] ?? null;
}

export async function createFocusList(body) {
  const { title, description, is_public, created_by } = body;
  const r = await query(
    `INSERT INTO focus_lists (title, description, is_public, created_by)
     VALUES ($1, $2, COALESCE($3, false), $4)
     RETURNING id, title, description, is_public, created_by, created_at, updated_at`,
    [title, description ?? null, is_public, created_by ?? null]
  );
  return r.rows[0];
}

export async function updateFocusList(id, body) {
  const { title, description, is_public } = body;
  const r = await query(
    `UPDATE focus_lists SET
       title = COALESCE($2, title),
       description = COALESCE($3, description),
       is_public = COALESCE($4, is_public),
       updated_at = NOW()
     WHERE id = $1
     RETURNING id, title, description, is_public, created_by, created_at, updated_at`,
    [id, title ?? null, description ?? null, is_public ?? null]
  );
  return r.rows[0] ?? null;
}

export async function deleteFocusList(id) {
  await query(`DELETE FROM focus_lists WHERE id = $1`, [id]);
}

export async function addFocusListItem(focusListId, skuId) {
  await query(
    `INSERT INTO focus_list_items (focus_list_id, sku_id) VALUES ($1, $2)
     ON CONFLICT (focus_list_id, sku_id) DO NOTHING`,
    [focusListId, skuId]
  );
}

export async function removeFocusListItem(focusListId, skuId) {
  await query(
    `DELETE FROM focus_list_items WHERE focus_list_id = $1 AND sku_id = $2`,
    [focusListId, skuId]
  );
}

export async function listFocusListItems(focusListId) {
  const r = await query(
    `SELECT i.sku_id, i.added_at,
            l.description, l.img_hd, l.available_quantity
     FROM focus_list_items i
     JOIN listings l ON l.sku_id = i.sku_id
     WHERE i.focus_list_id = $1
     ORDER BY i.added_at DESC`,
    [focusListId]
  );
  return r.rows;
}
