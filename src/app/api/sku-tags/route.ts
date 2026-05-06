import { NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth';
import { assertPermission } from '@/server/rbac';
import { handleApiError } from '@/server/errors';
import * as skuTagsService from '@/server/services/skuTagsService';

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
