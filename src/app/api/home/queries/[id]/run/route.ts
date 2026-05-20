import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError, AppError } from "@/server/errors";
import { findSavedQuery } from "@/server/queries/homeSavedQueries";

/**
 * @swagger
 * /home/queries/{id}/run:
 *   post:
 *     summary: Run a saved home dashboard query
 *     description: Requires bins:read.
 *     tags: [Home]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Missing required param }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Unknown query }
 */
// POST /api/home/queries/[id]/run — run a saved query with the given params.
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "bins", "read");
    const { id } = await ctx.params;
    const def = findSavedQuery(id);
    if (!def) throw new AppError("Unknown query", 404);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const allowedKeys = new Set(def.params.map((p) => p.name));
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (allowedKeys.has(k)) cleaned[k] = v;
    }
    for (const p of def.params) {
      if (p.required && (cleaned[p.name] == null || cleaned[p.name] === "")) {
        throw new AppError(`Missing required param "${p.name}"`, 400);
      }
    }

    const result = await def.run(cleaned, user);
    return NextResponse.json({
      id: def.id,
      label: def.label,
      resultShape: def.resultShape,
      ...result,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
