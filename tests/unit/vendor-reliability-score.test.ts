import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bandForScore,
  computeVendorReliabilityScore,
} from "@/lib/vendorReliabilityScore";

describe("vendorReliabilityScore", () => {
  it("scores high acceptance and low shortage highly", () => {
    const score = computeVendorReliabilityScore({
      vendor_id: 1,
      acceptance_rate_pct: 98,
      shortage_rate_pct: 1,
      rate_diff_dn_count: 0,
      grn_count: 10,
    });
    assert.ok(score >= 90);
    assert.equal(bandForScore(score), "PREFERRED");
  });

  it("flags high shortage vendors", () => {
    const score = computeVendorReliabilityScore({
      vendor_id: 2,
      acceptance_rate_pct: 70,
      shortage_rate_pct: 25,
      rate_diff_dn_count: 5,
      grn_count: 10,
    });
    assert.ok(score < 70);
  });
});
