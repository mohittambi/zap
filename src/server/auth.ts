import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { query } from "./db";
import { AppError } from "./errors";
import type { AuthUser, Permission } from "./rbac";

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error("FATAL: JWT_SECRET environment variable is not set");
  }
  return secret;
}

export function apiKeyPrefixFromToken(token: string): string | null {
  if (!token.startsWith("zap_") || token.length < 12) return null;
  return token.slice(0, 12);
}

/** Seconds-level comparison: JWT iat is whole seconds; DB timestamps may have ms. */
export function isJwtIssuedBeforeInvalidation(
  issuedAtSec: number,
  invalidatedAt: Date | null | undefined
): boolean {
  if (!invalidatedAt) return false;
  return issuedAtSec < Math.floor(invalidatedAt.getTime() / 1000);
}

async function isJwtInvalidated(userId: number, issuedAtSec: number): Promise<boolean> {
  const res = await query(
    `SELECT token_invalidated_at FROM users WHERE id = $1`,
    [userId]
  );
  if (res.rows.length === 0) return true;
  const invalidatedAt = res.rows[0].token_invalidated_at as Date | null;
  return isJwtIssuedBeforeInvalidation(issuedAtSec, invalidatedAt);
}

async function resolveUserIdFromApiKey(token: string): Promise<number | null> {
  const prefix = apiKeyPrefixFromToken(token);
  if (prefix) {
    const keyResult = await query(
      `SELECT id, api_key_hash FROM users
       WHERE api_key_prefix = $1 AND api_key_hash IS NOT NULL AND COALESCE(is_active, true) = true`,
      [prefix]
    );
    for (const row of keyResult.rows as { id: number; api_key_hash: string }[]) {
      const match = await bcrypt.compare(token, row.api_key_hash);
      if (match) return row.id;
    }
    return null;
  }

  console.warn(
    "[auth] API key without prefix lookup — falling back to full-table scan; regenerate key via POST /api/auth/refresh-api-key"
  );
  const keyResult = await query(
    `SELECT id, api_key_hash FROM users
     WHERE api_key_hash IS NOT NULL AND COALESCE(is_active, true) = true
       AND (api_key_prefix IS NULL OR api_key_prefix = '')`
  );
  for (const row of keyResult.rows as { id: number; api_key_hash: string }[]) {
    const match = await bcrypt.compare(token, row.api_key_hash);
    if (match) return row.id;
  }
  return null;
}

export async function loadUserWithRoles(
  userId: number
): Promise<AuthUser | null> {
  const userResult = await query(
    `SELECT id, email, created_at FROM users WHERE id = $1 AND COALESCE(is_active, true) = true`,
    [userId]
  );
  if (userResult.rows.length === 0) return null;
  const row = userResult.rows[0] as {
    id: number;
    email: string;
    created_at: Date;
  };

  const rolesResult = await query(
    `SELECT r.name FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1`,
    [userId]
  );
  const roles = rolesResult.rows.map((r: { name: string }) => r.name);

  const permsResult = await query(
    `SELECT DISTINCT p.resource, p.action FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     JOIN user_roles ur ON ur.role_id = rp.role_id
     WHERE ur.user_id = $1`,
    [userId]
  );
  const permissions = permsResult.rows as Permission[];

  return {
    id: row.id,
    email: row.email,
    roles,
    permissions,
  };
}

/**
 * Resolve authenticated user from Authorization Bearer JWT or X-API-Key.
 * Returns null if missing/invalid (caller returns 401).
 */
export async function resolveAuthUser(
  request: Request
): Promise<AuthUser | null> {
  const authHeader = request.headers.get("authorization");
  const apiKeyHeader = request.headers.get("x-api-key");

  let token: string | null = null;
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  } else if (apiKeyHeader) {
    token = apiKeyHeader;
  }

  if (!token) return null;

  try {
    let userId: number | null = null;

    if (token.includes(".") && token.split(".").length === 3) {
      const decoded = jwt.verify(token, getJwtSecret()) as {
        userId?: number;
        sub?: string | number;
        iat?: number;
      };
      const rawId = decoded.userId ?? decoded.sub;
      userId =
        rawId == null ? null : typeof rawId === "number" ? rawId : Number(rawId);
      if (userId != null && Number.isNaN(userId)) userId = null;

      if (userId != null && decoded.iat != null) {
        const invalidated = await isJwtInvalidated(userId, decoded.iat);
        if (invalidated) return null;
      }
    } else {
      userId = await resolveUserIdFromApiKey(token);
    }

    if (userId == null) return null;

    const user = await loadUserWithRoles(userId);
    return user;
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError")
    ) {
      return null;
    }
    console.error(err);
    return null;
  }
}

export async function requireAuth(request: Request): Promise<AuthUser> {
  const user = await resolveAuthUser(request);
  if (!user) {
    throw new AppError("Missing authorization", 401);
  }
  return user;
}
