import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as warehousesService from "@/server/services/warehousesService";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "warehouses", "read");
    const data = await warehousesService.getAllWarehouses();
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
