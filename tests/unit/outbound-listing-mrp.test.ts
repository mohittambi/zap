import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPlausibleRetailMrpVsLanding,
  mrpLooksLikeLandingRate,
} from "../../src/server/utils/outboundListingNormalize";
import { resolveOutboundListingMrp } from "../../src/server/services/outboundPurchaseOrdersService";
import type { OutboundSkuLookups } from "../../src/server/services/eanMappingsService";
import { loadPo1735810041652Fixture } from "./outbound-po-document-spreadsheet.test";
import { parseOutboundPoLineItemsSpreadsheet } from "../../src/server/utils/outboundPoListingSpreadsheetParse";
import { normalizeOutboundListingRow } from "../../src/server/utils/outboundListingNormalize";

describe("resolveOutboundListingMrp", () => {
  it("uses retail MRP from vendor spreadsheet when landing rate is separate", () => {
    const buf = loadPo1735810041652Fixture();
    const { content } = parseOutboundPoLineItemsSpreadsheet(buf, "po-1735810041652.xlsx");
    const row = content.find((r) => String(r.po_secondary_sku) === "10314301");
    assert.ok(row);
    const normalized = normalizeOutboundListingRow(row).row;
    const resolved = resolveOutboundListingMrp(normalized, { rawRow: row });
    assert.equal(resolved.mrp, 1099);
    assert.equal(resolved.source, "po_spreadsheet");
    assert.equal(resolved.issues.length, 0);
  });

  it("does not flag mrp=1099 with landing_rate=150 as landing rate", () => {
    assert.equal(
      mrpLooksLikeLandingRate({
        mrp: 1099,
        landing_rate: 150,
        rate_without_tax: 127.12,
        tax_rate: 18,
      }),
      false
    );
    assert.equal(
      isPlausibleRetailMrpVsLanding({
        mrp: 1099,
        landing_rate: 150,
      }),
      true
    );
  });

  it("flags mrp=150 as landing rate for corrupted row", () => {
    assert.equal(
      mrpLooksLikeLandingRate({
        mrp: 150,
        rate_without_tax: 127.12,
        tax_rate: 18,
      }),
      true
    );
  });

  it("replaces corrupted mrp from labels_master by secondary sku", () => {
    const lookups: OutboundSkuLookups = {
      companyId: 30044,
      companyCodeBySecondarySku: new Map(),
      eanBySkuKey: new Map(),
      listingSkuByKey: new Map(),
      binStockBySkuId: new Map(),
      labelsMrpBySecondarySku: new Map([["10314301", 1099]]),
      labelsMrpByMasterSku: new Map(),
    };
    const row = normalizeOutboundListingRow({
      po_secondary_sku: "10314301",
      mrp: 150,
      rate_without_tax: 127.12,
      tax_rate: 18,
    }).row;
    const resolved = resolveOutboundListingMrp(row, { lookups });
    assert.equal(resolved.mrp, 1099);
    assert.equal(resolved.source, "labels_secondary");
  });

  it("returns unresolved with actionable issue when no labels master", () => {
    const row = normalizeOutboundListingRow({
      po_secondary_sku: "10314301",
      mrp: 150,
      rate_without_tax: 127.12,
      tax_rate: 18,
    }).row;
    const resolved = resolveOutboundListingMrp(row, {
      lookups: {
        companyId: null,
        companyCodeBySecondarySku: new Map(),
        eanBySkuKey: new Map(),
        listingSkuByKey: new Map(),
        binStockBySkuId: new Map(),
        labelsMrpBySecondarySku: new Map(),
        labelsMrpByMasterSku: new Map(),
      },
    });
    assert.equal(resolved.mrp, 150);
    assert.equal(resolved.source, "unresolved");
    assert.ok(resolved.issues.some((i) => i.includes("Original PO documents")));
  });
});
