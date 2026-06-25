import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeGrnHeaderTotalsFromItems,
  pickQtyFromRaw,
} from "@/lib/inboundGrnQuantities";

describe("computeGrnHeaderTotalsFromItems", () => {
  it("sums quantities across line items", () => {
    const totals = computeGrnHeaderTotalsFromItems([
      {
        raw: {
          invoice_quantity: 20,
          accepted_quantity: 18,
          rejected_quantity: 1,
          shortage_quantity: 1,
        },
      },
      {
        raw: {
          invoice_quantity: 10,
          accepted_quantity: 10,
          rejected_quantity: 0,
          shortage_quantity: 0,
        },
      },
    ]);
    assert.equal(totals.grn_sku_count, 2);
    assert.equal(totals.grn_invoice_quantity, 30);
    assert.equal(totals.grn_accepted_quantity, 28);
    assert.equal(totals.grn_rejected_quantity, 1);
    assert.equal(totals.grn_shortage_quantity, 1);
    assert.equal(totals.zap_receipt_exception, true);
  });

  it("returns zeros for empty items", () => {
    const totals = computeGrnHeaderTotalsFromItems([]);
    assert.deepEqual(totals, {
      grn_sku_count: 0,
      grn_invoice_quantity: 0,
      grn_accepted_quantity: 0,
      grn_rejected_quantity: 0,
      grn_shortage_quantity: 0,
      zap_receipt_exception: false,
    });
  });

  it("reads alternate jsonb keys", () => {
    assert.equal(
      pickQtyFromRaw({ grn_accepted_quantity: "5" }, ["accepted_quantity"]),
      0
    );
    assert.equal(
      pickQtyFromRaw({ grn_accepted_quantity: "5" }, [
        "grn_accepted_quantity",
      ]),
      5
    );
  });
});
