import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseOutboundPoLineItemsSpreadsheet } from "../../src/server/utils/outboundPoListingSpreadsheetParse";
import {
  computeCommercialTotalsFromRows,
  repairOutboundListingCommercialFields,
} from "../../src/server/services/outboundPurchaseOrdersService";
import {
  isMisalignedCommercialRow,
  normalizeOutboundListingRow,
} from "../../src/server/utils/outboundListingNormalize";
import { buildPendencyRowsFromListings } from "../../src/server/utils/outboundPoPendencyPdf";

describe("normalizeOutboundListingRow", () => {
  it("fixes inch-mark title column shift (10314301)", () => {
    const result = normalizeOutboundListingRow({
      po_secondary_sku: "10314301",
      title: 'eCraftIndia Ganesha in Palm Showpiece (6.2"',
      mrp: 150,
      rate_without_tax: "Black & Golden)(Box)",
      tax_rate: 127.12,
      demand: 18,
      total_amount: 762.72,
      margin: 6,
    });
    assert.equal(result.repaired, true);
    assert.equal(
      result.row.title,
      'eCraftIndia Ganesha in Palm Showpiece (6.2", Black & Golden)(Box)'
    );
    assert.equal(result.row.mrp, 150);
    assert.equal(result.row.rate_without_tax, 127.12);
    assert.equal(result.row.tax_rate, 18);
    assert.equal(result.row.color, "Black & Golden");
    assert.equal(result.row.demand, 6);
  });

  it("fixes brass horse row with 5% GST and recovered qty (10146916)", () => {
    const result = normalizeOutboundListingRow({
      po_secondary_sku: "10146916",
      title: 'eCraftIndia Brass Horse Showpiece (5"',
      mrp: 540,
      rate_without_tax: "Brown)",
      tax_rate: 514.29,
      demand: 5,
      warehouse_quantity: 164,
    });
    assert.equal(result.repaired, true);
    assert.equal(result.row.title, 'eCraftIndia Brass Horse Showpiece (5", Brown)');
    assert.equal(result.row.rate_without_tax, 514.29);
    assert.equal(result.row.tax_rate, 5);
    assert.equal(result.row.demand, 164);
  });

  it("fixes cow figurine title without gluing Silver to digits (10149918)", () => {
    const result = normalizeOutboundListingRow({
      po_secondary_sku: "10149918",
      title: "eCraftIndia Cow and Calf Figurines (10 x 10 x 10",
      mrp: 200,
      rate_without_tax: "Silver)(Box)",
      tax_rate: 190.48,
      demand: 5,
      total_amount: 952.4,
    });
    assert.equal(result.repaired, true);
    assert.equal(
      result.row.title,
      'eCraftIndia Cow and Calf Figurines (10 x 10 x 10", Silver)(Box)'
    );
    assert.equal(result.row.rate_without_tax, 190.48);
    assert.equal(result.row.tax_rate, 5);
    assert.equal(result.row.color, "Silver");
  });

  it("keeps 5% GST distinct from qty 5 when ambiguous (10314341)", () => {
    const result = normalizeOutboundListingRow({
      po_secondary_sku: "10314341",
      title: 'eCraftIndia Metal Elephant Showpiece (4.3"',
      mrp: 220,
      rate_without_tax: "Golden)(Box)",
      tax_rate: 209.52,
      demand: 5,
      total_amount: 1047.6,
    });
    assert.equal(result.repaired, true);
    assert.equal(result.row.tax_rate, 5);
    assert.equal(result.row.demand, 5);
  });

  it("leaves good rows unchanged (10149648)", () => {
    const row = {
      po_secondary_sku: "10149648",
      title: "eCraftIndia Monks with Hat Figurines for Home and Car(Box)",
      mrp: 999,
      rate_without_tax: 177.97,
      tax_rate: 18,
      demand: 50,
    };
    const result = normalizeOutboundListingRow(row);
    assert.equal(result.repaired, false);
    assert.equal(result.row.title, row.title);
    assert.equal(result.row.rate_without_tax, 177.97);
    assert.equal(result.row.tax_rate, 18);
    assert.equal(result.row.demand, 50);
  });

  it("repairOutboundListingCommercialFields remains compatible", () => {
    const repaired = repairOutboundListingCommercialFields({
      title: 'Showpiece (7"',
      rate_without_tax: "Black)(Box)",
      tax_rate: 211.86,
      demand: 18,
    });
    assert.equal(repaired.title, 'Showpiece (7", Black)(Box)');
    assert.equal(repaired.rate_without_tax, 211.86);
    assert.equal(repaired.tax_rate, 18);
  });
});

describe("parseOutboundPoLineItemsSpreadsheet unquoted inch titles", () => {
  it("parses unquoted Blinkit CSV with inch marks after rejoin + normalize", () => {
    const csv = [
      "Item Code,HSN Code,Product UPC,Product Description,Basic Cost Price,IGST %,Qty.,MRP,Margin %,Total Amt",
      "10314301,39269099,8906176482287,eCraftIndia Ganesha in Palm Showpiece (6.2\", Black & Golden)(Box),127.12,18,6,150,93.33,762.72",
    ].join("\n");
    const { content, stillMisaligned } = parseOutboundPoLineItemsSpreadsheet(
      Buffer.from(csv, "utf8"),
      "blinkit-unquoted.csv"
    );
    assert.strictEqual(content.length, 1);
    assert.strictEqual(stillMisaligned, 0);
    assert.strictEqual(
      content[0].title,
      'eCraftIndia Ganesha in Palm Showpiece (6.2", Black & Golden)(Box)'
    );
    assert.strictEqual(content[0].rate_without_tax, 127.12);
    assert.strictEqual(content[0].tax_rate, 18);
    assert.strictEqual(content[0].original_demand, 6);
    assert.strictEqual(content[0].mrp, 150);
  });
});

describe("pendency and commercial totals after normalize", () => {
  it("pendency pending uses recovered demand not GST percent", () => {
    const rows = [
      normalizeOutboundListingRow({
        po_secondary_sku: "10314301",
        title: 'eCraftIndia Ganesha (6.2"',
        rate_without_tax: "Black & Golden)(Box)",
        tax_rate: 127.12,
        demand: 18,
        margin: 6,
        total_amount: 762.72,
      }).row,
    ];
    const pendency = buildPendencyRowsFromListings(rows);
    assert.equal(pendency[0].pending, 6);
    assert.notEqual(pendency[0].pending, 18);
  });

  it("commercial totals use repaired rate and demand", () => {
    const rows = [
      normalizeOutboundListingRow({
        po_secondary_sku: "10314301",
        title: 'Ganesha (6.2"',
        rate_without_tax: "Black)(Box)",
        tax_rate: 127.12,
        demand: 18,
        margin: 6,
        total_amount: 762.72,
      }).row,
      {
        po_secondary_sku: "10149648",
        rate_without_tax: 177.97,
        tax_rate: 18,
        demand: 50,
        total_amount: 20000,
      },
    ];
    const totals = computeCommercialTotalsFromRows(rows);
    assert.ok(totals.total_before_tax > 0);
    assert.ok(totals.total_after_tax > 0);
    assert.ok(!isMisalignedCommercialRow(rows[0]));
  });
});
