import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as bulkService from "@/server/services/bulkService";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "bulk", "read");
    const csv = await bulkService.exportMasterSkuCsv();
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="master_sku_details.csv"',
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
