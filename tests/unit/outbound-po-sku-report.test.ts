import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";
import { type SkuReportItemRow } from "../../src/server/services/outboundConsignmentItemsService";
import {
  buildSkuReportXlsxBuffer,
  computeSnapshotReportTaxRatePct,
  resolveSnapshotReportMasterSku,
  type OutboundPoRow,
} from "../../src/server/services/outboundPurchaseOrdersService";
import type { OutboundSkuLookups } from "../../src/server/services/eanMappingsService";
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

  it("resolves master SKU from inventory_sku_id when no master_sku", () => {
    const got = resolveSkuReportMasterSku(
      { inventory_sku_id: "INV-1" },
      {},
      makeItem()
    );
    assert.equal(got, "INV-1");
  });

  it("does not use po_secondary_sku as master SKU without lookups", () => {
    const got = resolveSkuReportMasterSku(
      { po_secondary_sku: "PO-SKU-LAST" },
      {},
      makeItem("PO-SKU-ITEM")
    );
    assert.equal(got, "");
  });

  it("resolves master SKU from EAN lookups when provided", () => {
    const lookups: OutboundSkuLookups = {
      companyId: 30044,
      companyCodeBySecondarySku: new Map(),
      eanBySkuKey: new Map([
        [
          "10149918",
          {
            sku_code: "AAC500",
            channel_ean: "10149918",
            universal_ean: "8901234567890",
            ean_type: "ean",
          },
        ],
      ]),
      listingSkuByKey: new Map(),
      binStockBySkuId: new Map(),
    };
    const got = resolveSkuReportMasterSku(
      { po_secondary_sku: "10149918" },
      {},
      makeItem("10149918"),
      lookups
    );
    assert.equal(got, "AAC500");
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
  it("resolves master SKU from listing and inventory_sku_id fallbacks", () => {
    assert.equal(
      resolveSnapshotReportMasterSku({ listing: { master_sku: "MASTER-L2" } }),
      "MASTER-L2"
    );
    assert.equal(resolveSnapshotReportMasterSku({ sku_id: "SKU-ID-2" }), "");
    assert.equal(
      resolveSnapshotReportMasterSku({ inventory_sku_id: "INV-2" }),
      "INV-2"
    );
    assert.equal(
      resolveSnapshotReportMasterSku({ po_secondary_sku: "PO-SKU-SNAPSHOT" }),
      ""
    );
  });

  it("buildSkuReportXlsxBuffer uses EAN master_sku, company code, and bin warehouse qty", () => {
    const lookups: OutboundSkuLookups = {
      companyId: 30044,
      companyCodeBySecondarySku: new Map(),
      eanBySkuKey: new Map([
        [
          "10149918",
          {
            sku_code: "AAC500",
            channel_ean: "10149918",
            universal_ean: "8901234567890",
            ean_type: "ean",
          },
        ],
      ]),
      listingSkuByKey: new Map(),
      binStockBySkuId: new Map([["AAC500", 77]]),
    };
    const po = {
      po_number: "PO-1",
      company_name: "Blinkit",
      po_issue_date: null,
      expiry_date: null,
      created_at: "2026-01-01",
      po_type: null,
      delivery_city: "Delhi",
      company_id: 30044,
    } as OutboundPoRow;
    const buffer = buildSkuReportXlsxBuffer(
      [
        {
          po_secondary_sku: "10149918",
          demand: 10,
          packed: 0,
          dispatched: 0,
        },
      ],
      po,
      lookups
    );
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheet = wb.Sheets["SKU Report"];
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
    const header = aoa[0];
    const data = aoa[1];
    const masterIdx = header.indexOf("master_sku");
    const ccpIdx = header.indexOf("company_code_primary");
    const whIdx = header.indexOf("warehouse_quantity");
    const zapIdx = header.indexOf("zap_ean");
    assert.equal(data[masterIdx], "AAC500");
    assert.equal(data[ccpIdx], "AAC500");
    assert.equal(data[whIdx], "77");
    assert.equal(data[zapIdx], "10149918");
  });

  it("buildSkuReportXlsxBuffer keeps title with inch marks and commas in correct columns", () => {
    const lookups: OutboundSkuLookups = {
      companyId: 30044,
      companyCodeBySecondarySku: new Map(),
      eanBySkuKey: new Map(),
      listingSkuByKey: new Map(),
      binStockBySkuId: new Map(),
    };
    const po = {
      po_number: "43886110040004",
      company_name: "Blinkit",
      po_issue_date: null,
      expiry_date: null,
      created_at: "2026-01-01",
      po_type: null,
      delivery_city: "Delhi",
      company_id: 30044,
    } as OutboundPoRow;
    const title = 'Showpiece (7", Black)(Box)';
    const buffer = buildSkuReportXlsxBuffer(
      [
        {
          title,
          mrp: "250",
          rate_without_tax: "211.86",
          tax_rate: "18",
          demand: 1,
          packed: 0,
          dispatched: 0,
        },
      ],
      po,
      lookups
    );
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheet = wb.Sheets["SKU Report"];
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
    const header = aoa[0];
    const data = aoa[1];
    const titleIdx = header.indexOf("title");
    const mrpIdx = header.indexOf("mrp");
    const rateIdx = header.indexOf("rate_without_tax");
    const taxIdx = header.indexOf("tax_rate");
    assert.equal(data[titleIdx], title);
    assert.equal(data[mrpIdx], "250");
    assert.equal(data[rateIdx], "211.86");
    assert.equal(data[taxIdx], "18");
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
