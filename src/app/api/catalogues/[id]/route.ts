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
    const data = await cataloguesService.getCatalogue(Number(id));
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "catalogues", "write");
    const { id } = await context.params;
    const body = await request.json();
    const data = await cataloguesService.updateCatalogue(Number(id), body);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(_request);
    assertPermission(user, "catalogues", "write");
    const { id } = await context.params;
    await cataloguesService.deleteCatalogue(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
