import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeWorkingCapitalSummary,
  resolveUnitCost,
} from "@/lib/workingCapital";

describe("workingCapital", () => {
  it("prefers GRN received price over bulk price", () => {
    assert.equal(resolveUnitCost(120, 80), 120);
    assert.equal(resolveUnitCost(null, 80), 80);
  });

  it("aggregates capital tied and DIO", () => {
    const summary = computeWorkingCapitalSummary({
      rows: [
        {
          sku_id: "A",
          description: "Item A",
          on_hand_qty: 10,
          unit_cost: 100,
          is_dead_stock: false,
        },
        {
          sku_id: "B",
          description: "Item B",
          on_hand_qty: 5,
          unit_cost: 50,
          is_dead_stock: true,
        },
      ],
      sold_30d_total: 300,
    });
    assert.equal(summary.total_capital_tied, 1250);
    assert.equal(summary.dead_stock_capital, 250);
    assert.ok(summary.dio_days != null && summary.dio_days > 0);
  });
});
