import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computePoHeaderTotalsFromGrns,
  countSkusWithAcceptance,
  roundFillRatePct,
} from "@/lib/inboundPoHeaderTotals";

describe("roundFillRatePct", () => {
  it("returns percentage rounded to 2 decimals", () => {
    assert.equal(roundFillRatePct(10, 12), 83.33);
    assert.equal(roundFillRatePct(20, 20), 100);
    assert.equal(roundFillRatePct(0, 0), 0);
  });
});

describe("computePoHeaderTotalsFromGrns", () => {
  it("sums quantities across multiple GRNs", () => {
    const totals = computePoHeaderTotalsFromGrns({
      sku_count: 3,
      total_quantity: 100,
      skus_with_acceptance: 2,
      grns: [
        {
          grn_invoice_quantity: 30,
          grn_accepted_quantity: 28,
          grn_rejected_quantity: 2,
        },
        {
          grn_invoice_quantity: 20,
          grn_accepted_quantity: 18,
          grn_rejected_quantity: 1,
        },
      ],
    });
    assert.equal(totals.number_of_grns, 2);
    assert.equal(totals.total_invoice_quantity, 50);
    assert.equal(totals.total_accepted_quantity, 46);
    assert.equal(totals.total_rejected_quantity, 3);
    assert.equal(totals.quantity_fill_rate, 46);
    assert.equal(totals.sku_fill_rate, roundFillRatePct(2, 3));
  });

  it("returns zeros for PO with no GRNs", () => {
    const totals = computePoHeaderTotalsFromGrns({
      sku_count: 5,
      total_quantity: 50,
      skus_with_acceptance: 0,
      grns: [],
    });
    assert.deepEqual(totals, {
      number_of_grns: 0,
      total_invoice_quantity: 0,
      total_accepted_quantity: 0,
      total_rejected_quantity: 0,
      quantity_fill_rate: 0,
      sku_fill_rate: 0,
    });
  });

  it("matches eAutomate-style fill rates for single-SKU partial receipt", () => {
    const totals = computePoHeaderTotalsFromGrns({
      sku_count: 1,
      total_quantity: 12,
      skus_with_acceptance: 1,
      grns: [
        {
          grn_invoice_quantity: 12,
          grn_accepted_quantity: 10,
          grn_rejected_quantity: 1,
        },
      ],
    });
    assert.equal(totals.quantity_fill_rate, 83.33);
    assert.equal(totals.sku_fill_rate, 100);
  });
});

describe("countSkusWithAcceptance", () => {
  it("counts distinct SKUs with accepted qty > 0", () => {
    assert.equal(
      countSkusWithAcceptance([
        { sku_id: "A", accepted_quantity: 5 },
        { sku_id: "A", accepted_quantity: 2 },
        { sku_id: "B", accepted_quantity: 0 },
        { sku_id: "C", accepted_quantity: 1 },
      ]),
      2
    );
  });
});
