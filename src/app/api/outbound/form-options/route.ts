import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as outboundPoService from "@/server/services/outboundPurchaseOrdersService";

/**
 * @swagger
 * /outbound/form-options:
 *   get:
 *     summary: Outbound form options (sold-via, companies)
 *     description: Requires purchase_orders:read.
 *     tags: [Outbound]
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
/** zap DB only. Companies sync is run via `npm run sync:outbound-companies`. */
export async function GET(_request: Request) {
  try {
    const user = await requireAuth(_request);
    assertPermission(user, "purchase_orders", "read");

    const [soldVia, companies] = await Promise.all([
      outboundPoService.listOutboundSoldViaOptions(),
      outboundPoService.listOutboundCompaniesForForm(),
    ]);
    return NextResponse.json({
      soldVia,
      companies,
      companySync: { ok: false, message: "Sync via npm run sync:outbound-companies" },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
