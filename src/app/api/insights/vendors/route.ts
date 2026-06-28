import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertSuperAdmin } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { getVendorReliabilityScores } from "@/server/services/insightVendorService";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertSuperAdmin(user);
    const url = new URL(request.url);
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
    const vendors = await getVendorReliabilityScores(limit);
    return NextResponse.json({ content: vendors, total: vendors.length });
  } catch (err) {
    return handleApiError(err);
  }
}
