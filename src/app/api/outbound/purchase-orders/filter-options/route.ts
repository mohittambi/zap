import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as outboundPoService from "@/server/services/outboundPurchaseOrdersService";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const [companies, deliveryLocations] = await Promise.all([
      outboundPoService.listOutboundCompaniesForForm(),
      outboundPoService.listOutboundDeliveryLocationsForForm(),
    ]);
    return NextResponse.json({ companies, deliveryLocations });
  } catch (err) {
    return handleApiError(err);
  }
}
