import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { forecastDemand } from "@/lib/demandForecast";
import { computeReorderRecommendation } from "@/lib/safetyStockEoq";

describe("demandForecast", () => {
  it("returns forecast for stable series", () => {
    const series = [10, 11, 10, 12, 11, 10, 11, 10, 12, 11];
    const result = forecastDemand(series, 3);
    assert.equal(result.forecast.length, 3);
    assert.ok(result.forecast.every((v) => v >= 0));
  });
});

describe("safetyStockEoq", () => {
  it("computes reorder recommendation", () => {
    const rec = computeReorderRecommendation({
      avgDailyDemand: 10,
      demandStdDevDaily: 2,
      leadTimeDays: 7,
      onHand: 20,
      orderingCost: 500,
      unitCost: 100,
      holdingCostPct: 0.2,
    });
    assert.ok(rec.safety_stock >= 0);
    assert.ok(rec.reorder_point > 0);
    assert.ok(rec.suggested_order_qty >= 0);
  });
});
