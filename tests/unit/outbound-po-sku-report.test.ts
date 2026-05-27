import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type SkuReportItemRow } from "../../src/server/services/outboundConsignmentItemsService";
import {
  computeSnapshotReportTaxRatePct,
  resolveSnapshotReportMasterSku,
} from "../../src/server/services/outboundPurchaseOrdersService";
import {
  computeSkuReportTaxRatePct,
  resolveSkuReportMasterSku,
} from "../../src/app/api/outbound/purchase-orders/[id]/eautomate-actions/route";

function makeItem(po_secondary_sku = "PO-SKU-1"): SkuReportItemRow {
  return {
    po_secondary_sku,
    company_code_primary: null,
    company_code_secondary: null,
    mrp: null,
    original_demand: null,
    dispatched_quantity: null,
    consignment_quantity: null,
    overall_fill_rate: null,
    raw: {},
  };
}

describe("SKU report fallback helpers", () => {
  it("resolves master SKU from raw.master_sku", () => {
    const got = resolveSkuReportMasterSku(
      { master_sku: "MASTER-1" },
      {},
      makeItem()
    );
    assert.equal(got, "MASTER-1");
  });

  it("resolves master SKU from nested listing.master_sku", () => {
    const got = resolveSkuReportMasterSku(
      {},
      { master_sku: "MASTER-LISTING" },
      makeItem()
    );
    assert.equal(got, "MASTER-LISTING");
  });

  it("resolves master SKU from sku_id fallback", () => {
    const got = resolveSkuReportMasterSku(
      { sku_id: "SKU-ID-1" },
      {},
      makeItem()
    );
    assert.equal(got, "SKU-ID-1");
  });

  it("resolves master SKU from po_secondary_sku as last fallback", () => {
    const got = resolveSkuReportMasterSku(
      { po_secondary_sku: "PO-SKU-LAST" },
      {},
      makeItem("PO-SKU-ITEM")
    );
    assert.equal(got, "PO-SKU-LAST");
  });

  it("uses explicit tax_rate when provided as percent string", () => {
    const got = computeSkuReportTaxRatePct({
      explicitTaxRate: " 18 % ",
      explicitTaxRateFallback: null,
      demand: 2,
      rateWithoutTax: 100,
      totalAmount: 236,
      landingRate: null,
    });
    assert.equal(got, 18);
  });

  it("uses fallback explicit tax_rate alias when primary is missing", () => {
    const got = computeSkuReportTaxRatePct({
      explicitTaxRate: null,
      explicitTaxRateFallback: "12%",
      demand: 2,
      rateWithoutTax: 100,
      totalAmount: 224,
      landingRate: null,
    });
    assert.equal(got, 12);
  });

  it("computes tax_rate from total_amount/rate_without_tax/demand", () => {
    const got = computeSkuReportTaxRatePct({
      explicitTaxRate: null,
      explicitTaxRateFallback: null,
      demand: 2,
      rateWithoutTax: 100,
      totalAmount: 236,
      landingRate: null,
    });
    assert.equal(got, 18);
  });

  it("computes tax_rate from landing_rate/rate_without_tax", () => {
    const got = computeSkuReportTaxRatePct({
      explicitTaxRate: null,
      explicitTaxRateFallback: null,
      demand: 0,
      rateWithoutTax: 100,
      totalAmount: null,
      landingRate: 118,
    });
    assert.equal(got, 18);
  });

  it("returns null for unrealistic computed outlier values", () => {
    const got = computeSkuReportTaxRatePct({
      explicitTaxRate: null,
      explicitTaxRateFallback: null,
      demand: 1,
      rateWithoutTax: 100,
      totalAmount: 500,
      landingRate: null,
    });
    assert.equal(got, null);
  });
});

describe("snapshot SKU report fallbacks", () => {
  it("resolves master SKU from listing and sku_id fallbacks", () => {
    assert.equal(
      resolveSnapshotReportMasterSku({ listing: { master_sku: "MASTER-L2" } }),
      "MASTER-L2"
    );
    assert.equal(resolveSnapshotReportMasterSku({ sku_id: "SKU-ID-2" }), "SKU-ID-2");
    assert.equal(
      resolveSnapshotReportMasterSku({ po_secondary_sku: "PO-SKU-SNAPSHOT" }),
      "PO-SKU-SNAPSHOT"
    );
  });

  it("computes snapshot tax_rate from commercial fields", () => {
    const rowA = { demand: 2, rate_without_tax: 100, total_amount: 236 };
    assert.equal(computeSnapshotReportTaxRatePct(rowA), 18);

    const rowB = { rate_without_tax: 100, landing_rate: 118 };
    assert.equal(computeSnapshotReportTaxRatePct(rowB), 18);
  });

  it("parses explicit snapshot tax_rate aliases and percent strings", () => {
    assert.equal(computeSnapshotReportTaxRatePct({ tax_rate: "18%" }), 18);
    assert.equal(computeSnapshotReportTaxRatePct({ igst_percent: "5 %" }), 5);
    assert.equal(
      computeSnapshotReportTaxRatePct({ listing: { gst_rate: "12%" } }),
      12
    );
  });

  it("returns null for unrealistic snapshot computed outlier values", () => {
    const row = { demand: 1, rate_without_tax: 100, total_amount: 500 };
    assert.equal(computeSnapshotReportTaxRatePct(row), null);
  });
});
