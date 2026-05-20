import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { requireAuth } from '@/server/auth';
import { assertPermission } from '@/server/rbac';
import { handleApiError } from '@/server/errors';
import { query } from '@/server/db';

/**
 * @swagger
 * /sku-tags/export:
 *   get:
 *     summary: Export SKU tags master as XLSX
 *     description: Requires catalogues:read.
 *     tags: [SKU Tags]
 *     responses:
 *       200: { description: XLSX file }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, 'catalogues', 'read');

    const r = await query(
      `SELECT l.sku_id, l.description, l.bulk_price,
              STRING_AGG(CASE WHEN st.tag_type = 'operational' THEN st.name END, ', ' ORDER BY st.name) AS operational_tags,
              STRING_AGG(CASE WHEN st.tag_type = 'material'    THEN st.name END, ', ' ORDER BY st.name) AS material_tags
       FROM listings l
       LEFT JOIN sku_tag_assignments sta ON sta.sku_id = l.sku_id
       LEFT JOIN sku_tags st ON st.id = sta.tag_id
       GROUP BY l.sku_id, l.description, l.bulk_price
       ORDER BY l.sku_id`,
      []
    );

    const rows = r.rows.map((row) => ({
      sku_id: row.sku_id,
      description: row.description ?? '',
      bulk_price: row.bulk_price != null ? Number(row.bulk_price) : '',
      operational_tags: row.operational_tags ?? '',
      material_tags: row.material_tags ?? '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows, {
      header: ['sku_id', 'description', 'bulk_price', 'operational_tags', 'material_tags'],
    });
    ws['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 12 }, { wch: 30 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SKU Tags');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="sku-tags-master.xlsx"',
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
