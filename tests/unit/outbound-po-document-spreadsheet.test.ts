import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { parseOutboundPoLineItemsSpreadsheet } from "../../src/server/utils/outboundPoListingSpreadsheetParse";
import { normalizeOutboundListingRow } from "../../src/server/utils/outboundListingNormalize";
import {
  buildPoSpreadsheetPreviewWarnings,
  countListingsSnapshotRows,
  requiresPoSpreadsheetReplaceConfirm,
} from "../../src/server/services/outboundPoSpreadsheetIngestService";

const fixtureDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/outbound"
);

export function loadPo1735810041652Fixture(): Buffer {
  return fs.readFileSync(path.join(fixtureDir, "po-1735810041652.xlsx"));
}

describe("outbound PO document spreadsheet fixture", () => {
  it("parses golden xlsx with 17 line rows", () => {
    const buf = loadPo1735810041652Fixture();
    const { content } = parseOutboundPoLineItemsSpreadsheet(buf, "po-1735810041652.xlsx");
    assert.equal(content.length, 17);
  });

  it("row 10314301 has all 17 vendor commercial columns", () => {
    const buf = loadPo1735810041652Fixture();
    const { content } = parseOutboundPoLineItemsSpreadsheet(buf, "po-1735810041652.xlsx");
    const row = content.find((r) => String(r.po_secondary_sku) === "10314301");
    assert.ok(row);
    assert.equal(row.hsn_code, "39269099");
    assert.equal(row.product_upc, "8906176482287");
    assert.equal(
      row.title,
      'eCraftIndia Ganesha in Palm Showpiece (6.2", Black & Golden)(Box)'
    );
    assert.equal(row.grammage, "1 pc");
    assert.equal(row.rate_without_tax, 127.12);
    assert.equal(row.cgst_percent, 0);
    assert.equal(row.sgst_percent, 0);
    assert.equal(row.igst_percent, 18);
    assert.equal(row.cess_percent, 0);
    assert.equal(row.additional_cess, 0);
    assert.equal(row.tax_amount, 22.88);
    assert.equal(row.landing_rate, 150);
    assert.equal(row.original_demand ?? row.demand, 35);
    assert.equal(row.mrp, 1099);
    assert.equal(row.margin, 86.35);
    assert.equal(row.total_amount, 5250);
    assert.equal(row.tax_rate, 18);
  });

  it("no clean-parse row has mrp equal to landing_rate", () => {
    const buf = loadPo1735810041652Fixture();
    const { content } = parseOutboundPoLineItemsSpreadsheet(buf, "po-1735810041652.xlsx");
    for (const row of content) {
      const mrp = Number(row.mrp);
      const landing = Number(row.landing_rate);
      if (!Number.isFinite(mrp) || !Number.isFinite(landing)) continue;
      assert.notEqual(mrp, landing, `sku ${row.po_secondary_sku}`);
    }
  });

  it("sample CSV has only 2 rows", () => {
    const samplePath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../public/samples/outbound/sample_po_line_items_spreadsheet.csv"
    );
    const buf = fs.readFileSync(samplePath);
    const { content } = parseOutboundPoLineItemsSpreadsheet(
      buf,
      "sample_po_line_items_spreadsheet.csv"
    );
    assert.equal(content.length, 2);
  });

  it("preview warnings flag sample filename and row count drop", () => {
    const { warnings } = buildPoSpreadsheetPreviewWarnings({
      filename: "sample_po_line_items_spreadsheet (1).csv",
      poNumber: "1735810041652",
      previousRowCount: 17,
      newRowCount: 2,
      stillMisaligned: 0,
    });
    assert.ok(warnings.includes("sample_filename"));
    assert.ok(warnings.includes("row_count_drop"));
    assert.equal(
      requiresPoSpreadsheetReplaceConfirm({
        previousRowCount: 17,
        newRowCount: 2,
        warnings,
      }),
      true
    );
  });

  it("countListingsSnapshotRows reads envelope content", () => {
    assert.equal(
      countListingsSnapshotRows({ content: [{ po_secondary_sku: "1" }, {}] }),
      2
    );
  });

  it("normalized fixture row 10149648 keeps mrp 999", () => {
    const buf = loadPo1735810041652Fixture();
    const { content } = parseOutboundPoLineItemsSpreadsheet(buf, "po-1735810041652.xlsx");
    const row = content.find((r) => String(r.po_secondary_sku) === "10149648");
    assert.ok(row);
    const n = normalizeOutboundListingRow(row);
    assert.equal(n.row.mrp, 999);
    assert.equal(n.row.landing_rate, 210);
  });
});
