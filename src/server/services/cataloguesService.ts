// @ts-nocheck
import { query } from "@/server/db";

function enrichCatalogueRow(row) {
  const legacyType = row.catalogue_type === "standard" ? "STANDARD" : "ONETIME";
  return {
    ...row,
    catalogue_name: row.name,
    catalogue_description: row.description,
    catalogue_type_legacy: legacyType,
  };
}

export async function listCatalogues({ catalogue_type, search_keyword, page, limit }) {
  const offset = (page - 1) * limit;
  let where = "WHERE 1=1";
  const params = [];
  if (catalogue_type) {
    params.push(catalogue_type);
    where += ` AND c.catalogue_type = $${params.length}`;
  }
  if (search_keyword) {
    params.push(`%${search_keyword}%`);
    const n = params.length;
    where += ` AND (c.name ILIKE $${n} OR CAST(c.id AS TEXT) ILIKE $${n} OR c.description ILIKE $${n})`;
  }
  const countR = await query(
    `SELECT COUNT(*)::int AS total FROM catalogues c ${where}`,
    params
  );
  const total = countR.rows[0].total;
  params.push(limit, offset);
  const listR = await query(
    `SELECT c.id, c.catalogue_type, c.name, c.description, c.created_by, c.created_at, c.updated_at,
            (SELECT COUNT(*)::int FROM catalogue_items ci WHERE ci.catalogue_id = c.id) AS sku_count
     FROM catalogues c ${where}
     ORDER BY c.updated_at DESC NULLS LAST, c.id DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  const content = listR.rows.map(enrichCatalogueRow);
  return {
    total,
    current_page: page,
    per_page_count: limit,
    curr_page_count: content.length,
    content,
  };
}

export async function getCatalogue(id) {
  const r = await query(`SELECT * FROM catalogues WHERE id = $1`, [id]);
  return r.rows[0] ?? null;
}

export async function createCatalogue(body) {
  const { catalogue_type, name, description, created_by } = body;
  const res = await query(
    `INSERT INTO catalogues (catalogue_type, name, description, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [catalogue_type, name, description ?? null, created_by ?? null]
  );
  return res.rows[0];
}

export async function updateCatalogue(id, body) {
  const { name, description } = body;
  const res = await query(
    `UPDATE catalogues SET
       name = COALESCE($2, name),
       description = COALESCE($3, description),
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, name ?? null, description ?? null]
  );
  return res.rows[0] ?? null;
}

export async function deleteCatalogue(id) {
  await query(`DELETE FROM catalogues WHERE id = $1`, [id]);
}

export async function listCatalogueItems(catalogueId) {
  const r = await query(
    `SELECT ci.id, ci.sku_id, ci.sort_order, ci.moq, ci.display_price,
            l.description, l.img_hd, l.img_white, l.available_quantity, l.bulk_price,
            COALESCE(
              json_agg(
                json_build_object('id', st.id, 'name', st.name, 'tag_type', st.tag_type)
              ) FILTER (WHERE st.id IS NOT NULL),
              '[]'::json
            ) AS tags
     FROM catalogue_items ci
     JOIN listings l ON l.sku_id = ci.sku_id
     LEFT JOIN sku_tag_assignments sta ON sta.sku_id = ci.sku_id
     LEFT JOIN sku_tags st ON st.id = sta.tag_id
     WHERE ci.catalogue_id = $1
     GROUP BY ci.id, ci.sku_id, ci.sort_order, ci.moq, ci.display_price,
              l.description, l.img_hd, l.img_white, l.available_quantity, l.bulk_price
     ORDER BY ci.sort_order ASC, ci.id ASC`,
    [catalogueId]
  );
  return r.rows.map((row) => ({
    ...row,
    tags: row.tags ?? [],
    display_price:
      row.display_price != null
        ? Number(row.display_price)
        : Number(row.bulk_price ?? 0),
  }));
}

export async function addCatalogueItem(catalogueId, { sku_id, moq, display_price, sort_order }) {
  await query(
    `INSERT INTO catalogue_items (catalogue_id, sku_id, moq, display_price, sort_order)
     VALUES ($1, $2, $3, $4, COALESCE($5, 0))
     ON CONFLICT (catalogue_id, sku_id) DO UPDATE SET
       moq = EXCLUDED.moq,
       display_price = EXCLUDED.display_price,
       sort_order = EXCLUDED.sort_order`,
    [catalogueId, sku_id, moq ?? null, display_price ?? null, sort_order ?? 0]
  );
}

export async function removeCatalogueItem(catalogueId, skuId) {
  await query(
    `DELETE FROM catalogue_items WHERE catalogue_id = $1 AND sku_id = $2`,
    [catalogueId, skuId]
  );
}

export async function bulkImportCatalogueItemsFromBuffer(catalogueId, buffer) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  let imported = 0;
  let sort = 0;
  for (const r of rows) {
    const sku_id = String(r.sku_id ?? r.SKU ?? r.sku ?? "").trim();
    if (!sku_id) continue;
    await addCatalogueItem(catalogueId, {
      sku_id,
      moq: r.moq != null ? Number(r.moq) : null,
      display_price:
        r.display_price != null
          ? Number(r.display_price)
          : r.price != null
            ? Number(r.price)
            : null,
      sort_order: sort++,
    });
    imported++;
  }
  return { imported };
}
