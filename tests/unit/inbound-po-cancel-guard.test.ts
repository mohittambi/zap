import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canCancelPo,
  poCancelBlockReason,
} from "@/lib/inboundPoCancelGuard";

describe("inboundPoCancelGuard", () => {
  it("allows cancel when no GRNs", () => {
    assert.equal(canCancelPo([], false), true);
    assert.equal(poCancelBlockReason([]), null);
  });

  it("blocks when GRN is CLOSED", () => {
    const block = poCancelBlockReason([
      { grn_id: 10000000007, raw: { grn_status: "CLOSED" } },
    ]);
    assert.ok(block);
    assert.match(block!.reason, /CLOSED/i);
  });

  it("blocks when GRN is OPEN", () => {
    const block = poCancelBlockReason([
      { grn_id: 99, raw: { grn_status: "OPEN" } },
    ]);
    assert.ok(block);
  });

  it("allows DRAFT_ZAP with zero receipt activity", () => {
    assert.equal(
      poCancelBlockReason([
        { grn_id: 10000000001, raw: { grn_status: "DRAFT_ZAP" } },
      ]),
      null
    );
  });

  it("blocks when receipt quantities recorded on draft", () => {
    const block = poCancelBlockReason([
      {
        grn_id: 1,
        raw: { grn_status: "DRAFT_ZAP", grn_accepted_quantity: 5 },
      },
    ]);
    assert.ok(block);
  });

  it("disallows when zap already cancelled", () => {
    assert.equal(canCancelPo([], true), false);
  });
});
