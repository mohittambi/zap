import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isOutboundPoAcknowledged } from "../../src/lib/outbound-po-acknowledgement";

describe("isOutboundPoAcknowledged", () => {
  it("accepts YES, Y, ACK, and ACKNOWLEDGED", () => {
    assert.equal(isOutboundPoAcknowledged("YES"), true);
    assert.equal(isOutboundPoAcknowledged("y"), true);
    assert.equal(isOutboundPoAcknowledged("ACK"), true);
    assert.equal(isOutboundPoAcknowledged("  ACKNOWLEDGED  "), true);
  });

  it("rejects pending and empty values", () => {
    assert.equal(isOutboundPoAcknowledged("PENDING"), false);
    assert.equal(isOutboundPoAcknowledged("NO"), false);
    assert.equal(isOutboundPoAcknowledged("UNACK"), false);
    assert.equal(isOutboundPoAcknowledged(null), false);
    assert.equal(isOutboundPoAcknowledged(""), false);
  });
});
