import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { handleApiError } from "@/server/errors";

export async function GET(request: Request) {
  try {
    await requireAuth(request);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

    const keyPreview = key
      ? `${key.slice(0, 12)}... (len=${key.length})`
      : "(not set)";
    const urlPreview = url || "(not set)";

    // Attempt a direct HTTP call to list the storage buckets — same credential path
    // as uploadBufferToBucket but without the supabase-js wrapper.
    let directResult: unknown = null;
    if (url && key) {
      try {
        const res = await fetch(`${url}/storage/v1/bucket`, {
          headers: {
            Authorization: `Bearer ${key}`,
            apikey: key,
          },
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
