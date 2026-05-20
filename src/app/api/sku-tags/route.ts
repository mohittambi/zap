import { NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth';
import { assertPermission } from '@/server/rbac';
import { handleApiError } from '@/server/errors';
import * as skuTagsService from '@/server/services/skuTagsService';

/**
 * @swagger
 * /sku-tags:
 *   get:
 *     summary: List SKU tags
 *     description: Requires catalogues:read.
 *     tags: [SKU Tags]
 *     parameters:
 *       - { in: query, name: type, schema: { type: string, enum: [operational, material] } }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *   post:
 *     summary: Create a SKU tag
 *     description: Requires catalogues:write.
 *     tags: [SKU Tags]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, tag_type]
 *             properties:
 *               name: { type: string }
 *               tag_type: { type: string, enum: [operational, material] }
 *     responses:
 *       201: { description: Created }
 *       400: { description: Bad request }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, 'catalogues', 'read');
    const u = new URL(request.url);
    const type = u.searchParams.get('type') as 'operational' | 'material' | null;
    const tags = await skuTagsService.listTags(type ?? undefined);
    return NextResponse.json(tags);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, 'catalogues', 'write');
    const body = await request.json();
    const name = String(body.name ?? '').trim();
    const tag_type = body.tag_type as string;
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (tag_type !== 'operational' && tag_type !== 'material') {
      return NextResponse.json(
        { error: 'tag_type must be "operational" or "material"' },
        { status: 400 }
      );
    }
    const tag = await skuTagsService.createTag(name, tag_type);
    return NextResponse.json(tag, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
