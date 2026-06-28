import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifySkusAbcXyz } from "@/lib/abcXyzClassification";

describe("classifySkusAbcXyz", () => {
  it("assigns A to top value SKUs", () => {
    const rows = classifySkusAbcXyz([
      { sku_id: "A", value_30d: 800, demand_series: [10, 11, 10, 9] },
      { sku_id: "B", value_30d: 150, demand_series: [2, 3, 2, 4] },
      { sku_id: "C", value_30d: 50, demand_series: [0, 1, 0, 2] },
    ]);
    assert.equal(rows[0].abc, "A");
    assert.equal(rows[0].sku_id, "A");
    assert.ok(rows[0].policy.length > 0);
  });
});
