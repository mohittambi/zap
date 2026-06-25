import { describe, it } from "node:test";
import assert from "node:assert";
import {
  apiKeyPrefixFromToken,
  getJwtSecret,
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
