import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { outboundPoFileDownloadConfigured } from "@/server/eautomate-outbound-po-files";
import * as outboundPoService from "@/server/services/outboundPurchaseOrdersService";
import { isZapStorageConfigured } from "@/server/zapStorage";

type Ctx = { params: Promise<{ id: string }> };

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

    const listings =
      po.listings_snapshot && typeof po.listings_snapshot === "object"
        ? po.listings_snapshot
        : {};

    const legacyRemote = outboundPoFileDownloadConfigured();
    const zapOk = isZapStorageConfigured();

    return NextResponse.json({
      po,
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
