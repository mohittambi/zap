import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { buildGrnReportCsv } from "@/server/services/inboundPoZapActionsService";

type Ctx = { params: Promise<{ id: string; poId: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const { id, poId } = await context.params;
    const vendorId = Number(id);
    const poIdNum = Number(poId);
    if (!Number.isFinite(vendorId) || vendorId < 1 || !Number.isFinite(poIdNum) || poIdNum < 1) {
      return NextResponse.json({ message: "Invalid vendor or PO id" }, { status: 400 });
    }

    const { csv, filename } = await buildGrnReportCsv(vendorId, poIdNum);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
