import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { getOpsSkuPoControlDetail } from "@/server/services/opsSkuPoControlService";

type Ctx = { params: Promise<{ masterSku: string }> };

/**
 * @swagger
 * /ops/sku-po-control/{masterSku}:
 *   get:
 *     summary: Drill-down for one master SKU (outbound + inbound PO lines)
 *     tags: [Ops]
 */
export async function GET(request: Request, ctx: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const { masterSku } = await ctx.params;
    const decoded = decodeURIComponent(masterSku).trim();
    if (!decoded) {
      return NextResponse.json({ message: "masterSku required" }, { status: 400 });
    }
    const data = await getOpsSkuPoControlDetail(decoded);
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
