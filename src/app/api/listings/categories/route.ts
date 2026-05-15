import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { query } from "@/server/db";

// GET /api/listings/categories?keyword=&limit= — paginated picker source.
// Returns { categories: [{ name, count }] } sorted by count desc.
// "(uncategorised)" is a synthetic bucket folding NULL / '' / '-' rows.
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "listings", "read");
    const u = new URL(request.url);
    const keyword = (u.searchParams.get("keyword") ?? "").trim();
    const limitRaw = Number(u.searchParams.get("limit") ?? 50);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(200, Math.max(1, Math.trunc(limitRaw)))
      : 50;

    const params: unknown[] = [];
    let where = `(category IS NOT NULL AND TRIM(category) NOT IN ('', '-'))`;
    if (keyword) {
      params.push(`%${keyword}%`);
      where += ` AND category ILIKE $${params.length}`;
    }
    params.push(limit);
    const rows = await query(
      `SELECT category AS name, COUNT(*)::int AS count
       FROM   listings
       WHERE  ${where}
       GROUP  BY category
       ORDER  BY count DESC, category ASC
       LIMIT  $${params.length}`,
      params
    );

    const categories = rows.rows.map((r: { name: string; count: number }) => ({
      name: String(r.name),
      count: Number(r.count),
    }));

    // Add synthetic "(uncategorised)" bucket only when no keyword filter is set.
    if (!keyword) {
      const u2 = await query(
        `SELECT COUNT(*)::int AS count
         FROM   listings
         WHERE  category IS NULL OR TRIM(category) IN ('', '-')`
      );
      const c = Number(u2.rows[0]?.count ?? 0);
      if (c > 0) categories.push({ name: "(uncategorised)", count: c });
    }

    return NextResponse.json({ categories });
  } catch (err) {
    return handleApiError(err);
  }
}
