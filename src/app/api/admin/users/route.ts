import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import { query } from "@/server/db";

export type AdminUserRow = {
  id: number;
  email: string;
  is_active: boolean;
  created_at: string;
  roles: string[];
};

/** List all users with roles — admin only. */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "*", "*");

    const res = await query(
      `SELECT u.id, u.email,
        COALESCE(u.is_active, true) AS is_active,
        u.created_at,
        COALESCE(
          array_agg(r.name ORDER BY r.name) FILTER (WHERE r.name IS NOT NULL),
          ARRAY[]::text[]
        ) AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       GROUP BY u.id, u.email, u.is_active, u.created_at
       ORDER BY u.email ASC`
    );
    const rows: AdminUserRow[] = res.rows.map((row) => ({
      id: row.id as number,
      email: row.email as string,
      is_active: Boolean(row.is_active),
      created_at:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
      roles: (row.roles as string[]) ?? [],
    }));
    return NextResponse.json(rows);
  } catch (err) {
    return handleApiError(err);
  }
}

type CreateBody = {
  email?: string;
  password?: string;
  roles?: string[];
};

/** Create user and assign roles — admin only. */
export async function POST(request: Request) {
  try {
    const admin = await requireAuth(request);
    assertPermission(admin, "*", "*");

    const body = (await request.json().catch(() => ({}))) as CreateBody;
    const rawEmail = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const roleNames = Array.isArray(body.roles) ? body.roles : [];

    if (!rawEmail) {
      throw new AppError("Email is required", 400);
    }
    const email = rawEmail.toLowerCase();
    if (password.length < 8) {
      throw new AppError("Password must be at least 8 characters", 400);
    }

    if (roleNames.length === 0) {
      throw new AppError("At least one role is required", 400);
    }

    const uniqueNames = [...new Set(roleNames.filter((n) => typeof n === "string" && n.trim()))];
    const roleRes = await query(
      `SELECT id, name FROM roles WHERE name = ANY($1::text[])`,
      [uniqueNames]
    );
    if (roleRes.rows.length !== uniqueNames.length) {
      const found = new Set(roleRes.rows.map((r: { name: string }) => r.name));
      const missing = uniqueNames.filter((n) => !found.has(n));
      throw new AppError(`Unknown role(s): ${missing.join(", ")}`, 400);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const insertUser = await query(
      `INSERT INTO users (email, password_hash, is_active, created_at, updated_at)
       VALUES ($1, $2, true, NOW(), NOW())
       RETURNING id`,
      [email, passwordHash]
    );

    const newId = insertUser.rows[0]?.id as number;
    if (!newId) throw new AppError("Failed to create user", 500);

    for (const row of roleRes.rows as { id: number }[]) {
      await query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [newId, row.id]
      );
    }

    return NextResponse.json(
      {
        id: newId,
        email,
        message: "User created.",
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const pgCode =
      typeof err === "object" && err !== null && "code" in err
        ? String((err as { code?: unknown }).code)
        : "";
    if (pgCode === "23505") {
      return handleApiError(new AppError("A user with this email already exists", 409));
    }
    return handleApiError(err);
  }
}
