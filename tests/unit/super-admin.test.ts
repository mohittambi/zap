import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
  assertSuperAdmin,
  isSuperAdminUser,
  type AuthUser,
} from "../../src/server/rbac";
import { AppError } from "../../src/server/errors";

const wildcardAdmin: AuthUser = {
  id: 2,
  email: "admin@example.com",
  roles: ["admin"],
  permissions: [{ resource: "*", action: "*" }],
};

describe("isSuperAdminUser", () => {
  const prev = process.env.SUPER_ADMIN_EMAILS;

  after(() => {
    if (prev === undefined) delete process.env.SUPER_ADMIN_EMAILS;
    else process.env.SUPER_ADMIN_EMAILS = prev;
  });

  it("returns true for allowlisted email", () => {
    process.env.SUPER_ADMIN_EMAILS = "er.mohittambi@gmail.com";
    assert.strictEqual(
      isSuperAdminUser({ ...wildcardAdmin, email: "er.mohittambi@gmail.com" }),
      true
    );
  });

  it("match is case-insensitive", () => {
    process.env.SUPER_ADMIN_EMAILS = "er.mohittambi@gmail.com";
    assert.strictEqual(
      isSuperAdminUser({ ...wildcardAdmin, email: "ER.MOHITTAMBI@GMAIL.COM" }),
      true
    );
  });

  it("supports comma-separated list", () => {
    process.env.SUPER_ADMIN_EMAILS = "a@example.com, er.mohittambi@gmail.com";
    assert.strictEqual(
      isSuperAdminUser({ ...wildcardAdmin, email: "er.mohittambi@gmail.com" }),
      true
    );
  });

  it("wildcard admin is not super admin when email not allowlisted", () => {
    process.env.SUPER_ADMIN_EMAILS = "er.mohittambi@gmail.com";
    assert.strictEqual(isSuperAdminUser(wildcardAdmin), false);
  });

  it("returns false when env is empty", () => {
    process.env.SUPER_ADMIN_EMAILS = "";
    assert.strictEqual(
      isSuperAdminUser({ ...wildcardAdmin, email: "er.mohittambi@gmail.com" }),
      false
    );
  });
});

describe("assertSuperAdmin", () => {
  const prev = process.env.SUPER_ADMIN_EMAILS;

  before(() => {
    process.env.SUPER_ADMIN_EMAILS = "er.mohittambi@gmail.com";
  });

  after(() => {
    if (prev === undefined) delete process.env.SUPER_ADMIN_EMAILS;
    else process.env.SUPER_ADMIN_EMAILS = prev;
  });

  it("throws 401 when user is null", () => {
    assert.throws(
      () => assertSuperAdmin(null),
      (e: unknown) => e instanceof AppError && e.statusCode === 401
    );
  });

  it("throws 403 for non-allowlisted admin", () => {
    assert.throws(
      () => assertSuperAdmin(wildcardAdmin),
      (e: unknown) => e instanceof AppError && e.statusCode === 403
    );
  });

  it("does not throw for allowlisted user", () => {
    assert.doesNotThrow(() =>
      assertSuperAdmin({ ...wildcardAdmin, email: "er.mohittambi@gmail.com" })
    );
  });
});
