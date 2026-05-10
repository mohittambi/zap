import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";

/**
 * Inbound SKU-wise (lot listings) view.
 * No zap-side mirror exists yet, so the route returns an empty page with a
 * notice. Build a sync job under `web/scripts/sync-eautomate-*` to populate a
 * local table, then have this route read from it.
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");

    return NextResponse.json({
      content: [],
      total: 0,
      current_page: 1,
      per_page_count: 0,
      curr_page_count: 0,
      message:
        "Lot-listings (SKU-wise PO view) is not yet mirrored in zap. Ask ops to add a sync job; this view will populate once data lands in Postgres.",
    });
  } catch (err) {
    return handleApiError(err);
  }
}
