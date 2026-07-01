import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeListingsWithConsignmentPacked,
  patchListingsEnvelopeContent,
  poSecondarySkuFromListingRow,
  rollupPackedIntoSnapshotRows,
} from "../../src/server/services/outboundConsignmentPoLineItemsService.ts";

describe("mergeListingsWithConsignmentPacked", () => {
  const snapshotRows = [
    {
      po_secondary_sku: "10149864",
      master_sku: "MSGB584_BLU",
      demand: 100,
      dispatched_quantity: 0,
    },
    {
      po_secondary_sku: "10146920",
      master_sku: "MSGB527W1",
      demand: 51,
      dispatched_quantity: 0,
    },
  ];

  it("overlays packed qty for this consignment", () => {
    const merged = mergeListingsWithConsignmentPacked(snapshotRows, [
      {
        po_secondary_sku: "10149864",
        company_code_primary: "MSGB584_BLU",
        packed: 100,
        demand_hint: 100,
      },
      {
        po_secondary_sku: "10146920",
        company_code_primary: "MSGB527W1",
        packed: 51,
        demand_hint: 51,
      },
    ]);
    assert.equal(merged.length, 2);
    assert.equal(merged[0]?.packed_quantity, 100);
    assert.equal(merged[0]?.pending_quantity, 0);
    assert.equal(merged[1]?.packed_quantity, 51);
    assert.equal(merged[1]?.pending_quantity, 0);
  });

  it("leaves packed 0 when no consignment items", () => {
    const merged = mergeListingsWithConsignmentPacked(snapshotRows, []);
    assert.equal(merged[0]?.packed_quantity, 0);
    assert.equal(merged[0]?.pending_quantity, 100);
  });

  it("appends SKU only on consignment", () => {
    const merged = mergeListingsWithConsignmentPacked(snapshotRows, [
      {
        po_secondary_sku: "99999999",
        company_code_primary: "EXTRA",
        packed: 5,
        demand_hint: 10,
      },
    ]);
    assert.equal(merged.length, 3);
    const extra = merged.find((r) => r.po_secondary_sku === "99999999");
    assert.equal(extra?.packed_quantity, 5);
    assert.equal(extra?.pending_quantity, 5);
  });
});

describe("rollupPackedIntoSnapshotRows", () => {
  it("sums packed across consignments for PO snapshot", () => {
    const rows = [
      { po_secondary_sku: "10149864", demand: 100, dispatched_quantity: 0 },
    ];
    const totals = new Map([["10149864", 75]]);
    const patched = rollupPackedIntoSnapshotRows(rows, totals);
    assert.equal(patched[0]?.packed_quantity, 75);
    assert.equal(patched[0]?.pending_quantity, 25);
  });
});

describe("patchListingsEnvelopeContent", () => {
  it("preserves envelope metadata", () => {
    const out = patchListingsEnvelopeContent(
      { content: [], total: 99, current_page: 2 },
      [{ po_secondary_sku: "A" }]
    );
    assert.equal((out.content as unknown[]).length, 1);
    assert.equal(out.total, 99);
    assert.equal(out.current_page, 2);
    assert.equal(out.curr_page_count, 1);
  });
});

describe("poSecondarySkuFromListingRow", () => {
  it("reads po_secondary_sku", () => {
    assert.equal(poSecondarySkuFromListingRow({ po_secondary_sku: "10149864" }), "10149864");
  });
});
