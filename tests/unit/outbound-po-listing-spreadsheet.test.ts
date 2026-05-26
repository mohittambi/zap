import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseOutboundPoLineItemsSpreadsheet } from "../../src/server/utils/outboundPoListingSpreadsheetParse";
import {
  computeAnalyticsFromListingsRows,
  computeCommercialTotalsFromRows,
} from "../../src/server/services/outboundPurchaseOrdersService";

const sampleCsvPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../public/samples/outbound/sample_po_line_items_spreadsheet.csv"
);

describe("parseOutboundPoLineItemsSpreadsheet", () => {
  it("parses public sample CSV with HSN, tax rate, and commercial columns", () => {
    const buf = fs.readFileSync(sampleCsvPath);
    const { content } = parseOutboundPoLineItemsSpreadsheet(buf, "sample_po_line_items_spreadsheet.csv");
    assert.ok(content.length >= 2, "sample should have at least 2 line rows");
    const row = content[0];
    assert.strictEqual(row.po_secondary_sku, "10149864");
    assert.strictEqual(row.hsn_code, "39269099");
    assert.strictEqual(row.product_upc, "8906176480245");
    assert.strictEqual(row.tax_rate, 18);
    assert.strictEqual(row.original_demand, 100);
    assert.strictEqual(row.demand, 100);
    assert.strictEqual(row.landing_rate, 200);
    assert.strictEqual(row.mrp, 2999);
    assert.strictEqual(row.margin, 93.33);
    assert.strictEqual(row.total_amount, 20000);
    assert.strictEqual(row.rate_without_tax, 169.49);
  });

  it("parses vendor-style Blink PO column headers (CSV Qty.)", () => {
    const csv = [
      "Item Code,HSN Code,Product UPC,Product Description,Basic Cost Price,IGST %,Qty.,MRP,Margin %,Total Amt",
      "10149864,39269099,8906176480245,eCraftIndia Buddha Figurines,169.49,18,100,2999,93.33,20000",
    ].join("\n");
    const { content } = parseOutboundPoLineItemsSpreadsheet(
      Buffer.from(csv, "utf8"),
      "vendor-po.csv"
    );
    assert.strictEqual(content.length, 1);
    assert.strictEqual(content[0].po_secondary_sku, "10149864");
    assert.strictEqual(content[0].hsn_code, "39269099");
    assert.strictEqual(content[0].product_upc, "8906176480245");
    assert.strictEqual(content[0].title, "eCraftIndia Buddha Figurines");
    assert.strictEqual(content[0].rate_without_tax, 169.49);
    assert.strictEqual(content[0].tax_rate, 18);
    assert.strictEqual(content[0].original_demand, 100);
    assert.strictEqual(content[0].mrp, 2999);
    assert.strictEqual(content[0].margin, 93.33);
    assert.strictEqual(content[0].total_amount, 20000);
  });

  it("parses GST Rate header as tax_rate", () => {
    const csv = [
      "Item Code,HSN Code,GST Rate,Quantity,MRP",
      "SKU-1,39269099,12,5,499",
    ].join("\n");
    const { content } = parseOutboundPoLineItemsSpreadsheet(
      Buffer.from(csv, "utf8"),
      "gst.csv"
    );
    assert.strictEqual(content.length, 1);
    assert.strictEqual(content[0].tax_rate, 12);
    assert.strictEqual(content[0].hsn_code, "39269099");
  });

  it("parses vendor Excel with Quantity column and skips footer rows", () => {
    const csv = [
      "Item Code,HSN Code,Product UPC,Product Description,Basic Cost Price,IGST %,Quantity,MRP,Margin %,Total Amount",
      "10149864,39269099,8906176480245,eCraftIndia Buddha Figurines,169.49,18,100,2999,93.33,20000",
      "10146920,39269099,8906176480030,Golden Buddha,42.33,18,51,999,95,2547.45",
      ",,,,,,Total Quantity,226,,Total Amount,38047.45",
    ].join("\n");
    const { content } = parseOutboundPoLineItemsSpreadsheet(
      Buffer.from(csv, "utf8"),
      "vendor-po.csv"
    );
    assert.strictEqual(content.length, 2);
    assert.strictEqual(content[0].original_demand, 100);
    assert.strictEqual(content[0].demand, 100);
    assert.strictEqual(content[1].original_demand, 51);
  });

  it("returns empty content when no headers match", () => {
    const csv = "foo,bar,baz\n1,2,3\n";
    const { content } = parseOutboundPoLineItemsSpreadsheet(
      Buffer.from(csv, "utf8"),
      "empty.csv"
    );
    assert.deepStrictEqual(content, []);
  });
});

describe("computeAnalyticsFromListingsRows", () => {
  it("rolls up sku count and demand from parsed rows", () => {
    const analytics = computeAnalyticsFromListingsRows([
      { po_secondary_sku: "A", original_demand: 100 },
      { po_secondary_sku: "B", original_demand: 51 },
    ]);
    assert.strictEqual(analytics.sku_count, 2);
    assert.strictEqual(analytics.total_demand, 151);
    assert.strictEqual(analytics.total_pending, 151);
    assert.strictEqual(analytics.total_dispatched, 0);
  });

  it("rolls up commercial totals from rate and total_amount columns", () => {
    const commercial = computeCommercialTotalsFromRows([
      {
        original_demand: 100,
        rate_without_tax: 169.49,
        total_amount: 20000,
        tax_rate: 18,
      },
      {
        original_demand: 51,
        rate_without_tax: 42.33,
        total_amount: 2547.45,
        tax_rate: 18,
      },
    ]);
    assert.strictEqual(commercial.total_before_tax, 19107.83);
    assert.strictEqual(commercial.total_after_tax, 22547.45);

    const analytics = computeAnalyticsFromListingsRows([
      {
        original_demand: 100,
        rate_without_tax: 169.49,
        total_amount: 20000,
      },
    ]);
    assert.strictEqual(analytics.total_before_tax, 16949);
    assert.strictEqual(analytics.total_after_tax, 20000);
  });
});
