import { NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth';
import { assertPermission } from '@/server/rbac';
import { handleApiError } from '@/server/errors';
import * as skuTagsService from '@/server/services/skuTagsService';

/**
 * @swagger
 * /sku-tags/{id}:
 *   delete:
 *     summary: Delete a SKU tag
 *     description: Requires catalogues:write.
 *     tags: [SKU Tags]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Invalid tag id }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, 'catalogues', 'write');
    const { id } = await params;
    const tagId = Number.parseInt(id, 10);
    if (Number.isNaN(tagId)) {
      return NextResponse.json({ error: 'Invalid tag id' }, { status: 400 });
    }
    await skuTagsService.deleteTag(tagId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
