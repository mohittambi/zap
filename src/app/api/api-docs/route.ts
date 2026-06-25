import { NextResponse } from "next/server";
import { resolveAuthUser } from "@/server/auth";
import { hasPermission } from "@/server/rbac";
import { getApiDocs } from "@/lib/swagger";

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    const user = await resolveAuthUser(request);
    if (!user || !hasPermission(user, "*", "*")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }
  return NextResponse.json(getApiDocs());
}
