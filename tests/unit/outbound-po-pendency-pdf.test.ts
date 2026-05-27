import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPendencyRowsFromListings,
  pendencySkuIdCandidates,
  resolvePendencyRowFields,
  type PendencyLookups,
} from "../../src/server/utils/outboundPoPendencyPdf";

function emptyLookups(companyId: number | null = null): PendencyLookups {
  return {
    companyId,
    companyCodeBySecondarySku: new Map(),
    binStockBySkuId: new Map(),
  };
}

describe("outboundPoPendencyPdf", () => {
  it("pendencySkuIdCandidates prefers inventory_sku_id then master_sku then po_secondary_sku", () => {
    const ids = pendencySkuIdCandidates({
      po_secondary_sku: "10149864",
      master_sku: "AAC500",
      inventory_sku_id: "INV-1",
      listing: { master_sku: "LIST-MSKU" },
    });
    assert.deepEqual(ids, ["INV-1", "AAC500", "10149864"]);
  });

  it("pendencySkuIdCandidates skips NA and listing duplicates", () => {
    const ids = pendencySkuIdCandidates({
      po_secondary_sku: "NA",
      master_sku: "MSKU",
      inventory_sku_id: "NA",
      listing: { inventory_sku_id: "MSKU", master_sku: "MSKU" },
    });
    assert.deepEqual(ids, ["MSKU"]);
  });

  it("resolvePendencyRowFields uses top-level company_code_primary", () => {
    const fields = resolvePendencyRowFields(
      { company_code_primary: "CODE-A", po_secondary_sku: "SKU1" },
      emptyLookups(30044)
    );
    assert.equal(fields.company_code_primary, "CODE-A");
  });

  it("resolvePendencyRowFields falls back to company_secondary_sku map", () => {
    const lookups = emptyLookups(30044);
    lookups.companyCodeBySecondarySku.set("SKU1", "CODE-DB");
    const fields = resolvePendencyRowFields(
      { po_secondary_sku: "SKU1" },
      lookups
    );
    assert.equal(fields.company_code_primary, "CODE-DB");
  });

  it("resolvePendencyRowFields falls back to master_sku when company code sources missing", () => {
    const fields = resolvePendencyRowFields(
      { po_secondary_sku: "10149864", master_sku: "MASTER-ABC" },
      emptyLookups()
    );
    assert.equal(fields.company_code_primary, "MASTER-ABC");
  });

  it("resolvePendencyRowFields falls back to listing.master_sku before po_secondary_sku", () => {
    const fields = resolvePendencyRowFields(
      {
        po_secondary_sku: "10149864",
        listing: { master_sku: "MASTER-LISTING" },
      },
      emptyLookups()
    );
    assert.equal(fields.company_code_primary, "MASTER-LISTING");
  });

  it("resolvePendencyRowFields falls back to po_secondary_sku when master sku missing", () => {
    const fields = resolvePendencyRowFields(
      { po_secondary_sku: "10149864" },
      emptyLookups()
    );
    assert.equal(fields.company_code_primary, "10149864");
  });

  it("resolvePendencyRowFields prefers company code over sku fallbacks", () => {
    const fields = resolvePendencyRowFields(
      {
        company_code_primary: "REAL-CODE",
        master_sku: "MASTER-ABC",
        po_secondary_sku: "10149864",
      },
      emptyLookups()
    );
    assert.equal(fields.company_code_primary, "REAL-CODE");
  });

  it("resolvePendencyRowFields falls back to secondary_sku_company_details for PO company", () => {
    const fields = resolvePendencyRowFields(
      {
        po_secondary_sku: "SKU1",
        secondary_sku_company_details: [
          { company_id: 99, company_code_primary: "OTHER" },
          { company_id: 30044, company_code_primary: "CODE-SNAP" },
        ],
      },
      emptyLookups(30044)
    );
    assert.equal(fields.company_code_primary, "CODE-SNAP");
  });

  it("resolvePendencyRowFields uses bin stock for first matching sku candidate", () => {
    const lookups = emptyLookups();
    lookups.binStockBySkuId.set("INV-1", 42);
    lookups.binStockBySkuId.set("MSKU", 99);
    const fields = resolvePendencyRowFields(
      {
        po_secondary_sku: "10149864",
        master_sku: "MSKU",
        inventory_sku_id: "INV-1",
      },
      lookups
    );
    assert.equal(fields.warehouse_quantity, 42);
  });

  it("resolvePendencyRowFields accepts zero bin stock", () => {
    const lookups = emptyLookups();
    lookups.binStockBySkuId.set("MSKU", 0);
    const fields = resolvePendencyRowFields(
      { master_sku: "MSKU", po_secondary_sku: "SKU1" },
      lookups
    );
    assert.equal(fields.warehouse_quantity, 0);
  });

  it("resolvePendencyRowFields leaves warehouse_quantity null when no bin match", () => {
    const fields = resolvePendencyRowFields(
      { master_sku: "UNKNOWN", po_secondary_sku: "SKU1" },
      emptyLookups()
    );
    assert.equal(fields.warehouse_quantity, null);
  });

  it("buildPendencyRowsFromListings computes pending from demand packed dispatched", () => {
    const rows = buildPendencyRowsFromListings(
      [
        {
          po_secondary_sku: "SKU1",
          demand: 100,
          packed: 10,
          dispatched: 20,
        },
      ],
      emptyLookups()
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].pending, 70);
    assert.equal(rows[0].po_secondary_sku, "SKU1");
  });

  it("buildPendencyRowsFromListings respects explicit pending", () => {
    const rows = buildPendencyRowsFromListings(
      [{ po_secondary_sku: "SKU1", demand: 100, pending: 5 }],
      emptyLookups()
    );
    assert.equal(rows[0].pending, 5);
  });

  it("buildPendencyRowsFromListings merges lookups into output rows", () => {
    const lookups = emptyLookups(30044);
    lookups.companyCodeBySecondarySku.set("SKU1", "CCP-1");
    lookups.binStockBySkuId.set("MSKU", 250);
    const rows = buildPendencyRowsFromListings(
      [
        {
          po_secondary_sku: "SKU1",
          master_sku: "MSKU",
          mrp: 2999,
        },
      ],
      lookups
    );
    assert.equal(rows[0].company_code_primary, "CCP-1");
    assert.equal(rows[0].warehouse_quantity, 250);
    assert.equal(rows[0].mrp, 2999);
  });
});
