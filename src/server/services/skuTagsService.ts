// @ts-nocheck
import getPool, { query } from '@/server/db';

export type Tag = {
  id: number;
  name: string;
  tag_type: 'operational' | 'material';
  created_at: unknown;
};

export async function listTags(type?: 'operational' | 'material'): Promise<Tag[]> {
  const params: unknown[] = [];
  let where = '';
  if (type) {
    params.push(type);
    where = `WHERE tag_type = $1`;
  }
  const r = await query(
    `SELECT id, name, tag_type, created_at FROM sku_tags ${where} ORDER BY tag_type, name`,
    params
  );
  return r.rows;
}

export async function createTag(name: string, tagType: 'operational' | 'material'): Promise<Tag> {
  const r = await query(
    `INSERT INTO sku_tags (name, tag_type) VALUES ($1, $2) RETURNING id, name, tag_type, created_at`,
    [name.trim(), tagType]
  );
  return r.rows[0];
}

export async function deleteTag(id: number): Promise<void> {
  await query(`DELETE FROM sku_tags WHERE id = $1`, [id]);
}

export async function getTagsForSku(skuId: string): Promise<Tag[]> {
  const r = await query(
    `SELECT st.id, st.name, st.tag_type, st.created_at
     FROM sku_tags st
     JOIN sku_tag_assignments sta ON sta.tag_id = st.id
     WHERE sta.sku_id = $1
     ORDER BY st.tag_type, st.name`,
    [skuId]
  );
  return r.rows;
}

export async function getTagsForSkus(skuIds: string[]): Promise<Map<string, Tag[]>> {
  const result = new Map<string, Tag[]>();
  if (skuIds.length === 0) return result;
  const r = await query(
    `SELECT sta.sku_id, st.id, st.name, st.tag_type, st.created_at
     FROM sku_tag_assignments sta
     JOIN sku_tags st ON st.id = sta.tag_id
     WHERE sta.sku_id = ANY($1)
     ORDER BY sta.sku_id, st.tag_type, st.name`,
    [skuIds]
  );
  for (const row of r.rows) {
    if (!result.has(row.sku_id)) result.set(row.sku_id, []);
    result.get(row.sku_id)!.push({
      id: row.id,
      name: row.name,
      tag_type: row.tag_type,
      created_at: row.created_at,
    });
  }
  return result;
}

export async function setTagsForSku(skuId: string, tagIds: number[]): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM sku_tag_assignments WHERE sku_id = $1`, [skuId]);
    if (tagIds.length > 0) {
      const values = tagIds.map((_, i) => `($1, $${i + 2})`).join(', ');
      await client.query(
        `INSERT INTO sku_tag_assignments (sku_id, tag_id) VALUES ${values}`,
        [skuId, ...tagIds]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function getTaggedSkusPage(
  params: { keyword?: string; page: number; limit: number }
): Promise<{
  total: number;
  current_page: number;
  per_page_count: number;
  curr_page_count: number;
  content: Array<{
    sku_id: string;
    description: string | null;
    bulk_price: number;
    tags: Tag[];
  }>;
}> {
  const { keyword, page, limit } = params;
  const offset = (page - 1) * limit;
  const qParams: unknown[] = [];
  let where = '';
  if (keyword) {
    qParams.push(`%${keyword}%`);
    where = `WHERE l.sku_id ILIKE $1 OR l.description ILIKE $1`;
  }

  const countR = await query(`SELECT COUNT(*)::int AS total FROM listings l ${where}`, qParams);
  const total = countR.rows[0].total;

  const limitIdx = qParams.length + 1;
  const offsetIdx = qParams.length + 2;
  const listR = await query(
    `SELECT l.sku_id, l.description, l.bulk_price
     FROM listings l ${where}
     ORDER BY l.sku_id
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    [...qParams, limit, offset]
  );

  const skuIds = listR.rows.map((r) => r.sku_id);
  const tagMap = await getTagsForSkus(skuIds);

  const content = listR.rows.map((r) => ({
    sku_id: r.sku_id,
    description: r.description ?? null,
    bulk_price: Number(r.bulk_price ?? 0),
    tags: tagMap.get(r.sku_id) ?? [],
  }));

  return { total, current_page: page, per_page_count: limit, curr_page_count: content.length, content };
}
