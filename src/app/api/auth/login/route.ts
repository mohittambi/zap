import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import { query } from "@/server/db";
import { loadUserWithRoles } from "@/server/auth";
import { handleApiError } from "@/server/errors";

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const JWT_EXPIRY = process.env.JWT_EXPIRY || "7d";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
    };
    const { email, password } = body;
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 }
      );
    }

    const result = await query(
      `SELECT id, email, password_hash FROM users WHERE email = $1 AND COALESCE(is_active, true) = true`,
      [email.trim().toLowerCase()]
    );
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const user = result.rows[0] as {
      id: number;
      email: string;
      password_hash: string | null;
    };
    if (!user.password_hash) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY } as jwt.SignOptions
    );

    const full = await loadUserWithRoles(user.id);
    if (!full) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      token,
      user: {
        id: full.id,
        email: full.email,
        roles: full.roles,
        permissions: full.permissions,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
