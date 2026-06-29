import { describe, it } from "node:test";
import assert from "node:assert";
import jwt from "jsonwebtoken";
import {
  apiKeyPrefixFromToken,
  getJwtSecret,
  isJwtIssuedBeforeInvalidation,
} from "../../src/server/auth";

describe("getJwtSecret", () => {
  it("throws when JWT_SECRET is missing", () => {
    const prev = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    try {
      assert.throws(() => getJwtSecret(), /JWT_SECRET/);
    } finally {
      if (prev !== undefined) process.env.JWT_SECRET = prev;
      else process.env.JWT_SECRET = "test-secret-for-unit-tests";
    }
  });

  it("returns trimmed secret when set", () => {
    process.env.JWT_SECRET = "  abc123  ";
    assert.strictEqual(getJwtSecret(), "abc123");
    process.env.JWT_SECRET = "test-secret-for-unit-tests";
  });
});

describe("apiKeyPrefixFromToken", () => {
  it("extracts 12-char prefix from zap_ keys", () => {
    const key = `zap_${"a".repeat(48)}`;
    assert.strictEqual(apiKeyPrefixFromToken(key), key.slice(0, 12));
  });

  it("returns null for non-zap tokens", () => {
    assert.strictEqual(apiKeyPrefixFromToken("not-a-key"), null);
    assert.strictEqual(apiKeyPrefixFromToken("zap_short"), null);
  });
});

describe("isJwtIssuedBeforeInvalidation", () => {
  it("returns false when token_invalidated_at is null", () => {
    assert.strictEqual(isJwtIssuedBeforeInvalidation(1_700_000_000, null), false);
    assert.strictEqual(
      isJwtIssuedBeforeInvalidation(1_700_000_000, undefined),
      false
    );
  });

  it("treats token issued in same second as invalidation as still valid", () => {
    const invalidatedAt = new Date("2026-06-28T12:00:00.750Z");
    const issuedAtSec = Math.floor(invalidatedAt.getTime() / 1000);
    assert.strictEqual(
      isJwtIssuedBeforeInvalidation(issuedAtSec, invalidatedAt),
      false
    );
  });

  it("invalidates token issued strictly before invalidation second", () => {
    const invalidatedAt = new Date("2026-06-28T12:00:01.000Z");
    const issuedAtSec = Math.floor(invalidatedAt.getTime() / 1000) - 1;
    assert.strictEqual(
      isJwtIssuedBeforeInvalidation(issuedAtSec, invalidatedAt),
      true
    );
  });

  it("keeps token issued after invalidation second valid", () => {
    const invalidatedAt = new Date("2026-06-28T12:00:00.999Z");
    const issuedAtSec = Math.floor(invalidatedAt.getTime() / 1000) + 1;
    assert.strictEqual(
      isJwtIssuedBeforeInvalidation(issuedAtSec, invalidatedAt),
      false
    );
  });

  it("a token reissued at/after a self password change is not invalidated", () => {
    // Simulates the admin self password-change flow: invalidation is stamped,
    // then a fresh token is signed. The reissued token must remain valid.
    process.env.JWT_SECRET = "test-secret-for-unit-tests";
    const invalidatedAt = new Date();
    const token = jwt.sign(
      { userId: 4, email: "self@example.com" },
      getJwtSecret(),
      { expiresIn: "7d" }
    );
    const decoded = jwt.verify(token, getJwtSecret()) as { iat: number };
    assert.strictEqual(
      isJwtIssuedBeforeInvalidation(decoded.iat, invalidatedAt),
      false
    );
  });
});
