// @ts-nocheck
import { query } from "@/server/db";

export async function listLabelsMaster({ search_keyword, page, limit }) {
  const offset = (page - 1) * limit;
  let where = "WHERE 1=1";
  const params = [];
  if (search_keyword) {
    params.push(`%${search_keyword}%`);
    const n = params.length;
    where += ` AND (
      secondary_sku ILIKE $${n} OR ean_code ILIKE $${n}
      OR color ILIKE $${n} OR material ILIKE $${n} OR one_set_contains ILIKE $${n}
    )`;
  }
  const countR = await query(
    `SELECT COUNT(*)::int AS total FROM labels_master_data ${where}`,
    params
  );
  const total = countR.rows[0].total;
  params.push(limit, offset);
  const listR = await query(
    `SELECT id, secondary_sku, ean_code, size, color, one_set_contains, material, mrp, created_at, updated_at
     FROM labels_master_data
     ${where}
     ORDER BY secondary_sku
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return {
    total,
    current_page: page,
    per_page_count: limit,
    content: listR.rows,
  };
}
