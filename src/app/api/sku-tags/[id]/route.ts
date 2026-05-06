import { NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth';
import { assertPermission } from '@/server/rbac';
import { handleApiError } from '@/server/errors';
import * as skuTagsService from '@/server/services/skuTagsService';

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
