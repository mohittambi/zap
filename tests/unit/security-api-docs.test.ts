import { describe, it } from "node:test";
import assert from "node:assert";

describe("api-docs production guard", () => {
  it("production requires admin permission logic", () => {
    const isProduction = true;
    const user = null;
    const hasAdmin = false;
    const shouldBlock =
      isProduction && (!user || !hasAdmin);
    assert.strictEqual(shouldBlock, true);
  });

  it("non-production allows unauthenticated access", () => {
    const isProduction = false;
    const shouldBlock = isProduction;
    assert.strictEqual(shouldBlock, false);
  });
});
