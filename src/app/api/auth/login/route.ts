import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import { query } from "@/server/db";
import { getJwtSecret, loadUserWithRoles } from "@/server/auth";
import { handleApiError } from "@/server/errors";
import { checkRateLimit } from "@/server/lib/rateLimiter";

const JWT_EXPIRY = process.env.JWT_EXPIRY || "7d";
const LOGIN_RATE_LIMIT = 5;
const LOGIN_RATE_WINDOW_MS = 60_000;

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login with email + password
 *     description: Returns a JWT and the user's roles/permissions. Paste the JWT into Authorize → bearerAuth.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: admin@example.com }
 *               password: { type: string, example: admin123 }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     email: { type: string }
 *                     roles: { type: array, items: { type: string } }
 *                     permissions: { type: array, items: { type: string } }
 *       400: { description: Email and password required }
 *       401: { description: Invalid credentials }
 *       429: { description: Too many login attempts }
 */
export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const rate = checkRateLimit(`login:${ip}`, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW_MS);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSec) },
        }
      );
    }

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
      getJwtSecret(),
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
