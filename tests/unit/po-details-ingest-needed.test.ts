import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { poDetailsIngestNeededFromCounts } from "../../src/server/services/eautomatePoDetailsIngestService";

describe("poDetailsIngestNeededFromCounts", () => {
  it("skips zap-source POs", () => {
    const r = poDetailsIngestNeededFromCounts("zap", 4, false, 0);
    assert.equal(r.needed, false);
    assert.match(r.reason, /zap-source/);
  });

  it("needs ingest when eAutomate PO has no snapshot", () => {
    const r = poDetailsIngestNeededFromCounts("eautomate", 4, false, 0);
    assert.equal(r.needed, true);
    assert.match(r.reason, /snapshot/);
  });

  it("needs ingest when snapshot exists but lines missing and sku_count > 0", () => {
    const r = poDetailsIngestNeededFromCounts("eautomate", 4, true, 0);
    assert.equal(r.needed, true);
    assert.match(r.reason, /lines/);
  });

  it("does not need ingest when snapshot and lines present", () => {
    const r = poDetailsIngestNeededFromCounts("eautomate", 4, true, 4);
    assert.equal(r.needed, false);
  });

  it("does not require lines when header sku_count is 0", () => {
    const r = poDetailsIngestNeededFromCounts("eautomate", 0, true, 0);
    assert.equal(r.needed, false);
  });
});
