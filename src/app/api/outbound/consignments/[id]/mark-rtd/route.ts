import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import { markOutboundConsignmentRtd } from "@/server/services/outboundConsignmentsService";
import {
  buildActivityContext,
  logActivity,
} from "@/server/services/activityLogService";

type Ctx = { params: Promise<{ id: string }> };

/** Mark consignment ready to dispatch with transporter and docket details. */
export async function POST(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "write");
    const { id: idStr } = await context.params;
    const consignmentId = Number(idStr);
    if (!Number.isFinite(consignmentId) || consignmentId < 1) {
      return NextResponse.json({ error: "Invalid consignment id" }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const transporterId =
      body.transporter_id != null ? Number(body.transporter_id) : null;
    const transporterName =
      typeof body.transporter_name === "string" ? body.transporter_name.trim() : null;
    const shipmentType =
      typeof body.shipment_type === "string" ? body.shipment_type.trim() : "";
    const docketNumber =
      typeof body.docket_number === "string" ? body.docket_number.trim() : "";

    if (!shipmentType) {
      throw new AppError("shipment_type is required", 400);
    }
    if (!docketNumber) {
      throw new AppError("docket_number is required", 400);
    }

    const row = await markOutboundConsignmentRtd({
      consignmentId,
      transporterId: Number.isFinite(transporterId) ? transporterId : null,
      transporterName,
      shipmentType,
      docketNumber,
      markedBy: user.email ?? "unknown",
    });

    const ctx = buildActivityContext(request, user.id);
    await logActivity({
      ...ctx,
      action: "consignment_dispatched",
      resource: "outbound_consignments",
      resourceId: String(consignmentId),
      statusCode: 200,
      details: { shipment_type: shipmentType, docket_number: docketNumber },
    });

    return NextResponse.json({ ok: true, consignment: row });
  } catch (err) {
    return handleApiError(err);
  }
}
