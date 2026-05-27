import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildBoxWiseViewRows,
  buildDefaultViewRows,
  buildPoWiseViewRows,
  buildSkuWiseViewRows,
  buildViewCsv,
  type ConsignmentLineItemFlatRow,
} from "../../src/lib/outbound-consignment-line-views";

function flatRow(
  partial: Partial<ConsignmentLineItemFlatRow> & Pick<ConsignmentLineItemFlatRow, "id" | "box_number">
): ConsignmentLineItemFlatRow {
  return {
    po_secondary_sku: "SKU-A",
    company_code_primary: "CCP-1",
    company_code_secondary: "CCS-1",
    box_quantity: 10,
    box_name: "BOX-1",
    submitted_from: "APP",
    created_by: "ops@test",
    mrp: 999,
    original_demand: 50,
    dispatched_quantity: 0,
    consignment_quantity: 10,
    overall_fill_rate: 100,
    created_at: "27 May 2026, 02:22 pm",
    updated_at: "27 May 2026, 02:22 pm",
    ...partial,
  };
}

describe("outbound-consignment-line-views", () => {
  const sample: ConsignmentLineItemFlatRow[] = [
    flatRow({ id: 1, box_number: 1, po_secondary_sku: "MSGSH502", company_code_primary: "77619", box_quantity: 30 }),
    flatRow({ id: 2, box_number: 2, po_secondary_sku: "MSGSH502", company_code_primary: "77619", box_quantity: 18 }),
    flatRow({ id: 3, box_number: 3, po_secondary_sku: "MSGB527W1", company_code_primary: "510088", box_quantity: 16 }),
    flatRow({ id: 4, box_number: 3, po_secondary_sku: "MSGB527W1", company_code_primary: "510088", box_quantity: 4 }),
    flatRow({ id: 5, box_number: 4, po_secondary_sku: "MSGB527W1", company_code_primary: "510088", box_quantity: 25 }),
  ];

  it("buildDefaultViewRows assigns serial numbers", () => {
    const rows = buildDefaultViewRows(sample);
    assert.equal(rows.length, 5);
    assert.equal(rows[0]?.sr_no, 1);
    assert.equal(rows[4]?.sr_no, 5);
    assert.equal(rows[0]?.po_secondary_sku, "MSGSH502");
  });

  it("buildBoxWiseViewRows aggregates by box", () => {
    const rows = buildBoxWiseViewRows(sample);
    assert.equal(rows.length, 4);
    const box3 = rows.find((r) => r.box_number === 3);
    assert.equal(box3?.total_box_quantity, 20);
    assert.ok(String(box3?.po_secondary_skus_in_box).includes("MSGB527W1"));
  });

  it("buildSkuWiseViewRows sums quantity and lists boxes", () => {
    const rows = buildSkuWiseViewRows(sample);
    assert.equal(rows.length, 2);
    const sku = rows.find((r) => r.po_secondary_sku === "MSGSH502");
    assert.equal(sku?.total_quantity, 48);
    assert.equal(sku?.box_numbers, "1, 2");
  });

  it("buildPoWiseViewRows includes fill rate", () => {
    const rows = buildPoWiseViewRows(sample);
    assert.equal(rows.length, 2);
    const sku = rows.find((r) => r.po_secondary_sku === "MSGB527W1");
    assert.equal(sku?.consignment_quantity, 45);
    assert.equal(sku?.overall_fill_rate_pct, 100);
  });

  it("buildViewCsv includes header row", () => {
    const rows = buildSkuWiseViewRows(sample);
    const csv = buildViewCsv("sku", rows);
    assert.ok(csv.startsWith("PO Secondary SKU,Company Code Primary"));
    assert.ok(csv.includes("MSGSH502"));
  });
});
