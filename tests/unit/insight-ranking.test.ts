import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildInsightKey } from "@/lib/insightKey";
import { rankInsights } from "@/lib/insightRanking";
import { DEFAULT_INSIGHT_CONFIG } from "@/lib/insightTypes";

describe("buildInsightKey", () => {
  it("includes rule and entity", () => {
    const key = buildInsightKey({
      rule: "stockout_risk",
      entity: { type: "SKU", id: "ABC123" },
    });
    assert.equal(key, "stockout_risk|SKU:ABC123");
  });
});

describe("rankInsights", () => {
  it("sorts by priority and suppresses dismissed keys", () => {
    const ranked = rankInsights(
      [
        {
          rule: "dead_stock",
          domain: "INVENTORY",
          severity: "INFO",
          title: "Dead",
          rationale: "r",
          recommended_action: "a",
          impact_value: 100,
          entity: { type: "SKU", id: "A" },
        },
        {
          rule: "stockout_risk",
          domain: "INVENTORY",
          severity: "CRITICAL",
          title: "Stockout",
          rationale: "r",
          recommended_action: "a",
          impact_value: 1000,
          entity: { type: "SKU", id: "B" },
        },
      ],
      DEFAULT_INSIGHT_CONFIG,
      [{ insight_key: "dead_stock|SKU:A", action: "DISMISSED", snooze_until: null }]
    );
    assert.equal(ranked.length, 1);
    assert.equal(ranked[0].insight_key, "stockout_risk|SKU:B");
    assert.ok(ranked[0].priority > 0);
  });
});
