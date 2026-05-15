import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatGrnLabel,
  formatPoLabel,
  stripIdPrefix,
} from "../../src/lib/idDisplay";

/**
 * Display labels for zap-source vs eAutomate-source ids (doctrine #5).
 * Zap-source ids carry a prefix (`ZP-` / `ZG-`); eAutomate-source ids stay bare.
 */

describe("formatPoLabel", () => {
  it("returns ZP-{n} for zap-source POs", () => {
    assert.strictEqual(formatPoLabel(16719, "zap"), "ZP-16719");
    assert.strictEqual(formatPoLabel(10000000001, "zap"), "ZP-10000000001");
    assert.strictEqual(formatPoLabel("16719", "zap"), "ZP-16719");
  });

  it("returns the bare id for eAutomate-source POs", () => {
    assert.strictEqual(formatPoLabel(16719, "eautomate"), "16719");
    assert.strictEqual(formatPoLabel("16719", "eautomate"), "16719");
  });

  it("treats null/undefined source as bare (defensive default)", () => {
    assert.strictEqual(formatPoLabel(16719, null), "16719");
    assert.strictEqual(formatPoLabel(16719, undefined), "16719");
  });

  it("returns em-dash for missing po_id", () => {
    assert.strictEqual(formatPoLabel(null, "zap"), "—");
    assert.strictEqual(formatPoLabel(undefined, "eautomate"), "—");
    assert.strictEqual(formatPoLabel("", "zap"), "—");
  });
});

describe("formatGrnLabel", () => {
  it("returns ZG-{n} for zap-source GRNs (positive sequence id)", () => {
    assert.strictEqual(formatGrnLabel(10000000010, "zap"), "ZG-10000000010");
  });

  it("strips the leading minus on legacy negative-id zap drafts", () => {
    assert.strictEqual(formatGrnLabel(-101, "draft"), "ZG-101");
    assert.strictEqual(formatGrnLabel(-101, "zap"), "ZG-101");
    assert.strictEqual(formatGrnLabel("-101", "draft"), "ZG-101");
  });

  it("returns bare id for eAutomate-source GRNs", () => {
    assert.strictEqual(formatGrnLabel(3157, "eautomate"), "3157");
  });

  it("treats null/undefined source as bare (defensive default)", () => {
    assert.strictEqual(formatGrnLabel(3157, null), "3157");
    assert.strictEqual(formatGrnLabel(3157, undefined), "3157");
  });

  it("returns em-dash for missing grn_id", () => {
    assert.strictEqual(formatGrnLabel(null, "zap"), "—");
    assert.strictEqual(formatGrnLabel(undefined, "eautomate"), "—");
  });
});

describe("stripIdPrefix", () => {
  it("strips ZP-/ZG- prefix from labelled inputs", () => {
    assert.strictEqual(stripIdPrefix("ZP-16719"), "16719");
    assert.strictEqual(stripIdPrefix("ZG-100"), "100");
  });

  it("is case-insensitive", () => {
    assert.strictEqual(stripIdPrefix("zp-16719"), "16719");
    assert.strictEqual(stripIdPrefix("Zg-100"), "100");
    assert.strictEqual(stripIdPrefix("zG-100000010"), "100000010");
  });

  it("trims whitespace around the input", () => {
    assert.strictEqual(stripIdPrefix("  ZP-16719  "), "16719");
    assert.strictEqual(stripIdPrefix("\tZG-100\n"), "100");
  });

  it("returns the input unchanged when no prefix is present", () => {
    assert.strictEqual(stripIdPrefix("16719"), "16719");
    assert.strictEqual(stripIdPrefix("  16719  "), "16719");
  });

  it("returns empty string for null/undefined", () => {
    assert.strictEqual(stripIdPrefix(null), "");
    assert.strictEqual(stripIdPrefix(undefined), "");
  });

  it("does not strip prefixes inside the id (only the leading one)", () => {
    /** Defensive: a hypothetical "16719-ZP-foo" stays whole. */
    assert.strictEqual(stripIdPrefix("16719-ZP-foo"), "16719-ZP-foo");
  });
});
