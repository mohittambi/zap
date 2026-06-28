import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildWindows,
  resolveSummaryDateRange,
} from "../../src/server/services/homeSummaryService";
import { AppError } from "../../src/server/errors";

const FIXED_NOW = new Date("2026-06-28T12:00:00.000Z");

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

describe("buildWindows", () => {
  it("computes equal-length MoM and YoY windows for a 30-day range", () => {
    const curStart = new Date("2026-05-29T00:00:00.000Z");
    const curEnd = new Date("2026-06-28T00:00:00.000Z");
    const w = buildWindows(curStart, curEnd);

    assert.equal(iso(w.curStart), "2026-05-29");
    assert.equal(iso(w.curEnd), "2026-06-28");
    assert.equal(iso(w.momEnd), "2026-05-29");
    assert.equal(iso(w.momStart), "2026-04-29");
    assert.equal(iso(w.yoyEnd), "2025-06-28");
    assert.equal(iso(w.yoyStart), "2025-05-29");
  });

  it("computes equal-length MoM for a 7-day range", () => {
    const curStart = new Date("2026-06-21T00:00:00.000Z");
    const curEnd = new Date("2026-06-28T00:00:00.000Z");
    const w = buildWindows(curStart, curEnd);

    assert.equal(iso(w.momEnd), "2026-06-21");
    assert.equal(iso(w.momStart), "2026-06-14");
  });

  it("computes equal-length MoM for a 90-day range", () => {
    const curStart = new Date("2026-03-30T00:00:00.000Z");
    const curEnd = new Date("2026-06-28T00:00:00.000Z");
    const w = buildWindows(curStart, curEnd);

    assert.equal(iso(w.momEnd), "2026-03-30");
    assert.equal(iso(w.momStart), "2025-12-30");
  });

  it("computes equal-length MoM for a 365-day range", () => {
    const curStart = new Date("2025-06-28T00:00:00.000Z");
    const curEnd = new Date("2026-06-28T00:00:00.000Z");
    const w = buildWindows(curStart, curEnd);

    assert.equal(iso(w.momEnd), "2025-06-28");
    assert.equal(iso(w.momStart), "2024-06-28");
  });
});

describe("resolveSummaryDateRange", () => {
  it("defaults to trailing 30 days when from/to omitted", () => {
    const { curStart, curEnd } = resolveSummaryDateRange({ now: FIXED_NOW });
    assert.equal(iso(curStart), "2026-05-29");
    assert.equal(iso(curEnd), "2026-06-28");
  });

  it("accepts explicit from/to", () => {
    const { curStart, curEnd } = resolveSummaryDateRange({
      from: "2026-06-01",
      to: "2026-06-15",
      now: FIXED_NOW,
    });
    assert.equal(iso(curStart), "2026-06-01");
    assert.equal(iso(curEnd), "2026-06-15");
  });

  it("rejects from >= to", () => {
    assert.throws(
      () =>
        resolveSummaryDateRange({
          from: "2026-06-15",
          to: "2026-06-01",
          now: FIXED_NOW,
        }),
      (err: unknown) => err instanceof AppError && err.statusCode === 400
    );
  });

  it("rejects span over 365 days", () => {
    assert.throws(
      () =>
        resolveSummaryDateRange({
          from: "2025-01-01",
          to: "2026-06-28",
          now: FIXED_NOW,
        }),
      (err: unknown) =>
        err instanceof AppError &&
        err.statusCode === 400 &&
        String(err.message).includes("365")
    );
  });

  it("rejects malformed dates", () => {
    assert.throws(
      () =>
        resolveSummaryDateRange({
          from: "not-a-date",
          to: "2026-06-28",
          now: FIXED_NOW,
        }),
      (err: unknown) => err instanceof AppError && err.statusCode === 400
    );
  });

  it("rejects future to", () => {
    assert.throws(
      () =>
        resolveSummaryDateRange({
          from: "2026-06-01",
          to: "2026-07-01",
          now: FIXED_NOW,
        }),
      (err: unknown) => err instanceof AppError && err.statusCode === 400
    );
  });

  it("rejects partial range (from only)", () => {
    assert.throws(
      () =>
        resolveSummaryDateRange({
          from: "2026-06-01",
          now: FIXED_NOW,
        }),
      (err: unknown) => err instanceof AppError && err.statusCode === 400
    );
  });
});
