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
