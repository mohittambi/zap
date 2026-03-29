import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { query } from "@/server/db";
import { listOutboundConsignmentDeliveryLocations } from "@/server/services/outboundConsignmentsService";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");

    const [companiesR, deliveryLocations] = await Promise.all([
      query(
        `SELECT id, name FROM companies
         WHERE COALESCE(is_active, 1) = 1
         ORDER BY name NULLS LAST, id ASC`
      ),
      listOutboundConsignmentDeliveryLocations(),
    ]);

    const companies = companiesR.rows.map((row) => ({
      id: Number(row.id),
      name: row.name != null ? String(row.name) : `Company ${row.id}`,
    }));

    return NextResponse.json({
      companies,
      deliveryLocations,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
