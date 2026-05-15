import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { getPoDetailsBundle } from "@/server/services/eautomatePoDetailsIngestService";

type Ctx = {
  params: Promise<{ id: string; poId: string }>;
};

/** zap DB only. Sync from eAutomate is run via `npm run sync:po:details*`. */
export async function GET(_request: Request, context: Ctx) {
  try {
    const user = await requireAuth(_request);
    assertPermission(user, "purchase_orders", "read");
    const { id: vRaw, poId: pRaw } = await context.params;
    const vendorId = Number(vRaw);
    const poId = Number(pRaw);
    if (!Number.isFinite(vendorId) || vendorId < 1) {
      return NextResponse.json({ message: "Invalid vendor id" }, { status: 400 });
    }
    if (!Number.isFinite(poId) || poId < 1) {
      return NextResponse.json({ message: "Invalid po id" }, { status: 400 });
    }

    const bundle = await getPoDetailsBundle(vendorId, poId);
    return NextResponse.json(bundle);
  } catch (err) {
    return handleApiError(err);
  }
}
