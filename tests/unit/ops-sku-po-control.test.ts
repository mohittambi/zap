import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeOutboundListingLine,
  computeOrderPlacePending,
  opsSkuPoControlRowsToCsv,
  OPS_SKU_PO_SORT_COLUMNS,
} from "../../src/server/services/opsSkuPoControlService";
import { companyOutboundColumnKey } from "../../src/types/opsSkuPoControl";

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
