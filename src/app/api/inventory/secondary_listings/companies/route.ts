import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as companySkuService from "@/server/services/companySkuService";

/**
 * @swagger
 * /inventory/secondary_listings/companies:
 *   post:
 *     summary: Associate company to secondary SKU
 *     description: Requires secondary_listings:manage.
 *     tags: [Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [secondary_sku, company_id]
 *             properties:
 *               secondary_sku: { type: string }
 *               company_id: { type: integer }
 *               company_code_primary: { type: string }
 *     responses:
 *       201: { description: Created }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *   patch:
 *     summary: Upsert company-SKU association by (secondary_sku, company_id)
 *     description: Requires secondary_listings:manage.
 *     tags: [Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               secondary_sku: { type: string }
 *               company_id: { type: integer }
 *               company_code_primary: { type: string }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *   delete:
 *     summary: Delete company association by (secondary_sku, company_id)
 *     description: Requires secondary_listings:manage.
 *     tags: [Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               secondary_sku: { type: string }
 *               company_id: { type: integer }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
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
