import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as catalogueExportService from "@/server/services/catalogueExportService";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(_request);
    assertPermission(user, "catalogues", "read");
    const { id } = await context.params;
    const buf = await catalogueExportService.buildCatalogueXlsx(Number(id));
    return new NextResponse(buf, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="catalogue-${id}.xlsx"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
