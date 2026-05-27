import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildConsignmentPackingSampleCsv,
  extractPoPackingSkusFromListings,
} from "../../src/lib/outbound-po-packing-skus.ts";

describe("extractPoPackingSkusFromListings", () => {
  it("reads content array and dedupes by item code", () => {
    const skus = extractPoPackingSkusFromListings({
      content: [
        {
          po_secondary_sku: "SKU-A",
          company_code_primary: "P1",
          company_code_secondary: "S1",
        },
        { item_code: "SKU-B", zap_ean: "8906176480245" },
        { po_secondary_sku: "SKU-A" },
        { sku: "SKU-C" },
      ],
    });
    assert.equal(skus.length, 3);
    assert.equal(skus[0]?.itemCode, "SKU-A");
    assert.equal(skus[0]?.companyCodePrimary, "P1");
    assert.equal(skus[1]?.itemCode, "SKU-B");
    assert.equal(skus[1]?.companyCodeSecondary, "8906176480245");
    assert.equal(skus[2]?.itemCode, "SKU-C");
  });

  it("returns empty for missing listings", () => {
    assert.deepEqual(extractPoPackingSkusFromListings(null), []);
    assert.deepEqual(extractPoPackingSkusFromListings({}), []);
  });
});

describe("buildConsignmentPackingSampleCsv", () => {
  it("emits header and one row per sku with placeholder qty", () => {
    const csv = buildConsignmentPackingSampleCsv({
      skus: [
        { itemCode: "10149864", companyCodePrimary: "AAC500", companyCodeSecondary: "EAN1" },
        { itemCode: "10146920", companyCodePrimary: null, companyCodeSecondary: null },
      ],
      defaultBinName: "Medium Carton",
      defaultBinNumber: 2,
    });
    const lines = csv.trim().split("\n");
    assert.equal(lines.length, 3);
    assert.ok(lines[0]?.includes("Bin Number"));
    assert.ok(lines[1]?.startsWith("2,Medium Carton,10149864,1,AAC500,EAN1"));
    assert.ok(lines[2]?.includes("10146920,1,,"));
  });
});
