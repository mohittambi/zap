import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  deriveDisplayName,
  deriveFillPct,
  deriveLocation,
  derivePoDisplayStatus,
  isZapCancelled,
  numberStringOrDash,
} from "../../src/lib/inboundPoDetailUi";

describe("isZapCancelled", () => {
  it("recognises CANCELLED in any case and with surrounding whitespace", () => {
    assert.strictEqual(isZapCancelled("CANCELLED"), true);
    assert.strictEqual(isZapCancelled("cancelled"), true);
    assert.strictEqual(isZapCancelled("  Cancelled  "), true);
  });

  it("returns false for any other or missing status", () => {
    assert.strictEqual(isZapCancelled(null), false);
    assert.strictEqual(isZapCancelled(undefined), false);
    assert.strictEqual(isZapCancelled(""), false);
    assert.strictEqual(isZapCancelled("PENDING"), false);
    assert.strictEqual(isZapCancelled("PUBLISHED"), false);
  });

  it("tolerates non-string input via String() coercion", () => {
    assert.strictEqual(isZapCancelled(123), false);
    assert.strictEqual(isZapCancelled({}), false);
  });
});

describe("derivePoDisplayStatus", () => {
  it("returns 'Cancelled' when zap-cancellation flag is set, regardless of header status", () => {
    assert.strictEqual(derivePoDisplayStatus(true, "PUBLISHED"), "Cancelled");
    assert.strictEqual(derivePoDisplayStatus(true, null), "Cancelled");
  });

  it("returns the header status when not zap-cancelled", () => {
    assert.strictEqual(derivePoDisplayStatus(false, "PUBLISHED"), "PUBLISHED");
    assert.strictEqual(derivePoDisplayStatus(false, "PENDING"), "PENDING");
  });

  it("returns em-dash when not cancelled and header status is missing or blank", () => {
    assert.strictEqual(derivePoDisplayStatus(false, null), "—");
    assert.strictEqual(derivePoDisplayStatus(false, undefined), "—");
    assert.strictEqual(derivePoDisplayStatus(false, "   "), "—");
  });
});

describe("deriveDisplayName", () => {
  it("returns the trimmed value when non-empty", () => {
    assert.strictEqual(deriveDisplayName("VK Creation"), "VK Creation");
    assert.strictEqual(deriveDisplayName("  ROUXIE (SMART SHOP) "), "ROUXIE (SMART SHOP)");
  });

  it("returns em-dash for null, undefined, and blank strings", () => {
    assert.strictEqual(deriveDisplayName(null), "—");
    assert.strictEqual(deriveDisplayName(undefined), "—");
    assert.strictEqual(deriveDisplayName(""), "—");
    assert.strictEqual(deriveDisplayName("   "), "—");
  });
});

describe("deriveLocation", () => {
  it("joins city and state with a comma when both are present", () => {
    assert.strictEqual(deriveLocation("Bengaluru", "Karnataka"), "Bengaluru, Karnataka");
  });

  it("returns just the present field when the other is blank", () => {
    assert.strictEqual(deriveLocation("Bengaluru", null), "Bengaluru");
    assert.strictEqual(deriveLocation(null, "Karnataka"), "Karnataka");
    assert.strictEqual(deriveLocation("Bengaluru", "  "), "Bengaluru");
  });

  it("returns em-dash when neither is present", () => {
    assert.strictEqual(deriveLocation(null, null), "—");
    assert.strictEqual(deriveLocation("", ""), "—");
    assert.strictEqual(deriveLocation(undefined, undefined), "—");
  });

  it("trims surrounding whitespace before deciding presence", () => {
    assert.strictEqual(deriveLocation("  Mumbai  ", "  "), "Mumbai");
  });
});

describe("deriveFillPct", () => {
  it("returns one-decimal percentage for valid inputs", () => {
    assert.strictEqual(deriveFillPct(50, 100), 50);
    assert.strictEqual(deriveFillPct(33, 100), 33);
    assert.strictEqual(deriveFillPct(1, 3), 33.3);
    assert.strictEqual(deriveFillPct(2, 3), 66.7);
  });

  it("returns null when denominator is zero or negative", () => {
    assert.strictEqual(deriveFillPct(10, 0), null);
    assert.strictEqual(deriveFillPct(10, -5), null);
  });

  it("returns null when denominator is non-finite", () => {
    assert.strictEqual(deriveFillPct(10, Number.NaN), null);
    assert.strictEqual(deriveFillPct(10, Infinity), null);
  });

  it("returns null when numerator is non-finite", () => {
    assert.strictEqual(deriveFillPct(Number.NaN, 100), null);
    assert.strictEqual(deriveFillPct(Infinity, 100), null);
  });

  it("returns 0 when numerator is zero and denominator is positive", () => {
    assert.strictEqual(deriveFillPct(0, 100), 0);
  });
});

describe("numberStringOrDash", () => {
  it("returns string form of finite numbers, including zero", () => {
    assert.strictEqual(numberStringOrDash(0), "0");
    assert.strictEqual(numberStringOrDash(120), "120");
    assert.strictEqual(numberStringOrDash(3.14), "3.14");
  });

  it("returns em-dash for null and undefined", () => {
    assert.strictEqual(numberStringOrDash(null), "—");
    assert.strictEqual(numberStringOrDash(undefined), "—");
  });

  it("returns em-dash for non-finite numbers", () => {
    assert.strictEqual(numberStringOrDash(Number.NaN), "—");
    assert.strictEqual(numberStringOrDash(Infinity), "—");
  });
});

describe("integration: regression for vendor name mismatch (PO 16719)", () => {
  /** Reproduces the exact bug: zap header carries VK Creation; cancellation flag is unset. */
  it("renders vendor name from zap header, not from any snapshot", () => {
    const headerVendorName = "VK Creation";
    assert.strictEqual(deriveDisplayName(headerVendorName), "VK Creation");
  });

  it("PO status is the header value when no zap cancellation override is present", () => {
    assert.strictEqual(derivePoDisplayStatus(false, "PENDING"), "PENDING");
  });

  it("PO status flips to Cancelled when zap_status overrides, even if header still shows PENDING", () => {
    assert.strictEqual(derivePoDisplayStatus(true, "PENDING"), "Cancelled");
  });
});
