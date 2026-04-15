import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import {
  eautomateConfigured,
  fetchEautomate,
  getEautomateBaseUrl,
} from "@/server/eautomate-proxy";

/**
 * Proxies GET eautomate /public/api/purchase_orders/lot-listings/with-search-keyword
 * (Inbound SKU Wise View). Requires EAUTOMATE_COOKIE or EAUTOMATE_BEARER_TOKEN on the server.
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");

    if (!eautomateConfigured()) {
      throw new AppError(
        "eautomate is not configured: set EAUTOMATE_COOKIE (or EAUTOMATE_BEARER_TOKEN) in .env.local for the Zap server.",
        503
      );
    }

    const incoming = new URL(request.url);
    const search_keyword = incoming.searchParams.get("search_keyword") ?? "";
    const page = incoming.searchParams.get("page") ?? "1";
    const count = incoming.searchParams.get("count") ?? "100";

    const base = getEautomateBaseUrl();
    const u = new URL(
      `${base}/public/api/purchase_orders/lot-listings/with-search-keyword`
    );
    u.searchParams.set("search_keyword", search_keyword);
    u.searchParams.set("page", page);
    u.searchParams.set("count", count);

    const res = await fetchEautomate(u.toString(), {
      cache: "no-store",
    });

    const text = await res.text();
    if (!res.ok) {
      let msg = `eautomate HTTP ${res.status}`;
      try {
        const j = JSON.parse(text) as { message?: string };
        if (j?.message) msg = j.message;
      } catch {
        /* ignore */
      }
      throw new AppError(msg, res.status >= 500 ? 502 : res.status);
    }

    let data: unknown;
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      throw new AppError("Invalid JSON from eautomate", 502);
    }

    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
