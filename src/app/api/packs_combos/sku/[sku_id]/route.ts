import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as packsCombosService from "@/server/services/packsCombosService";

export async function GET(
  request: Request,
  context: { params: Promise<{ sku_id: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "packs_combos", "read");
    const { sku_id } = await context.params;
    const u = new URL(request.url);
    const detail = u.searchParams.get("detail") === "1" || u.searchParams.get("detail") === "true";
    if (detail) {
      const data = await packsCombosService.getPackComboDetailForParent(sku_id);
      return NextResponse.json(data);
    }
    const data = await packsCombosService.getPackComboBySku(sku_id);
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
