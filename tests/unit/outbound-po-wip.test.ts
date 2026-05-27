import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isOutboundPoWip,
  normalizeOutboundPoWipForStorage,
} from "../../src/lib/outbound-po-wip";

describe("isOutboundPoWip", () => {
  it("accepts Y and YES", () => {
    assert.equal(isOutboundPoWip("Y"), true);
    assert.equal(isOutboundPoWip("y"), true);
    assert.equal(isOutboundPoWip("YES"), true);
    assert.equal(isOutboundPoWip(" yes "), true);
  });

  it("rejects N, NO, null, and empty", () => {
    assert.equal(isOutboundPoWip("N"), false);
    assert.equal(isOutboundPoWip("NO"), false);
    assert.equal(isOutboundPoWip(null), false);
    assert.equal(isOutboundPoWip(""), false);
    assert.equal(isOutboundPoWip(undefined), false);
  });
});

describe("normalizeOutboundPoWipForStorage", () => {
  it("maps YES to Y and NO to N", () => {
    assert.equal(normalizeOutboundPoWipForStorage("YES"), "Y");
    assert.equal(normalizeOutboundPoWipForStorage("Y"), "Y");
    assert.equal(normalizeOutboundPoWipForStorage("NO"), "N");
    assert.equal(normalizeOutboundPoWipForStorage("N"), "N");
  });

  it("returns null for empty or unknown", () => {
    assert.equal(normalizeOutboundPoWipForStorage(null), null);
    assert.equal(normalizeOutboundPoWipForStorage(""), null);
    assert.equal(normalizeOutboundPoWipForStorage("maybe"), null);
  });
});
