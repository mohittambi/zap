import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOutboundPoListingsPreviewFromRows,
  type OutboundPoRow,
} from "../../src/server/services/outboundPurchaseOrdersService";
import type { OutboundSkuLookups } from "../../src/server/services/eanMappingsService";

const emptyLookups: OutboundSkuLookups = {
  companyId: null,
  companyCodeBySecondarySku: new Map(),
  eanBySkuKey: new Map(),
  listingSkuByKey: new Map(),
  binStockBySkuId: new Map(),
};

const po = {
  id: 1,
  po_number: "1735810041652",
  company_name: "Blinkit",
  po_issue_date: null,
  expiry_date: null,
  created_at: "2026-01-01",
  po_type: null,
  delivery_city: "Delhi",
  company_id: 30044,
} as OutboundPoRow;

describe("buildOutboundPoListingsPreviewFromRows", () => {
  it("marks corrupted Blinkit row as repaired with correct commercial values", () => {
    const preview = buildOutboundPoListingsPreviewFromRows(
      po,
      [
        {
          po_secondary_sku: "10314301",
          title: 'eCraftIndia Ganesha in Palm Showpiece (6.2"',
          mrp: 150,
          rate_without_tax: "Black & Golden)(Box)",
          tax_rate: 127.12,
          demand: 18,
          total_amount: 762.72,
          margin: 6,
        },
      ],
      emptyLookups
    );

    assert.equal(preview.stats.totalRows, 1);
    assert.equal(preview.stats.repairedCount, 1);
    assert.equal(preview.stats.errorCount, 0);
    const row = preview.rowsPreview[0];
    assert.equal(row.status, "repaired");
    assert.equal(
      row.title,
      'eCraftIndia Ganesha in Palm Showpiece (6.2", Black & Golden)(Box)'
    );
    assert.equal(row.rate_without_tax, "127.12");
    assert.equal(row.tax_rate, "18");
    assert.equal(row.color, "Black & Golden");
    assert.equal(row.demand, "6");
    assert.equal(row.mrp, "150");
    assert.ok(row.issues.length > 0);
  });

  it("marks clean row as ok", () => {
    const preview = buildOutboundPoListingsPreviewFromRows(
      po,
      [
        {
          po_secondary_sku: "10149648",
          title: "eCraftIndia Monks with Hat Figurines for Home and Car(Box)",
          mrp: 999,
          rate_without_tax: 177.97,
          tax_rate: 18,
          demand: 50,
        },
      ],
      emptyLookups
    );

    assert.equal(preview.stats.repairedCount, 0);
    assert.equal(preview.stats.errorCount, 0);
    assert.equal(preview.stats.warningCount, 0);
    assert.equal(preview.rowsPreview[0].status, "ok");
    assert.equal(preview.rowsPreview[0].rate_without_tax, "177.97");
    assert.equal(preview.rowsPreview[0].tax_rate, "18");
    assert.equal(preview.rowsPreview[0].demand, "50");
  });

  it("marks row with missing SKU and zero demand as warning", () => {
    const preview = buildOutboundPoListingsPreviewFromRows(
      po,
      [
        {
          po_secondary_sku: "",
          title: "Sample item",
          // Pick an MRP that does NOT look like rate-with-tax (so normalization doesn't mark it repaired).
          mrp: 120,
          rate_without_tax: 80,
          tax_rate: 18,
          demand: 0,
        },
      ],
      emptyLookups
    );

    assert.equal(preview.rowsPreview[0].status, "warning");
    assert.equal(preview.stats.warningCount, 1);
    assert.ok(
      preview.rowsPreview[0].issues.some((i) => i.includes("Missing PO secondary SKU"))
    );
    assert.ok(
      preview.rowsPreview[0].issues.some((i) => i.includes("Demand is zero or invalid"))
    );
  });

  it("aggregates stats across mixed rows", () => {
    const preview = buildOutboundPoListingsPreviewFromRows(
      po,
      [
        {
          po_secondary_sku: "10149648",
          title: "Clean row",
          mrp: 999,
          rate_without_tax: 177.97,
          tax_rate: 18,
          demand: 50,
        },
        {
          po_secondary_sku: "10314301",
          title: 'eCraftIndia Ganesha in Palm Showpiece (6.2"',
          mrp: 150,
          rate_without_tax: "Black & Golden)(Box)",
          tax_rate: 127.12,
          demand: 18,
          margin: 6,
        },
        {
          po_secondary_sku: "",
          title: "Sparse row",
          mrp: 120,
          rate_without_tax: 80,
          tax_rate: 18,
          demand: 0,
        },
      ],
      emptyLookups
    );

    assert.equal(preview.stats.totalRows, 3);
    assert.equal(preview.stats.repairedCount, 1);
    assert.equal(preview.stats.warningCount, 1);
    assert.equal(preview.stats.errorCount, 0);
    assert.equal(preview.ok, true);
    assert.equal(preview.parseWarning, undefined);
    assert.deepEqual(
      preview.rowsPreview.map((r) => r.status),
      ["ok", "repaired", "warning"]
    );
  });
});
