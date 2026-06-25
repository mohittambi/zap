import { describe, it } from "node:test";
import assert from "node:assert";
import type { AuthUser } from "../../src/server/rbac";
import { hasPermission } from "../../src/server/rbac";

function canAccessFormSubmission(
  user: AuthUser,
  subjectId: string
): boolean {
  const isAdmin = hasPermission(user, "*", "*");
  return (
    subjectId === String(user.id) ||
    subjectId === user.email ||
    isAdmin
  );
}

const viewer: AuthUser = {
  id: 42,
  email: "viewer@example.com",
  roles: ["viewer"],
  permissions: [{ resource: "forms", action: "read" }],
};

const admin: AuthUser = {
  id: 1,
  email: "admin@example.com",
  roles: ["admin"],
  permissions: [{ resource: "*", action: "*" }],
};

describe("forms IDOR ownership check", () => {
  it("allows self access by id or email", () => {
    assert.strictEqual(canAccessFormSubmission(viewer, "42"), true);
    assert.strictEqual(canAccessFormSubmission(viewer, "viewer@example.com"), true);
  });

  it("denies cross-user access for non-admin", () => {
    assert.strictEqual(canAccessFormSubmission(viewer, "99"), false);
    assert.strictEqual(canAccessFormSubmission(viewer, "other@example.com"), false);
  });

  it("allows admin to access any subject", () => {
    assert.strictEqual(canAccessFormSubmission(admin, "99"), true);
  });
});
