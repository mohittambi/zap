import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { refreshOpsMasterSkuPoMetricsCache } from "@/server/services/opsSkuPoControlService";

/**
 * @swagger
 * /ops/sku-po-control/refresh:
 *   post:
 *     summary: Rebuild ops_master_sku_po_metrics cache from Postgres (no eAutomate calls)
 *     tags: [Ops]
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");

    const result = await refreshOpsMasterSkuPoMetricsCache();
    return NextResponse.json({
      row_count: result.row_count,
      computed_at: result.computed_at,
      meta: {
        open_outbound_po_count: result.meta.open_outbound_po_count,
        open_inbound_po_count: result.meta.open_inbound_po_count,
        pos_without_snapshot: result.meta.pos_without_snapshot,
        unmapped_inbound_line_count: result.meta.unmapped_inbound_line_count,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
