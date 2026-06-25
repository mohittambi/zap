import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";

/**
 * @swagger
 * /debug/storage-check:
 *   get:
 *     summary: Debug Supabase storage credentials
 *     tags: [Debug]
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "*", "*");

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

    const keyPreview = key
      ? `${key.slice(0, 12)}... (len=${key.length})`
      : "(not set)";
    const urlPreview = url || "(not set)";

    let directResult: unknown = null;
    if (url && key) {
      try {
        const res = await fetch(`${url}/storage/v1/bucket`, {
          headers: {
            Authorization: `Bearer ${key}`,
            apikey: key,
          },
          signal: AbortSignal.timeout(30_000),
        });
        const body = await res.text();
        directResult = { status: res.status, body: body.slice(0, 500) };
      } catch (e) {
        directResult = { fetchError: e instanceof Error ? e.message : String(e) };
      }
    }

    return NextResponse.json({
      url: urlPreview,
      key: keyPreview,
      directResult,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
