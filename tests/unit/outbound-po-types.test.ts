import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OUTBOUND_PO_TYPES } from "../../src/lib/outbound-po-types";

describe("OUTBOUND_PO_TYPES", () => {
  it("is a non-empty readonly array", () => {
    assert.ok(Array.isArray(OUTBOUND_PO_TYPES));
    assert.ok(OUTBOUND_PO_TYPES.length > 0);
  });

  it("contains all process-note-specified festival types", () => {
    const required = [
      "Regular/BAU",
      "Diwali",
      "Rakhi",
      "Holi",
      "Valentine's Day",
      "Makar Sankranti",
      "Dussehra",
      "Ganesh Chaturthi",
      "Ugadi",
    ];
    for (const type of required) {
      assert.ok(
        (OUTBOUND_PO_TYPES as readonly string[]).includes(type),
        `Missing required PO type: "${type}"`
      );
    }
  });

  it("has no duplicate entries", () => {
    const seen = new Set<string>();
    for (const t of OUTBOUND_PO_TYPES) {
      assert.ok(!seen.has(t), `Duplicate PO type: "${t}"`);
      seen.add(t);
    }
  });

  it("has no blank or whitespace-only entries", () => {
    for (const t of OUTBOUND_PO_TYPES) {
      assert.ok(t.trim().length > 0, `Blank entry found in OUTBOUND_PO_TYPES`);
    }
  });
});

describe("Buyer GSTIN regex", () => {
  const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

  it("accepts a valid GSTIN", () => {
    assert.ok(GSTIN_RE.test("27AAPFU0939F1ZV"));
  });

  it("rejects a 14-character string", () => {
    assert.ok(!GSTIN_RE.test("27AAPFU0939F1Z"));
  });

  it("rejects lowercase letters in state code position", () => {
    assert.ok(!GSTIN_RE.test("27aapfu0939f1zv"));
  });

  it("rejects an empty string", () => {
    assert.ok(!GSTIN_RE.test(""));
  });

  it("rejects a string with spaces", () => {
    assert.ok(!GSTIN_RE.test("27AAPFU0939 F1ZV"));
  });
});
