import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { listCompaniesForAssociateDropdown } from "@/server/services/companySkuService";

export async function GET(_request: Request) {
  try {
    const user = await requireAuth(_request);
    assertPermission(user, "company_relations", "read");
    const content = await listCompaniesForAssociateDropdown();
    return NextResponse.json({ content });
  } catch (err) {
    return handleApiError(err);
  }
}
