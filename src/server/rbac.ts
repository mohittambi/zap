import { AppError } from "./errors";

export type Permission = { resource: string; action: string };

export type AuthUser = {
  id: number;
  email: string;
  roles: string[];
  permissions: Permission[];
};

export function hasPermission(
  user: AuthUser,
  resource: string,
  action: string
): boolean {
  const perms = user.permissions || [];
  const hasWildcard = perms.some(
    (p) => p.resource === "*" && p.action === "*"
  );
  const hasExact = perms.some(
    (p) => p.resource === resource && p.action === action
  );
  return hasWildcard || hasExact;
}

export function assertPermission(
  user: AuthUser | null,
  resource: string,
  action: string
): void {
  if (!user) {
    throw new AppError("Authentication required", 401);
  }
  if (!hasPermission(user, resource, action)) {
    throw new AppError("Insufficient permissions", 403);
  }
}

/** Wildcard admin permission (*:*). */
export function assertAdmin(user: AuthUser | null): void {
  assertPermission(user, "*", "*");
}

export function isAdminUser(user: AuthUser | null): boolean {
  return user != null && hasPermission(user, "*", "*");
}

/** Parsed allowlist from SUPER_ADMIN_EMAILS (comma-separated, case-insensitive). */
function superAdminEmails(): Set<string> {
  const raw = process.env.SUPER_ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

/** Email allowlist gate for Activity Log and Insights (server-only env). */
export function isSuperAdminUser(user: AuthUser | null): boolean {
  if (!user?.email) return false;
  const allowlist = superAdminEmails();
  if (allowlist.size === 0) return false;
  return allowlist.has(user.email.trim().toLowerCase());
}

export function assertSuperAdmin(user: AuthUser | null): void {
  if (!user) {
    throw new AppError("Authentication required", 401);
  }
  if (!isSuperAdminUser(user)) {
    throw new AppError("Super admin access required", 403);
  }
}
