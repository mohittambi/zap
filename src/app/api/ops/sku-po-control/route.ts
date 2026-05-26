import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { parsePagination } from "@/server/validators/pagination";
import { listOpsSkuPoControlPaginated } from "@/server/services/opsSkuPoControlService";

/**
 * @swagger
 * /ops/sku-po-control:
 *   get:
 *     summary: Master SKU PO control matrix (channel pending vs vendor placement)
 *     tags: [Ops]
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");

    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const { page, limit } = parsePagination(q, {
      page: 1,
      limit: 50,
      maxLimit: 200,
    });

    const minTotalPending =
      q.min_total_pending != null && q.min_total_pending !== ""
        ? Number(q.min_total_pending)
        : undefined;
    const onlyPlacePending = q.only_place_pending === "1" || q.only_place_pending === "true";
    const useCache = q.live !== "1" && q.live !== "true";

    const data = await listOpsSkuPoControlPaginated({
      page,
      limit,
      search: typeof q.search === "string" ? q.search : undefined,
      sort: typeof q.sort === "string" ? q.sort : undefined,
      sortDir: q.sort_dir === "asc" ? "asc" : "desc",
      minTotalPending:
        minTotalPending != null && Number.isFinite(minTotalPending)
          ? minTotalPending
          : undefined,
      onlyPlacePending,
      useCache,
    });

    const headers: Record<string, string> = {};
    if (!data.meta.computed_from_cache) {
      headers["X-Ops-Metrics-Stale"] = "true";
    }

    return NextResponse.json(data, { headers });
  } catch (err) {
    return handleApiError(err);
  }
}
