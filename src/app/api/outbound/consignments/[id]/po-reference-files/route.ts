import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { outboundPoFileDownloadConfigured } from "@/server/eautomate-outbound-po-files";
import { getOutboundConsignmentById } from "@/server/services/outboundConsignmentsService";
import {
  listOutboundPoEautomateFiles,
  listOutboundPoZapAttachments,
} from "@/server/services/outboundPurchaseOrdersService";
import { isZapStorageConfigured } from "@/server/zapStorage";

type Ctx = { params: Promise<{ id: string }> };

/** PO reference documents (original uploads) for the consignment's linked purchase order. */
export async function GET(_request: Request, context: Ctx) {
  try {
    const user = await requireAuth(_request);
    assertPermission(user, "purchase_orders", "read");
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Invalid consignment id" }, { status: 400 });
    }

    const consignment = await getOutboundConsignmentById(id);
    if (!consignment) {
      return NextResponse.json({ error: "Consignment not found" }, { status: 404 });
    }

    const poId = consignment.outbound_po_id;
    if (!poId) {
      return NextResponse.json({
        outboundPoId: null,
        zapAttachments: [],
        eautomateFiles: [],
        legacyOutboundFileFetchEnabled: outboundPoFileDownloadConfigured(),
        zapStorageConfigured: isZapStorageConfigured(),
      });
    }

    const [zapAttachments, eautomateFiles] = await Promise.all([
      listOutboundPoZapAttachments(poId),
      listOutboundPoEautomateFiles(poId),
    ]);

    const legacyRemote = outboundPoFileDownloadConfigured();
    return NextResponse.json({
      outboundPoId: poId,
      zapAttachments,
      eautomateFiles,
      legacyOutboundFileFetchEnabled: legacyRemote,
      zapStorageConfigured: isZapStorageConfigured(),
      poFileDownloadEnabled: isZapStorageConfigured() || legacyRemote,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
