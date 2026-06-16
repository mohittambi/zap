import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { exportEanMappingsCsv } from "@/server/services/eanMappingsImportService";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "*", "*");
    const u = new URL(request.url);
    const companyId =
      u.searchParams.get("company_id") != null
        ? Number(u.searchParams.get("company_id"))
        : undefined;
    const search = u.searchParams.get("search") ?? undefined;
    const csv = await exportEanMappingsCsv({
      companyId:
        companyId != null && Number.isFinite(companyId) && companyId > 0
          ? companyId
          : undefined,
      search,
    });
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="ean_mappings.csv"',
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
