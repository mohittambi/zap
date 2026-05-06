import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as companySkuService from "@/server/services/companySkuService";

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "secondary_listings", "manage");
    const body = await request.json().catch(() => ({}));
    const secondary_sku =
      typeof body.secondary_sku === "string" ? body.secondary_sku.trim() : "";
    const company_id =
      typeof body.company_id === "number"
        ? body.company_id
        : Number(body.company_id);
    const company_code_primary =
      typeof body.company_code_primary === "string"
        ? body.company_code_primary.trim()
        : "";

    const data = await companySkuService.associateCompany({
      secondary_sku,
      company_id,
      company_code_primary,
      createdBy: user.email,
    });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

/** PATCH — edit company code by (secondary_sku, company_id) without needing relation_id */
export async function PATCH(request: Request): Promise<Response> {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "secondary_listings", "manage");
    const body = await request.json().catch(() => ({}));
    const secondary_sku =
      typeof body.secondary_sku === "string" ? body.secondary_sku.trim() : "";
    const company_id =
      typeof body.company_id === "number" ? body.company_id : Number(body.company_id);
    const company_code_primary =
      typeof body.company_code_primary === "string" ? body.company_code_primary.trim() : "";

    const data = await companySkuService.upsertCompanyAssociation({
      secondary_sku,
      company_id,
      company_code_primary,
      createdBy: user.email,
    });
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}

/** DELETE — remove company association by (secondary_sku, company_id) without needing relation_id */
export async function DELETE(request: Request): Promise<Response> {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "secondary_listings", "manage");
    const body = await request.json().catch(() => ({}));
    const secondary_sku =
      typeof body.secondary_sku === "string" ? body.secondary_sku.trim() : "";
    const company_id =
      typeof body.company_id === "number" ? body.company_id : Number(body.company_id);

    const data = await companySkuService.deleteCompanyBySkuAndCompany({
      secondary_sku,
      company_id,
      createdBy: user.email,
    });
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
