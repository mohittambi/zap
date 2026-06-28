import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addUtcDays,
  computePresetRange,
  defaultSummaryRange,
  detectPreset,
  exclusiveEndFromInclusive,
  inclusiveEndFromExclusive,
  isIsoDay,
} from "../../src/lib/dashboard-date-range";

const FIXED_NOW = new Date("2026-06-28T12:00:00.000Z");

describe("dashboard-date-range", () => {
  it("defaultSummaryRange is trailing 30 days", () => {
    const r = defaultSummaryRange(FIXED_NOW);
    assert.equal(r.from, "2026-05-29");
    assert.equal(r.to, "2026-06-28");
  });

  it("computePresetRange for 7 days", () => {
    const r = computePresetRange(7, FIXED_NOW);
    assert.equal(r.from, "2026-06-21");
    assert.equal(r.to, "2026-06-28");
  });

  it("detectPreset matches known presets", () => {
    const r30 = computePresetRange(30, FIXED_NOW);
    assert.equal(detectPreset(r30.from, r30.to, FIXED_NOW), 30);
    assert.equal(detectPreset("2026-01-01", "2026-02-01", FIXED_NOW), "custom");
  });

  it("inclusive/exclusive end conversion", () => {
    assert.equal(inclusiveEndFromExclusive("2026-06-28"), "2026-06-27");
    assert.equal(exclusiveEndFromInclusive("2026-06-27"), "2026-06-28");
  });

  it("addUtcDays crosses month boundary", () => {
    assert.equal(addUtcDays("2026-06-01", -7), "2026-05-25");
  });

  it("isIsoDay validates format", () => {
    assert.equal(isIsoDay("2026-06-28"), true);
    assert.equal(isIsoDay("06-28-2026"), false);
  });
});
