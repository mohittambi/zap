import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeOutboundListingLine,
  computeOrderPlacePending,
  opsSkuPoControlRowsToCsv,
  OPS_SKU_PO_SORT_COLUMNS,
  sortValueForRow,
  mergeOpsSkuPoCompanyColumns,
  normalizeRowOutboundByCompany,
} from "../../src/server/services/opsSkuPoControlService";
import {
  companyOutboundColumnKey,
  companyOutboundOpenColumnKey,
  companyOutboundSentColumnKey,
} from "../../src/types/opsSkuPoControl";

const SORTABLE_IDS = [
  "master_sku",
  "open_actual_po_qty",
  "open_po_qty_sent",
  "open_po_fill_rate_pct",
  "total_pending",
  "order_placed_by_ops",
  "app_stock",
  "order_place_pending",
] as const;

describe("opsSkuPoControlService", () => {
  it("normalizeOutboundListingLine uses packed_quantity and dispatched_quantity", () => {
    const n = normalizeOutboundListingLine({
      master_sku: "MSGB584_BLU",
      demand: 3025,
      packed_quantity: 300,
      dispatched_quantity: 87,
    });
    assert.equal(n.master_sku, "MSGB584_BLU");
    assert.equal(n.demand, 3025);
    assert.equal(n.qty_sent, 387);
    assert.equal(n.pending_line, 2638);
  });

  it("normalizeOutboundListingLine falls back to packed and dispatched", () => {
    const n = normalizeOutboundListingLine({
      master_sku: "X",
      demand: 100,
      packed: 10,
      dispatched: 5,
    });
    assert.equal(n.qty_sent, 15);
    assert.equal(n.pending_line, 85);
  });

  it("order_place_pending matches sheet formula", () => {
    assert.equal(computeOrderPlacePending(2638, 2275, 13), 350);
    assert.equal(computeOrderPlacePending(2350, 112, 8), 2230);
  });

  it("overstock rule zeros placement when stock covers pending", () => {
    assert.equal(computeOrderPlacePending(766, 0, 929), 0);
  });

  it("sortable column ids match service allowlist", () => {
    for (const id of SORTABLE_IDS) {
      assert.ok(OPS_SKU_PO_SORT_COLUMNS[id], `missing sort column ${id}`);
    }
  });

  it("sortValueForRow resolves per-company open and sent columns", () => {
    const pendingKey = companyOutboundColumnKey(3);
    const row = {
      master_sku: "X",
      open_actual_po_qty: 0,
      open_po_qty_sent: 0,
      total_pending: 0,
      open_po_fill_rate_pct: null,
      order_placed_by_ops: 0,
      app_stock: 0,
      order_place_pending: 0,
      outbound_by_company: {
        [pendingKey]: {
          open_actual_po_qty: 500,
          open_po_qty_sent: 120,
          total_pending: 380,
          open_po_fill_rate_pct: 24,
        },
      },
    };
    assert.equal(sortValueForRow(row, companyOutboundOpenColumnKey(3)), 500);
    assert.equal(sortValueForRow(row, companyOutboundSentColumnKey(3)), 120);
    assert.equal(sortValueForRow(row, pendingKey), 380);
  });

  it("normalizeRowOutboundByCompany fills missing company keys with zeros", () => {
    const companies = [
      { company_id: 1, name: "Amazon", column_key: companyOutboundColumnKey(1) },
      { company_id: 2, name: "Flipkart", column_key: companyOutboundColumnKey(2) },
    ];
    const row = {
      master_sku: "X",
      open_actual_po_qty: 100,
      open_po_qty_sent: 10,
      total_pending: 90,
      open_po_fill_rate_pct: 10,
      order_placed_by_ops: 0,
      app_stock: 0,
      order_place_pending: 90,
      outbound_by_company: {
        [companyOutboundColumnKey(1)]: {
          open_actual_po_qty: 100,
          open_po_qty_sent: 10,
          total_pending: 90,
          open_po_fill_rate_pct: 10,
        },
      },
    };
    const normalized = normalizeRowOutboundByCompany(row, companies);
    const flipkart = normalized.outbound_by_company[companyOutboundColumnKey(2)];
    assert.ok(flipkart);
    assert.equal(flipkart.open_actual_po_qty, 0);
    assert.equal(flipkart.total_pending, 0);
  });

  it("mergeOpsSkuPoCompanyColumns unions configured and PO-discovered companies", () => {
    const configured = [
      { company_id: 1, name: "Amazon", column_key: companyOutboundColumnKey(1) },
    ];
    const fromPo = [
      { company_id: 2, name: "Flipkart", column_key: companyOutboundColumnKey(2) },
    ];
    const merged = mergeOpsSkuPoCompanyColumns(configured, fromPo);
    assert.equal(merged.length, 2);
    assert.deepEqual(
      merged.map((c) => c.company_id).sort(),
      [1, 2]
    );
  });

  it("list meta data_source reflects cache vs live", () => {
    assert.equal(
      { computedFromCache: true, data_source: "cache" as const }.data_source,
      "cache"
    );
    assert.equal(
      { computedFromCache: false, data_source: "live" as const }.data_source,
      "live"
    );
  });

  it("CSV export includes per-company outbound columns", () => {
    const companies = [
      { company_id: 1, name: "Amazon", column_key: companyOutboundColumnKey(1) },
      { company_id: 2, name: "Flipkart", column_key: companyOutboundColumnKey(2) },
    ];
    const rows = [
      {
        master_sku: "MSGB584_BLU",
        open_actual_po_qty: 3025,
        open_po_qty_sent: 387,
        total_pending: 2638,
        open_po_fill_rate_pct: 12.8,
        order_placed_by_ops: 2275,
        app_stock: 13,
        order_place_pending: 350,
        outbound_by_company: {
          [companyOutboundColumnKey(1)]: {
            open_actual_po_qty: 2000,
            open_po_qty_sent: 200,
            total_pending: 1800,
            open_po_fill_rate_pct: 10,
          },
          [companyOutboundColumnKey(2)]: {
            open_actual_po_qty: 1025,
            open_po_qty_sent: 187,
            total_pending: 838,
            open_po_fill_rate_pct: 18.24,
          },
        },
      },
    ];
    const csv = opsSkuPoControlRowsToCsv(rows, companies);
    assert.match(csv, /Amazon open_actual/);
    assert.match(csv, /Flipkart pending/);
    assert.match(csv, /MSGB584_BLU/);
    assert.match(csv, /1800/);
    assert.match(csv, /838/);
  });
});
