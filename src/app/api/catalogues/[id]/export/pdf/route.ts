import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as catalogueExportService from "@/server/services/catalogueExportService";

const DEFAULT_TEMPLATE = catalogueExportService.DEFAULT_CATALOGUE_TEMPLATE_ID;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "catalogues", "read");
    const { id } = await context.params;
    let templateId = DEFAULT_TEMPLATE;
    try {
      const body = await request.json();
      if (body?.template_id) templateId = String(body.template_id);
    } catch {
      /* optional body */
    }
    const pdf = await catalogueExportService.buildCataloguePdf(
      Number(id),
      templateId
    );
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="catalogue-${id}.pdf"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
