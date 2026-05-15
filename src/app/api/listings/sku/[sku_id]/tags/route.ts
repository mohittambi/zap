import { NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth';
import { assertPermission } from '@/server/rbac';
import { handleApiError } from '@/server/errors';
import * as skuTagsService from '@/server/services/skuTagsService';

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
