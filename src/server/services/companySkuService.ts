// @ts-nocheck
import { query } from "@/server/db";

export async function listCompanySkuRelations({ search_keyword, page, limit }) {
  const offset = (page - 1) * limit;
  let where = "WHERE 1=1";
  const params = [];
  if (search_keyword) {
    params.push(`%${search_keyword}%`);
    const n = params.length;
    where += ` AND (
      c.name ILIKE $${n} OR CAST(c.id AS TEXT) ILIKE $${n}
      OR c.code_primary ILIKE $${n} OR css.secondary_sku ILIKE $${n}
    )`;
  }
  const countR = await query(
    `SELECT COUNT(*)::int AS total
     FROM company_secondary_sku css
     JOIN companies c ON c.id = css.company_id
     ${where}`,
    params
  );
  const total = countR.rows[0].total;
  params.push(limit, offset);
  const listR = await query(
    `SELECT c.id AS company_id, c.name AS company_name, c.code_primary AS company_code_primary,
            css.secondary_sku, css.id AS relation_id
     FROM company_secondary_sku css
     JOIN companies c ON c.id = css.company_id
     ${where}
     ORDER BY c.id, css.secondary_sku
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
