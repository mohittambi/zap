import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";
import { type SkuReportItemRow } from "../../src/server/services/outboundConsignmentItemsService";
import {
  buildSkuReportXlsxBuffer,
  computeSnapshotReportTaxRatePct,
  consignmentItemsToSkuReportRows,
  mergeSkuReportConsignmentWithSnapshot,
  repairOutboundListingCommercialFields,
  resolveOutboundListingMrp,
  resolveSnapshotReportMasterSku,
  type OutboundPoRow,
} from "../../src/server/services/outboundPurchaseOrdersService";
import { normalizeOutboundListingRow, computeOutboundTaxAmountPerUnit } from "../../src/server/utils/outboundListingNormalize";
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
      labelsMrpBySecondarySku: new Map(),
      labelsMrpByMasterSku: new Map(),
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
      labelsMrpBySecondarySku: new Map(),
      labelsMrpByMasterSku: new Map(),
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
      labelsMrpBySecondarySku: new Map(),
      labelsMrpByMasterSku: new Map(),
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

  it("repairOutboundListingCommercialFields fixes inch-mark title column shift", () => {
    const repaired = repairOutboundListingCommercialFields({
      po_secondary_sku: "10314301",
      title: 'eCraftIndia Ganesha in Palm Showpiece (6.2"',
      mrp: 150,
      rate_without_tax: "Black & Golden)(Box)",
      tax_rate: 127.12,
      demand: 18,
      original_demand: 18,
    });
    assert.equal(
      repaired.title,
      'eCraftIndia Ganesha in Palm Showpiece (6.2", Black & Golden)(Box)'
    );
    assert.equal(repaired.mrp, 150);
    assert.equal(repaired.rate_without_tax, 127.12);
    assert.equal(repaired.tax_rate, 18);
    assert.equal(repaired.demand, undefined);
  });

  it("buildSkuReportXlsxBuffer repairs corrupted rows before export", () => {
    const lookups: OutboundSkuLookups = {
      companyId: 30044,
      companyCodeBySecondarySku: new Map(),
      eanBySkuKey: new Map(),
      listingSkuByKey: new Map(),
      binStockBySkuId: new Map(),
      labelsMrpBySecondarySku: new Map(),
      labelsMrpByMasterSku: new Map(),
    };
    const po = {
      po_number: "1735810041652",
      company_name: "Blinkit",
      po_issue_date: null,
      expiry_date: null,
      created_at: "2026-01-01",
      po_type: null,
      delivery_city: "Lucknow",
      company_id: 30044,
    } as OutboundPoRow;
    const buffer = buildSkuReportXlsxBuffer(
      [
        normalizeOutboundListingRow({
          title: 'eCraftIndia Ganesha in Palm Showpiece (6.2"',
          mrp: "150",
          rate_without_tax: "Black & Golden)(Box)",
          tax_rate: "127.12",
          demand: 18,
          margin: 6,
          total_amount: 762.72,
          packed: 0,
          dispatched: 0,
        }).row,
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
    assert.equal(
      data[titleIdx],
      'eCraftIndia Ganesha in Palm Showpiece (6.2", Black & Golden)(Box)'
    );
    assert.equal(data[mrpIdx], "150");
    assert.equal(data[rateIdx], "127.12");
    assert.equal(data[taxIdx], "18");
  });

  it("mergeSkuReportConsignmentWithSnapshot prefers snapshot MRP and demand", () => {
    const merged = mergeSkuReportConsignmentWithSnapshot(
      consignmentItemsToSkuReportRows([
        {
          po_secondary_sku: "10314301",
          company_code_primary: null,
          company_code_secondary: null,
          mrp: 150,
          original_demand: 1099,
          dispatched_quantity: 0,
          consignment_quantity: 0,
          overall_fill_rate: null,
          raw: {
            po_secondary_sku: "10314301",
            mrp: 150,
            rate_without_tax: 127.12,
            tax_rate: 18,
            demand: 1099,
          },
        },
      ]),
      [
        {
          po_secondary_sku: "10314301",
          mrp: 1099,
          landing_rate: 150,
          rate_without_tax: 127.12,
          tax_rate: 18,
          tax_amount: 22.88,
          margin: 86.35,
          total_amount: 5250,
          product_upc: "8906176482287",
          grammage: "1 pc",
          igst_percent: 18,
          demand: 35,
        },
      ]
    );
    const row = merged[0];
    assert.equal(row.mrp, 1099);
    assert.equal(row.demand, 35);
    assert.equal(row.tax_amount, 22.88);
    assert.equal(row.margin, 86.35);
    assert.equal(row.total_amount, 5250);
    assert.equal(row.product_upc, "8906176482287");
    assert.equal(row.grammage, "1 pc");
    assert.equal(row.igst_percent, 18);
  });

  it("buildSkuReportXlsxBuffer exports full vendor commercial columns", () => {
    const lookups: OutboundSkuLookups = {
      companyId: 30044,
      companyCodeBySecondarySku: new Map(),
      eanBySkuKey: new Map(),
      listingSkuByKey: new Map(),
      binStockBySkuId: new Map(),
      labelsMrpBySecondarySku: new Map(),
      labelsMrpByMasterSku: new Map(),
    };
    const po = {
      po_number: "1735810041652",
      company_name: "Blinkit",
      po_issue_date: null,
      expiry_date: null,
      created_at: "2026-01-01",
      po_type: null,
      delivery_city: "Lucknow",
      company_id: 30044,
    } as OutboundPoRow;
    const buffer = buildSkuReportXlsxBuffer(
      [
        {
          po_secondary_sku: "10314301",
          product_upc: "8906176482287",
          grammage: "1 pc",
          rate_without_tax: 127.12,
          cgst_percent: 0,
          sgst_percent: 0,
          igst_percent: 18,
          cess_percent: 0,
          additional_cess: 0,
          tax_amount: 22.88,
          landing_rate: 150,
          demand: 35,
          mrp: 1099,
          margin: 86.35,
          total_amount: 5250,
          tax_rate: 18,
          hsn_code: "39269099",
          packed: 0,
          dispatched: 0,
        },
      ],
      po,
      lookups
    );
    const wb = XLSX.read(buffer, { type: "buffer" });
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets["SKU Report"], {
      header: 1,
    }) as string[][];
    const header = aoa[0] as string[];
    const data = aoa[1] as string[];
    for (const col of [
      "product_upc",
      "grammage",
      "cgst_percent",
      "sgst_percent",
      "igst_percent",
      "cess_percent",
      "additional_cess",
      "tax_amount",
      "landing_rate",
      "margin",
      "total_amount",
    ]) {
      assert.ok(header.includes(col), `missing column ${col}`);
    }
    assert.equal(data[header.indexOf("product_upc")], "8906176482287");
    assert.equal(data[header.indexOf("grammage")], "1 pc");
    assert.equal(data[header.indexOf("tax_amount")], "22.88");
    assert.equal(data[header.indexOf("landing_rate")], "150");
    assert.equal(data[header.indexOf("margin")], "86.35");
    assert.equal(data[header.indexOf("total_amount")], "5250");
    assert.equal(data[header.indexOf("tax_rate")], "18");
  });

  it("computeOutboundTaxAmountPerUnit uses basic cost and effective rate per unit", () => {
    assert.equal(
      computeOutboundTaxAmountPerUnit({
        rate_without_tax: 127.12,
        igst_percent: 18,
      }),
      22.88
    );
    assert.equal(
      computeOutboundTaxAmountPerUnit({
        rate_without_tax: 127.12,
        igst_percent: 18,
        additional_cess: 1.5,
      }),
      24.38
    );
  });

  it("buildSkuReportXlsxBuffer computes tax_amount per unit when missing from snapshot", () => {
    const lookups: OutboundSkuLookups = {
      companyId: 30044,
      companyCodeBySecondarySku: new Map(),
      eanBySkuKey: new Map(),
      listingSkuByKey: new Map(),
      binStockBySkuId: new Map(),
      labelsMrpBySecondarySku: new Map(),
      labelsMrpByMasterSku: new Map(),
    };
    const po = {
      po_number: "1735810041652",
      company_name: "Blinkit",
      po_issue_date: null,
      expiry_date: null,
      created_at: "2026-01-01",
      po_type: null,
      delivery_city: "Lucknow",
      company_id: 30044,
    } as OutboundPoRow;
    const buffer = buildSkuReportXlsxBuffer(
      [
        {
          po_secondary_sku: "10314301",
          rate_without_tax: 127.12,
          igst_percent: 18,
          demand: 35,
          mrp: 1099,
          landing_rate: 150,
          packed: 0,
          dispatched: 0,
        },
      ],
      po,
      lookups
    );
    const aoa = XLSX.utils.sheet_to_json(
      XLSX.read(buffer, { type: "buffer" }).Sheets["SKU Report"],
      { header: 1 }
    ) as string[][];
    const header = aoa[0] as string[];
    const data = aoa[1] as string[];
    assert.equal(data[header.indexOf("tax_amount")], "22.88");
    assert.equal(data[header.indexOf("tax_rate")], "18");
    assert.notEqual(data[header.indexOf("tax_amount")], "800.86");
  });

  it("buildSkuReportXlsxBuffer resolves landing-like MRP from labels secondary sku", () => {
    const lookups: OutboundSkuLookups = {
      companyId: 30044,
      companyCodeBySecondarySku: new Map(),
      eanBySkuKey: new Map(),
      listingSkuByKey: new Map(),
      binStockBySkuId: new Map(),
      labelsMrpBySecondarySku: new Map([["10314301", 1099]]),
      labelsMrpByMasterSku: new Map(),
    };
    const po = {
      po_number: "1735810041652",
      company_name: "Blinkit",
      po_issue_date: null,
      expiry_date: null,
      created_at: "2026-01-01",
      po_type: null,
      delivery_city: "Lucknow",
      company_id: 30044,
    } as OutboundPoRow;
    const buffer = buildSkuReportXlsxBuffer(
      [
        {
          po_secondary_sku: "10314301",
          mrp: 150,
          landing_rate: 150,
          rate_without_tax: 127.12,
          tax_rate: 18,
          demand: 35,
          packed: 0,
          dispatched: 0,
        },
      ],
      po,
      lookups
    );
    const wb = XLSX.read(buffer, { type: "buffer" });
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets["SKU Report"], {
      header: 1,
    }) as string[][];
    const mrpIdx = (aoa[0] as string[]).indexOf("mrp");
    assert.equal(aoa[1][mrpIdx], "1099");
    const resolved = resolveOutboundListingMrp(
      {
        po_secondary_sku: "10314301",
        mrp: 150,
        landing_rate: 150,
        rate_without_tax: 127.12,
        tax_rate: 18,
      },
      { lookups }
    );
    assert.equal(resolved.mrp, 1099);
    assert.equal(resolved.source, "labels_secondary");
  });
});
