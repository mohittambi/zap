import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertGrnLineQuantitiesAccountable,
  grnLineQuantitySumErrorMessage,
} from "../../src/lib/grnLineQuantityValidation";

const valid = (overrides = {}) => ({
  invoice_quantity: 10,
  accepted_quantity: 8,
  rejected_quantity: 1,
  shortage_quantity: 1,
  ...overrides,
});

describe("grnLineQuantitySumErrorMessage", () => {
  it("returns null when accepted + rejected + shortage equals invoice quantity", () => {
    assert.strictEqual(grnLineQuantitySumErrorMessage(valid()), null);
  });

  it("returns null when all quantities are zero", () => {
    assert.strictEqual(
      grnLineQuantitySumErrorMessage({
        invoice_quantity: 0,
        accepted_quantity: 0,
        rejected_quantity: 0,
        shortage_quantity: 0,
      }),
      null
    );
  });

  it("returns error when sum exceeds invoice quantity", () => {
    const msg = grnLineQuantitySumErrorMessage(valid({ accepted_quantity: 10 }));
    assert.ok(msg !== null, "expected an error message");
    assert.ok(msg!.includes("Invoice"), "message should mention Invoice");
  });

  it("returns error when sum is less than invoice quantity", () => {
    const msg = grnLineQuantitySumErrorMessage(valid({ shortage_quantity: 0 }));
    assert.ok(msg !== null, "expected an error message when sum is short");
  });

  it("tolerates floating-point rounding within epsilon", () => {
    assert.strictEqual(
      grnLineQuantitySumErrorMessage({
        invoice_quantity: 10,
        accepted_quantity: 3.3333,
        rejected_quantity: 3.3333,
        shortage_quantity: 3.3334,
      }),
      null
    );
  });

  it("returns error for non-finite invoice quantity", () => {
    const msg = grnLineQuantitySumErrorMessage(valid({ invoice_quantity: NaN }));
    assert.ok(msg !== null);
    assert.ok(msg!.includes("valid numbers"));
  });

  it("returns error for non-finite sum", () => {
    const msg = grnLineQuantitySumErrorMessage(valid({ accepted_quantity: Infinity }));
    assert.ok(msg !== null);
    assert.ok(msg!.includes("valid numbers"));
  });
});

describe("assertGrnLineQuantitiesAccountable", () => {
  it("does not throw when quantities balance", () => {
    assert.doesNotThrow(() => assertGrnLineQuantitiesAccountable(valid()));
  });

  it("throws Error when sum does not match invoice quantity", () => {
    assert.throws(
      () => assertGrnLineQuantitiesAccountable(valid({ accepted_quantity: 5 })),
      Error
    );
  });

  it("throws with a user-visible message", () => {
    try {
      assertGrnLineQuantitiesAccountable(valid({ accepted_quantity: 5 }));
      assert.fail("should have thrown");
    } catch (e: unknown) {
      assert.ok(e instanceof Error);
      assert.ok(e.message.length > 0, "error message should be non-empty");
    }
  });
});
