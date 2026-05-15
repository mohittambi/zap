import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as companySkuService from "@/server/services/companySkuService";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "secondary_listings", "manage");
    const { id } = await context.params;
    const relationId = Number(id);
    const body = await request.json().catch(() => ({}));
    const company_code_primary =
      typeof body.company_code_primary === "string"
        ? body.company_code_primary.trim()
        : "";

    const data = await companySkuService.updateCompanyAssociation(relationId, {
      company_code_primary,
      createdBy: user.email,
    });
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const user = await requireAuth(_request);
    assertPermission(user, "secondary_listings", "manage");
    const { id } = await context.params;
    const relationId = Number(id);

    const data = await companySkuService.deleteCompanyAssociation(relationId, user.email);
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
