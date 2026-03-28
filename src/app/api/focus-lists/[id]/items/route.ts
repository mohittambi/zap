import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as focusListsService from "@/server/services/focusListsService";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(_request);
    assertPermission(user, "focus_lists", "read");
    const { id } = await context.params;
    const data = await focusListsService.listFocusListItems(Number(id));
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "focus_lists", "write");
    const { id } = await context.params;
    const body = await request.json();
    const skuId = String(body.sku_id ?? "").trim();
    if (!skuId) {
      return NextResponse.json({ error: "sku_id required" }, { status: 400 });
    }
    await focusListsService.addFocusListItem(Number(id), skuId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "focus_lists", "write");
    const { id } = await context.params;
    const u = new URL(request.url);
    const skuId = u.searchParams.get("sku_id");
    if (!skuId) {
      return NextResponse.json({ error: "sku_id query required" }, { status: 400 });
    }
    await focusListsService.removeFocusListItem(Number(id), skuId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
