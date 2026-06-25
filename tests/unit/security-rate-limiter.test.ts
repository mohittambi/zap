import { describe, it } from "node:test";
import assert from "node:assert";
import {
  checkRateLimit,
  resetRateLimiterForTests,
} from "../../src/server/lib/rateLimiter";

describe("checkRateLimit", () => {
  it("allows up to maxAttempts then blocks", () => {
    resetRateLimiterForTests();
    const key = "test-ip";
    for (let i = 0; i < 5; i++) {
      const r = checkRateLimit(key, 5, 60_000);
      assert.strictEqual(r.allowed, true);
    }
    const blocked = checkRateLimit(key, 5, 60_000);
    assert.strictEqual(blocked.allowed, false);
    assert.ok(blocked.retryAfterSec >= 1);
  });

  it("resets after window expires", () => {
    resetRateLimiterForTests();
    const key = "test-window";
    checkRateLimit(key, 1, 1);
    const blocked = checkRateLimit(key, 1, 1);
    assert.strictEqual(blocked.allowed, false);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const again = checkRateLimit(key, 1, 1);
        assert.strictEqual(again.allowed, true);
        resolve();
      }, 5);
    });
  });
});
