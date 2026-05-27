import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isValidEanValue,
  eanValueToString,
  mergeZapEanIntoRows,
  mappingSkuKeysFromRow,
  resolveZapEanDisplay,
  pivotMappingsToMatrixRows,
  parseMatrixSortColumn,
  type ZapEanLookup,
} from "../../src/server/services/eanMappingsService";

describe("eanMappingsService helpers", () => {
  it("isValidEanValue rejects empty and zero", () => {
    assert.equal(isValidEanValue(null), false);
    assert.equal(isValidEanValue(""), false);
    assert.equal(isValidEanValue(0), false);
    assert.equal(isValidEanValue("0"), false);
    assert.equal(isValidEanValue("8906176480269"), true);
  });

  it("eanValueToString trims valid values", () => {
    assert.equal(eanValueToString(" 8906176480269 "), "8906176480269");
    assert.equal(eanValueToString(0), "");
  });

  it("mappingSkuKeysFromRow includes master_sku and marketplace po_secondary_sku", () => {
    const keys = mappingSkuKeysFromRow({
      po_secondary_sku: "10149864",
      master_sku: "AAC500",
    });
    assert.deepEqual(keys, ["AAC500", "10149864"]);
  });

  it("resolveZapEanDisplay uses EAN barcode for ean_type ean", () => {
    const hit: ZapEanLookup = {
      sku_code: "MSKU1",
      channel_ean: "8906176480269",
      universal_ean: "8906176480269",
      ean_type: "ean",
    };
    assert.equal(resolveZapEanDisplay("ZEPTO-ITEM-123", hit), "8906176480269");
  });

  it("resolveZapEanDisplay falls back to universal when channel equals company code", () => {
    const hit: ZapEanLookup = {
      sku_code: "AAC500",
      channel_ean: "ECIASWPS80164558",
      universal_ean: "8906176480269",
      ean_type: "sku_code",
    };
    assert.equal(resolveZapEanDisplay("ECIASWPS80164558", hit), "8906176480269");
  });

  it("mergeZapEanIntoRows attaches distinct zap_ean from master_sku lookup", () => {
    const lookup = new Map<string, ZapEanLookup>([
      [
        "AAC500",
        {
          sku_code: "AAC500",
          channel_ean: "ECIASWPS80164558",
          universal_ean: "8906176480269",
          ean_type: "sku_code",
        },
      ],
    ]);
    const out = mergeZapEanIntoRows(
      [
        {
          po_secondary_sku: "ECIASWPS80164558",
          master_sku: "AAC500",
          company_code_primary: "ECIASWPS80164558",
        },
      ],
      lookup
    );
    assert.equal(out[0].zap_ean, "8906176480269");
    assert.equal(out[0].universal_ean, "8906176480269");
  });

  it("mergeZapEanIntoRows resolves universal EAN via po_secondary_sku (Blinkit item code)", () => {
    const lookup = new Map<string, ZapEanLookup>([
      [
        "10149864",
        {
          sku_code: "AAC500",
          channel_ean: "10149864",
          universal_ean: "8906176480498",
          ean_type: "sku_code",
        },
      ],
    ]);
    const out = mergeZapEanIntoRows(
      [{ po_secondary_sku: "10149864", product_upc: "8906176480245" }],
      lookup
    );
    assert.equal(out[0].zap_ean, "8906176480498");
    assert.equal(out[0].universal_ean, "8906176480498");
  });

  it("mergeZapEanIntoRows sets master_sku and company_code_primary from EAN sku_code", () => {
    const lookup = new Map<string, ZapEanLookup>([
      [
        "10149864",
        {
          sku_code: "AAC500",
          channel_ean: "10149864",
          universal_ean: "8901234567890",
          ean_type: "sku_code",
        },
      ],
    ]);
    const out = mergeZapEanIntoRows(
      [{ po_secondary_sku: "10149864", company_code_primary: "10149864" }],
      lookup
    );
    assert.equal(out[0].master_sku, "AAC500");
    assert.equal(out[0].company_code_primary, "AAC500");
    assert.equal(out[0].zap_ean, "8901234567890");
  });

  it("mergeZapEanIntoRows returns empty zap_ean when no mapping", () => {
    const out = mergeZapEanIntoRows(
      [{ po_secondary_sku: "UNKNOWN", company_code_primary: "X" }],
      new Map()
    );
    assert.equal(out[0].zap_ean, "");
    assert.equal(out[0].universal_ean, "");
  });

  it("pivotMappingsToMatrixRows builds by_column per company", () => {
    const companyIdToColumnKey = new Map<number, string>([
      [1, "zepto_ean"],
      [2, "myntra_sku"],
    ]);
    const rows = pivotMappingsToMatrixRows(
      ["AAC500"],
      [
        {
          sku_code: "AAC500",
          company_id: 1,
          zap_ean: "8906176480269",
          universal_ean: "8906176480269",
        },
        {
          sku_code: "AAC500",
          company_id: 2,
          zap_ean: "MYNTRA-SKU-1",
          universal_ean: "8906176480269",
        },
      ],
      companyIdToColumnKey
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].sku_code, "AAC500");
    assert.equal(rows[0].universal_ean, "8906176480269");
    assert.equal(rows[0].by_column.zepto_ean, "8906176480269");
    assert.equal(rows[0].by_column.myntra_sku, "MYNTRA-SKU-1");
  });

  it("parseMatrixSortColumn accepts sku, universal, and column keys", () => {
    const cols = [
      { company_id: 1, column_key: "zepto_ean", label: "Zepto" },
    ];
    assert.deepEqual(parseMatrixSortColumn("sku_code", cols), { kind: "sku" });
    assert.deepEqual(parseMatrixSortColumn("universal_ean", cols), {
      kind: "universal",
    });
    assert.deepEqual(parseMatrixSortColumn("zepto_ean", cols), {
      kind: "column",
      column_key: "zepto_ean",
      company_id: 1,
    });
    assert.equal(parseMatrixSortColumn("invalid", cols), null);
  });
});
