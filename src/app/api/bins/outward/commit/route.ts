import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import { commitAllocation, type CommitItem } from "@/server/services/bulkOutwardService";

// POST /api/bins/outward/commit
// Body: { items: [{ sku_id, bin_allocations: [{ bin_id, qty }] }] }
// Executes all deductions in a single transaction.
// Responds with per-SKU per-bin results (deducted qty, new bin qty).
/**
 * @swagger
 * /bins/outward/commit:
 *   post:
 *     summary: Commit bulk outward bin deductions
 *     description: Executes all deductions atomically. Requires bins:write.
 *     tags: [Bins]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [sku_id, bin_allocations]
 *                   properties:
 *                     sku_id: { type: string }
 *                     bin_allocations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         required: [bin_id, qty]
 *                         properties:
 *                           bin_id: { type: string }
 *                           qty: { type: integer, minimum: 0 }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Bad request }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "bins", "write");

    const body = (await request.json()) as Record<string, unknown>;
    const rawItems = body.items;

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      throw new AppError("items must be a non-empty array", 400);
    }
    if (rawItems.length > 200) {
      throw new AppError("items must not exceed 200 entries", 400);
    }

    const items: CommitItem[] = rawItems.map((raw, i) => {
      if (typeof raw !== "object" || raw === null) {
        throw new AppError(`items[${i}]: must be an object`, 400);
      }
      const r = raw as Record<string, unknown>;
      if (typeof r.sku_id !== "string" || !r.sku_id.trim()) {
        throw new AppError(`items[${i}].sku_id is required`, 400);
      }
      if (!Array.isArray(r.bin_allocations) || r.bin_allocations.length === 0) {
        throw new AppError(`items[${i}].bin_allocations must be a non-empty array`, 400);
      }

      const bin_allocations = (r.bin_allocations as unknown[]).map((b, j) => {
        if (typeof b !== "object" || b === null) {
          throw new AppError(`items[${i}].bin_allocations[${j}]: must be an object`, 400);
        }
        const ba = b as Record<string, unknown>;
        if (typeof ba.bin_id !== "string" || !ba.bin_id.trim()) {
          throw new AppError(`items[${i}].bin_allocations[${j}].bin_id is required`, 400);
        }
        const qty = Number(ba.qty);
        if (!Number.isInteger(qty) || qty < 0) {
          throw new AppError(`items[${i}].bin_allocations[${j}].qty must be a non-negative integer`, 400);
        }
        return { bin_id: ba.bin_id.trim(), qty };
      });

      return { sku_id: r.sku_id.trim(), bin_allocations };
    });

    const results = await commitAllocation(items, String(user.id));
    return NextResponse.json({ results });
  } catch (err) {
    return handleApiError(err);
  }
}
