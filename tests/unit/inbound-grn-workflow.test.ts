import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  grnQueueTransitionsForClose,
  grnQueueTransitionsForFieldUpdate,
} from "../../src/lib/inboundGrnWorkflow";

/**
 * Pure transition rules for the GRN pending queues. The service issues SQL
 * based on this output; these tests pin the doctrine #10 forward-flow:
 *   close → audit → invoice_collection → accounts_approval → terminal.
 */

describe("grnQueueTransitionsForClose", () => {
  it("enqueues audit and dequeues nothing", () => {
    assert.deepStrictEqual(grnQueueTransitionsForClose(), {
      enqueue: ["audit"],
      dequeue: [],
    });
  });
});

describe("grnQueueTransitionsForFieldUpdate", () => {
  it("returns no-op delta for an empty patch", () => {
    assert.deepStrictEqual(grnQueueTransitionsForFieldUpdate({}), {
      enqueue: [],
      dequeue: [],
    });
  });

  it("returns no-op delta when fields are explicitly null/undefined", () => {
    assert.deepStrictEqual(
      grnQueueTransitionsForFieldUpdate({
        grn_audit_status: null,
        grn_invoice_collection_status: undefined,
        accounts_status: "",
      }),
      { enqueue: [], dequeue: [] }
    );
  });

  it("audit_status=CLOSED → dequeue audit, enqueue invoice_collection", () => {
    const out = grnQueueTransitionsForFieldUpdate({
      grn_audit_status: "CLOSED",
    });
    assert.deepStrictEqual(out.dequeue, ["audit"]);
    assert.deepStrictEqual(out.enqueue, ["invoice_collection"]);
  });

  it("audit_status accepts AUDITED/DONE/COMPLETED synonyms", () => {
    for (const v of ["AUDITED", "DONE", "COMPLETED"]) {
      const out = grnQueueTransitionsForFieldUpdate({ grn_audit_status: v });
      assert.deepStrictEqual(out.dequeue, ["audit"]);
      assert.deepStrictEqual(out.enqueue, ["invoice_collection"]);
    }
  });

  it("invoice_collection_status=COLLECTED → dequeue invoice_collection, enqueue accounts_approval", () => {
    const out = grnQueueTransitionsForFieldUpdate({
      grn_invoice_collection_status: "COLLECTED",
    });
    assert.deepStrictEqual(out.dequeue, ["invoice_collection"]);
    assert.deepStrictEqual(out.enqueue, ["accounts_approval"]);
  });

  it("accounts_status=APPROVED → dequeue accounts_approval (terminal, no enqueue)", () => {
    const out = grnQueueTransitionsForFieldUpdate({
      accounts_status: "APPROVED",
    });
    assert.deepStrictEqual(out.dequeue, ["accounts_approval"]);
    assert.deepStrictEqual(out.enqueue, []);
  });

  it("accounts_status=REJECTED → dequeue accounts_approval (terminal, no enqueue)", () => {
    const out = grnQueueTransitionsForFieldUpdate({
      accounts_status: "REJECTED",
    });
    assert.deepStrictEqual(out.dequeue, ["accounts_approval"]);
    assert.deepStrictEqual(out.enqueue, []);
  });

  it("status comparison is case-insensitive and trimmed", () => {
    const out = grnQueueTransitionsForFieldUpdate({
      grn_audit_status: "  closed  ",
    });
    assert.deepStrictEqual(out.dequeue, ["audit"]);
    assert.deepStrictEqual(out.enqueue, ["invoice_collection"]);
  });

  it("ignores unrelated status values (e.g. PENDING, OPEN)", () => {
    assert.deepStrictEqual(
      grnQueueTransitionsForFieldUpdate({
        grn_audit_status: "PENDING",
        grn_invoice_collection_status: "PENDING",
        accounts_status: "PENDING",
      }),
      { enqueue: [], dequeue: [] }
    );
  });

  it("merges multiple status changes in a single patch", () => {
    const out = grnQueueTransitionsForFieldUpdate({
      grn_audit_status: "CLOSED",
      grn_invoice_collection_status: "COLLECTED",
      accounts_status: "APPROVED",
    });
    assert.deepStrictEqual(out.dequeue, [
      "audit",
      "invoice_collection",
      "accounts_approval",
    ]);
    assert.deepStrictEqual(out.enqueue, [
      "invoice_collection",
      "accounts_approval",
    ]);
  });
});
