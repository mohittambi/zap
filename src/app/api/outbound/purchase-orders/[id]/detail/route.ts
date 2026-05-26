import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { outboundPoFileDownloadConfigured } from "@/server/eautomate-outbound-po-files";
import { enrichListingsSnapshotWithZapEan } from "@/server/services/eanMappingsService";
import * as outboundPoService from "@/server/services/outboundPurchaseOrdersService";
import {
  enrichListingsSnapshotWithListingImages,
  mergeCommercialIntoAnalytics,
} from "@/server/services/outboundPurchaseOrdersService";
import { isZapStorageConfigured } from "@/server/zapStorage";

type Ctx = { params: Promise<{ id: string }> };

/**
 * @swagger
 * /outbound/purchase-orders/{id}/detail:
 *   get:
 *     summary: Outbound PO detail bundle
 *     description: Requires purchase_orders:read.
 *     tags: [Outbound]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Invalid PO id }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: PO not found }
 */
/** zap DB only. Sync is run via `npm run sync:outbound-po-detail` / `sync:outbound-pos:all`. */
export async function GET(_request: Request, context: Ctx) {
  try {
    const user = await requireAuth(_request);
    assertPermission(user, "purchase_orders", "read");
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Invalid PO id" }, { status: 400 });
    }

    const po = await outboundPoService.getOutboundPurchaseOrderById(id);
    if (!po) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    const [eautomateFiles, zapAttachments] = await Promise.all([
      outboundPoService.listOutboundPoEautomateFiles(id),
      outboundPoService.listOutboundPoZapAttachments(id),
    ]);

    const snapshot =
      po.listings_snapshot && typeof po.listings_snapshot === "object"
        ? po.listings_snapshot
        : {};
    const withEan = await enrichListingsSnapshotWithZapEan(snapshot, po.company_id);
    const listings = await enrichListingsSnapshotWithListingImages(withEan);

    const rawAnalytics =
      po.analytics_object &&
      typeof po.analytics_object === "object" &&
      !Array.isArray(po.analytics_object)
        ? (po.analytics_object as Record<string, unknown>)
        : {};
    const analytics_object = mergeCommercialIntoAnalytics(rawAnalytics, snapshot);

    const legacyRemote = outboundPoFileDownloadConfigured();
    const zapOk = isZapStorageConfigured();

    return NextResponse.json({
      po: { ...po, analytics_object },
      listings,
      eautomateFiles,
      zapAttachments,
      sync: { ok: false, message: "Sync via npm run sync:outbound-po-detail" },
      eautomateDownloadConfigured: outboundPoFileDownloadConfigured(),
      zapStorageConfigured: zapOk,
      /** True when at least one download path can work (Zap Storage or legacy remote template). */
      poFileDownloadEnabled: zapOk || legacyRemote,
      /** Legacy upstream file fetch (requires sync credentials + URL template). */
      legacyOutboundFileFetchEnabled: legacyRemote,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
