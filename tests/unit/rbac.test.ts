import { describe, it } from "node:test";
import assert from "node:assert";
import {
  assertPermission,
  hasPermission,
  type AuthUser,
} from "../../src/server/rbac";
import { AppError } from "../../src/server/errors";

const userWithListingRead: AuthUser = {
  id: 1,
  email: "a@b.com",
  roles: [],
  permissions: [{ resource: "listings", action: "read" }],
};

describe("hasPermission", () => {
  it("returns true for exact permission", () => {
    assert.strictEqual(
      hasPermission(userWithListingRead, "listings", "read"),
      true
    );
  });

  it("returns true for wildcard", () => {
    const u: AuthUser = {
      ...userWithListingRead,
      permissions: [{ resource: "*", action: "*" }],
    };
    assert.strictEqual(hasPermission(u, "any", "any"), true);
  });

  it("returns false when lacking permission", () => {
    const u: AuthUser = {
      ...userWithListingRead,
      permissions: [{ resource: "vendors", action: "read" }],
    };
    assert.strictEqual(hasPermission(u, "listings", "read"), false);
  });
});

describe("assertPermission", () => {
  it("throws AppError 401 when user is null", () => {
    assert.throws(
      () => assertPermission(null, "listings", "read"),
      (e: unknown) => e instanceof AppError && e.statusCode === 401
    );
  });

  it("throws AppError 403 when user lacks permission", () => {
    const u: AuthUser = {
      ...userWithListingRead,
      permissions: [{ resource: "vendors", action: "read" }],
    };
    assert.throws(
      () => assertPermission(u, "listings", "read"),
      (e: unknown) => e instanceof AppError && e.statusCode === 403
    );
  });

  it("does not throw when user has permission", () => {
    assert.doesNotThrow(() =>
      assertPermission(userWithListingRead, "listings", "read")
    );
  });
});
