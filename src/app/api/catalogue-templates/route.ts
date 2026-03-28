import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { CATALOGUE_TEMPLATES } from "@/server/services/catalogueExportService";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "catalogues", "read");
    return NextResponse.json(CATALOGUE_TEMPLATES);
  } catch (err) {
    return handleApiError(err);
  }
}
