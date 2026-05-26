import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { listCompaniesWithMappings } from "@/server/services/eanMappingsService";

/**
 * @swagger
 * /ean-mappings/companies:
 *   get:
 *     summary: Companies that have EAN mappings
 *     tags: [Settings]
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "*", "*");
    const content = await listCompaniesWithMappings();
    return NextResponse.json({ content });
  } catch (err) {
    return handleApiError(err);
  }
}
