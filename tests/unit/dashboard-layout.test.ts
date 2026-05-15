import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  DASHBOARD_CARD_IDS,
  DEFAULT_LAYOUT_V2,
  defaultPositionFor,
  migrateLayout,
} from "../../src/lib/dashboard-card-ids";
import { encodeLayout, decodeLayout } from "../../src/lib/share-layout";

test("migrateLayout returns DEFAULT_LAYOUT_V2 for null/garbage input", () => {
  assert.deepEqual(migrateLayout(null), DEFAULT_LAYOUT_V2);
  assert.deepEqual(migrateLayout("not an object"), DEFAULT_LAYOUT_V2);
  assert.deepEqual(migrateLayout({}), DEFAULT_LAYOUT_V2);
});

test("migrateLayout converts v1 visible_cards → v2 hidden flags", () => {
  const v1 = { visible_cards: ["sales_qty", "trends"] as const };
  const v2 = migrateLayout(v1);
  assert.equal(v2.version, 2);
  assert.equal(v2.cards.length, DASHBOARD_CARD_IDS.length);
  const sales = v2.cards.find((c) => c.id === "sales_qty");
  const trends = v2.cards.find((c) => c.id === "trends");
  const fillRate = v2.cards.find((c) => c.id === "fill_rate_pct");
  assert.equal(sales?.hidden, false);
  assert.equal(trends?.hidden, false);
  assert.equal(fillRate?.hidden, true); // not in v1 visible_cards → hidden
});

test("migrateLayout drops unknown card IDs from v1", () => {
  const v1 = {
    visible_cards: ["sales_qty", "evil_unknown_card"] as never,
  };
  const v2 = migrateLayout(v1);
  // Every output card has a known ID.
  for (const card of v2.cards) {
    assert.ok((DASHBOARD_CARD_IDS as readonly string[]).includes(card.id));
  }
});

test("migrateLayout passes a v2 layout through, sanitizing positions", () => {
  const v2In = {
    version: 2,
    cards: [
      { id: "sales_qty", pos: { x: -5, y: 0, w: 0, h: 2 }, hidden: true },
      { id: "trends", chart_type: "bar" },
    ],
    default_company_id: 30046,
  };
  const out = migrateLayout(v2In);
  const sales = out.cards.find((c) => c.id === "sales_qty");
  const trends = out.cards.find((c) => c.id === "trends");
  assert.equal(sales?.hidden, true);
  // Negative x clamps to 0; w<1 clamps to 1.
  assert.equal(sales?.pos?.x, 0);
  assert.equal(sales?.pos?.w, 1);
  assert.equal(trends?.chart_type, "bar");
  assert.equal(out.default_company_id, 30046);
});

test("migrateLayout drops unknown chart_type values", () => {
  const v2In = {
    version: 2,
    cards: [{ id: "trends", chart_type: "pie-of-doom" }],
  };
  const out = migrateLayout(v2In);
  const trends = out.cards.find((c) => c.id === "trends");
  assert.equal(trends?.chart_type, undefined);
});

test("encodeLayout / decodeLayout round-trip a layout exactly", () => {
  const layout = {
    ...DEFAULT_LAYOUT_V2,
    cards: DEFAULT_LAYOUT_V2.cards.map((c) =>
      c.id === "trends"
        ? { ...c, chart_type: "bar" as const, pos: { x: 0, y: 0, w: 12, h: 6 } }
        : c
    ),
    default_company_id: 30048,
  };
  const encoded = encodeLayout(layout);
  assert.equal(typeof encoded, "string");
  // URL-safe alphabet only: alnum, -, _.
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  const decoded = decodeLayout(encoded);
  assert.ok(decoded);
  assert.equal(decoded?.version, 2);
  assert.equal(decoded?.default_company_id, 30048);
  const trends = decoded?.cards.find((c) => c.id === "trends");
  assert.equal(trends?.chart_type, "bar");
  assert.deepEqual(trends?.pos, { x: 0, y: 0, w: 12, h: 6 });
});

test("decodeLayout returns null when the payload is not valid JSON", () => {
  // base64-encoded "not json" — decodes successfully but JSON.parse throws.
  const notJson = Buffer.from("hello, world", "utf8").toString("base64url");
  assert.equal(decodeLayout(notJson), null);
  assert.equal(decodeLayout(""), null);
});

test("defaultPositionFor returns a fresh object each call", () => {
  const a = defaultPositionFor("sales_qty");
  const b = defaultPositionFor("sales_qty");
  assert.notEqual(a, b);
  assert.deepEqual(a, b);
});

test("SKU-movement + business cards are registered with default positions", () => {
  const NEW_IDS = [
    "gmv_value_30d",
    "sku_velocity_buckets",
    "sku_movement",
    "stockout_risk",
    "dead_stock",
  ] as const;
  for (const id of NEW_IDS) {
    assert.ok(
      (DASHBOARD_CARD_IDS as readonly string[]).includes(id),
      `${id} missing from DASHBOARD_CARD_IDS`
    );
    const pos = defaultPositionFor(id);
    assert.ok(pos.w >= 1 && pos.h >= 1, `${id} should have a non-zero default position`);
  }
});
