import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseEanMappingsImportCsv } from "../../src/server/services/eanMappingsImportService";
import { buildPoSpreadsheetPreviewWarnings } from "../../src/server/services/outboundPoSpreadsheetIngestService";

describe("eanMappingsImportService", () => {
  it("parses valid import CSV rows", () => {
    const csv = Buffer.from(
      "sku_code,company_name,zap_ean,ean_type,universal_ean\nWMDFWH002,Blinkit,10151234,code,8906176480123\n",
      "utf8"
    );
    const rows = parseEanMappingsImportCsv(csv);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].sku_code, "WMDFWH002");
    assert.equal(rows[0].company_name, "Blinkit");
    assert.equal(rows[0].zap_ean, "10151234");
  });

  it("normalizes scientific notation in import CSV", () => {
    const csv = Buffer.from(
      "sku_code,company_name,zap_ean,ean_type,universal_ean\nAAC500,Zepto,8.906176480269E+12,ean,8906176480269\n",
      "utf8"
    );
    const rows = parseEanMappingsImportCsv(csv);
    assert.equal(rows[0].zap_ean, "8906176480269");
  });
});

describe("outboundPoSpreadsheetIngest warnings", () => {
  it("flags sample filename and row count drop", () => {
    const { warnings } = buildPoSpreadsheetPreviewWarnings({
      filename: "sample_po.csv",
      poNumber: "1735810041652",
      previousRowCount: 10,
      newRowCount: 2,
      stillMisaligned: 0,
    });
    assert.ok(warnings.includes("sample_filename"));
    assert.ok(warnings.includes("row_count_drop"));
  });
});
