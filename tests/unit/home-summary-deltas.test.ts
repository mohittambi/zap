import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  buildWindows,
  computeDelta,
  resolveSummaryDateRange,
} from "../../src/server/services/homeSummaryService";

test("computeDelta returns null when prev is 0", () => {
  assert.equal(computeDelta(100, 0), null);
});

test("computeDelta returns null when prev is null", () => {
  assert.equal(computeDelta(100, null), null);
});

test("computeDelta returns positive percent for growth", () => {
  assert.equal(computeDelta(150, 100), 50);
});

test("computeDelta returns negative percent for decline", () => {
  assert.equal(computeDelta(50, 100), -50);
});

test("computeDelta handles zero current value", () => {
  assert.equal(computeDelta(0, 100), -100);
});

test("computeDelta is exact for integer ratios", () => {
  assert.equal(computeDelta(120, 100), 20);
  assert.equal(computeDelta(80, 100), -20);
});

test("resolveSummaryDateRange defaults to 30-day window", () => {
  const now = new Date("2026-06-28T12:00:00.000Z");
  const { curStart, curEnd } = resolveSummaryDateRange({ now });
  assert.equal(curStart.toISOString().slice(0, 10), "2026-05-29");
  assert.equal(curEnd.toISOString().slice(0, 10), "2026-06-28");
  const w = buildWindows(curStart, curEnd);
  assert.equal(w.momStart.toISOString().slice(0, 10), "2026-04-29");
});
