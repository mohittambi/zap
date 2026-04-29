import { describe, it } from "node:test";
import assert from "node:assert";
import { skuDisplay, hasRealSku } from "../../src/lib/sku-display";

describe("skuDisplay", () => {
  it('returns "—" for null', () => {
    assert.strictEqual(skuDisplay(null), "—");
  });

  it('returns "—" for undefined', () => {
    assert.strictEqual(skuDisplay(undefined), "—");
  });

  it('returns "—" for empty string', () => {
    assert.strictEqual(skuDisplay(""), "—");
  });

  it('returns "—" for whitespace-only string', () => {
    assert.strictEqual(skuDisplay("   "), "—");
  });

  it('returns "—" for the eAutomate sentinel "NA"', () => {
    assert.strictEqual(skuDisplay("NA"), "—");
  });

  it("returns real SKU identifiers unchanged", () => {
    assert.strictEqual(skuDisplay("AAT505"), "AAT505");
    assert.strictEqual(skuDisplay("D1001P6C6MSGB527"), "D1001P6C6MSGB527");
    assert.strictEqual(skuDisplay("830048"), "830048");
  });

  it("trims whitespace from real identifiers", () => {
    assert.strictEqual(skuDisplay("  AAT505  "), "AAT505");
  });
});

describe("hasRealSku", () => {
  it("returns false for null/undefined/empty/NA", () => {
    assert.strictEqual(hasRealSku(null), false);
    assert.strictEqual(hasRealSku(undefined), false);
    assert.strictEqual(hasRealSku(""), false);
    assert.strictEqual(hasRealSku("NA"), false);
    assert.strictEqual(hasRealSku("  "), false);
  });

  it("returns true for real SKU strings", () => {
    assert.strictEqual(hasRealSku("AAT505"), true);
    assert.strictEqual(hasRealSku("D1001P6C6MSGB527"), true);
    assert.strictEqual(hasRealSku("AKDIYA102_SO2"), true);
  });
});
