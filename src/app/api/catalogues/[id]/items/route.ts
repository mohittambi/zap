import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as cataloguesService from "@/server/services/cataloguesService";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(_request);
    assertPermission(user, "catalogues", "read");
    const { id } = await context.params;
    const data = await cataloguesService.listCatalogueItems(Number(id));
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
    assertPermission(user, "catalogues", "write");
    const { id } = await context.params;
    const body = await request.json();
    await cataloguesService.addCatalogueItem(Number(id), {
      sku_id: body.sku_id,
      moq: body.moq,
      display_price: body.display_price,
      sort_order: body.sort_order,
    });
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
    assertPermission(user, "catalogues", "write");
    const { id } = await context.params;
    const u = new URL(request.url);
    const skuId = u.searchParams.get("sku_id");
    if (!skuId) {
      return NextResponse.json({ error: "sku_id query required" }, { status: 400 });
    }
    await cataloguesService.removeCatalogueItem(Number(id), skuId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
