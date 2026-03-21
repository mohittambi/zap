import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { query } from "@/server/db";
import { requireAuth } from "@/server/auth";
import { handleApiError } from "@/server/errors";

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const adminRole = user.roles?.includes("admin");
    if (!adminRole) {
      return NextResponse.json(
        { error: "Admin role required" },
        { status: 403 }
      );
    }

    const rawKey = `zap_${crypto.randomBytes(24).toString("hex")}`;
    const hash = await bcrypt.hash(rawKey, 10);

    await query(
      `UPDATE users SET api_key_hash = $1, updated_at = NOW() WHERE id = $2`,
      [hash, user.id]
    );

    return NextResponse.json({
      api_key: rawKey,
      message: "Store this key securely; it will not be shown again.",
    });
  } catch (err) {
    return handleApiError(err);
  }
}
