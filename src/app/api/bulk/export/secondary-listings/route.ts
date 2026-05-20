import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as bulkService from "@/server/services/bulkService";

/**
 * @swagger
 * /bulk/export/secondary-listings:
 *   get:
 *     summary: Export secondary listings as CSV
 *     description: Requires bulk:read.
 *     tags: [Bulk]
 *     responses:
 *       200: { description: CSV file }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "bulk", "read");
    const csv = await bulkService.exportSecondaryListingsCsv();
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="secondary_listings.csv"',
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
