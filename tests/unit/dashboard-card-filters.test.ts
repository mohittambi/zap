import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { patchCard } from "../../src/hooks/use-dashboard-prefs";
import {
  DEFAULT_LAYOUT_V2,
  migrateLayout,
  type DashboardLayoutV2,
} from "../../src/lib/dashboard-card-ids";

/**
 * Regression: the dashboard card filter / hide / chart-type controls round-trip
 * through patchCard → JSON → migrateLayout (server stores JSONB and re-runs the
 * same migrator). If clearing filters doesn't survive the round-trip, the UI
 * never resets the "Custom filter" badge.
 */

function findCard(layout: DashboardLayoutV2, id: "sales_qty") {
  const c = layout.cards.find((x) => x.id === id);
  assert.ok(c, `card ${id} not found`);
  return c;
}

function roundTrip(layout: DashboardLayoutV2): DashboardLayoutV2 {
  /** Mirrors what the server does: JSON.stringify drops undefined keys, then
   * migrateLayout reconstructs the canonical shape. */
  return migrateLayout(JSON.parse(JSON.stringify(layout)));
}

describe("patchCard — set / clear filters", () => {
  it("applying a filter writes filters onto the card", () => {
    const next = patchCard(DEFAULT_LAYOUT_V2, "sales_qty", {
      filters: { company_id: 42 },
    });
    const c = findCard(next, "sales_qty");
    assert.deepStrictEqual(c.filters, { company_id: 42 });
  });

  it("clearing filters with `undefined` removes them after round-trip", () => {
    const filtered = patchCard(DEFAULT_LAYOUT_V2, "sales_qty", {
      filters: { company_id: 42 },
    });
    const cleared = patchCard(filtered, "sales_qty", { filters: undefined });

    /** Before round-trip, the key may still be present with undefined value. */
    assert.strictEqual(findCard(cleared, "sales_qty").filters, undefined);

    /** After round-trip (JSON drops undefined keys, migrator re-sanitizes),
     * the card has no filters. The "Custom filter" badge logic relies on this. */
    const round = roundTrip(cleared);
    assert.strictEqual(findCard(round, "sales_qty").filters, undefined);
  });

  it("clearing filters does not affect other card config (chart_type, hidden, pos)", () => {
    const seeded = patchCard(DEFAULT_LAYOUT_V2, "sales_qty", {
      filters: { company_id: 42 },
      chart_type: "sparkline",
      hidden: false,
    });
    const cleared = patchCard(seeded, "sales_qty", { filters: undefined });
    const round = roundTrip(cleared);

    const c = findCard(round, "sales_qty");
    assert.strictEqual(c.filters, undefined);
    assert.strictEqual(c.chart_type, "sparkline");
    assert.strictEqual(c.hidden, false);
    assert.ok(c.pos, "pos should still be set");
  });

  it("clearing filters on one card does not touch other cards", () => {
    const seeded = patchCard(DEFAULT_LAYOUT_V2, "sales_qty", {
      filters: { company_id: 42 },
    });
    const otherWithFilter = patchCard(seeded, "sales_pos", {
      filters: { company_id: 99 },
    });
    const cleared = patchCard(otherWithFilter, "sales_qty", { filters: undefined });
    const round = roundTrip(cleared);

    assert.strictEqual(findCard(round, "sales_qty").filters, undefined);
    assert.deepStrictEqual(
      round.cards.find((x) => x.id === "sales_pos")?.filters,
      { company_id: 99 }
    );
  });

  it("an empty filters object survives sanitization as undefined (avoids stuck badge)", () => {
    /** Defensive check: if a buggy caller writes `{ filters: {} }`, the round-trip
     * collapses it to undefined so the "Custom filter" badge does not falsely show. */
    const seeded = patchCard(DEFAULT_LAYOUT_V2, "sales_qty", {
      filters: {} as never,
    });
    const round = roundTrip(seeded);
    assert.strictEqual(findCard(round, "sales_qty").filters, undefined);
  });

  it("date-range filters survive the round-trip", () => {
    const seeded = patchCard(DEFAULT_LAYOUT_V2, "sales_qty", {
      filters: { date_from: "2026-01-01", date_to: "2026-01-31" },
    });
    const round = roundTrip(seeded);
    assert.deepStrictEqual(findCard(round, "sales_qty").filters, {
      date_from: "2026-01-01",
      date_to: "2026-01-31",
    });
  });

  it("partial clear (saving with one field cleared) keeps remaining fields", () => {
    const seeded = patchCard(DEFAULT_LAYOUT_V2, "sales_qty", {
      filters: { company_id: 42, date_from: "2026-01-01" },
    });
    /** UI calls onSave with the new filter object minus the cleared field. */
    const partial = patchCard(seeded, "sales_qty", {
      filters: { date_from: "2026-01-01" },
    });
    const round = roundTrip(partial);

    assert.deepStrictEqual(findCard(round, "sales_qty").filters, {
      date_from: "2026-01-01",
    });
  });
});
