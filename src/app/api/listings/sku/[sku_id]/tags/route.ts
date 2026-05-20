import { NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth';
import { assertPermission } from '@/server/rbac';
import { handleApiError } from '@/server/errors';
import * as skuTagsService from '@/server/services/skuTagsService';

/**
 * @swagger
 * /listings/sku/{sku_id}/tags:
 *   get:
 *     summary: List tags assigned to a SKU
 *     description: Requires catalogues:read.
 *     tags: [Listings]
 *     parameters:
 *       - in: path
 *         name: sku_id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *   post:
 *     summary: Set tags assigned to a SKU
 *     description: Requires catalogues:write.
 *     tags: [Listings]
 *     parameters:
 *       - in: path
 *         name: sku_id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tag_ids:
 *                 type: array
 *                 items: { type: integer }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ sku_id: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, 'catalogues', 'read');
    const { sku_id } = await params;
    const tags = await skuTagsService.getTagsForSku(sku_id);
    return NextResponse.json(tags);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sku_id: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, 'catalogues', 'write');
    const { sku_id } = await params;
    const body = await request.json();
    const tag_ids = Array.isArray(body.tag_ids)
      ? body.tag_ids.map(Number).filter((n: number) => !Number.isNaN(n))
      : [];
    await skuTagsService.setTagsForSku(sku_id, tag_ids);
    const tags = await skuTagsService.getTagsForSku(sku_id);
    return NextResponse.json(tags);
  } catch (err) {
    return handleApiError(err);
  }
}
