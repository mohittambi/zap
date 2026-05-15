import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import { suggestAllocation, type OutwardItem } from "@/server/services/bulkOutwardService";

// POST /api/bins/outward/suggest
// Body: { items: [{ sku_id: string; required_qty: number }] }
// Returns: suggestion with per-bin allocation, shortfall flags
export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "bins", "read");

    const body = (await request.json()) as Record<string, unknown>;
    const rawItems = body.items;

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      throw new AppError("items must be a non-empty array", 400);
    }
    if (rawItems.length > 200) {
      throw new AppError("items must not exceed 200 entries", 400);
    }

    const items: OutwardItem[] = rawItems.map((raw, i) => {
      if (typeof raw !== "object" || raw === null) {
        throw new AppError(`items[${i}]: must be an object`, 400);
      }
      const r = raw as Record<string, unknown>;
      if (typeof r.sku_id !== "string" || !r.sku_id.trim()) {
        throw new AppError(`items[${i}].sku_id is required`, 400);
      }
      const qty = Number(r.required_qty);
      if (!Number.isInteger(qty) || qty < 1) {
        throw new AppError(`items[${i}].required_qty must be a positive integer`, 400);
      }
      return { sku_id: r.sku_id.trim(), required_qty: qty };
    });

    const result = await suggestAllocation(items);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
