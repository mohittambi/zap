import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import {
  listOpsSkuPoControlPaginated,
  opsSkuPoControlRowsToCsv,
} from "@/server/services/opsSkuPoControlService";

/**
 * @swagger
 * /ops/sku-po-control/export:
 *   get:
 *     summary: Export SKU PO control matrix as CSV
 *     tags: [Ops]
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");

    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const onlyPlacePending = q.only_place_pending === "1" || q.only_place_pending === "true";
    const minTotalPending =
      q.min_total_pending != null && q.min_total_pending !== ""
        ? Number(q.min_total_pending)
        : undefined;

    const full = await listOpsSkuPoControlPaginated({
      page: 1,
      limit: 500_000,
      search: typeof q.search === "string" ? q.search : undefined,
      sort: typeof q.sort === "string" ? q.sort : "total_pending",
      sortDir: q.sort_dir === "asc" ? "asc" : "desc",
      minTotalPending:
        minTotalPending != null && Number.isFinite(minTotalPending)
          ? minTotalPending
          : undefined,
      onlyPlacePending,
      useCache: q.live !== "1",
    });

    const csvOut = opsSkuPoControlRowsToCsv(full.content, full.companies);

    return new NextResponse(csvOut, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="sku-po-control.csv"',
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
