import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { handleApiError, AppError } from "@/server/errors";
import {
  getDashboardPrefs,
  setDashboardPrefs,
  DEFAULT_LAYOUT,
} from "@/server/services/homeDashboardPrefsService";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const layout = await getDashboardPrefs(user.id);
    return NextResponse.json({ layout });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireAuth(request);
    const body = (await request.json().catch(() => ({}))) as {
      layout?: unknown;
    };
    if (typeof body.layout !== "object" || body.layout == null) {
      throw new AppError("layout is required", 400);
    }
    const next = await setDashboardPrefs(
      user.id,
      body.layout as typeof DEFAULT_LAYOUT
    );
    return NextResponse.json({ layout: next });
  } catch (err) {
    return handleApiError(err);
  }
}
