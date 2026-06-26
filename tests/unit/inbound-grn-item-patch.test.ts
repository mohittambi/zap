import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GrnItemPatchError,
  mergeGrnItemPatchIntoRaw,
} from "../../src/lib/inboundGrnItemPatch";

describe("mergeGrnItemPatchIntoRaw", () => {
  const existing = {
    sku_id: "SKU1",
    invoice_quantity: 50,
    accepted_quantity: 38,
    rejected_quantity: 10,
    shortage_quantity: 2,
    received_price: 50,
    tax_rate: 18,
  };

  it("merges audit_price only without requiring quantity fields", () => {
    const merged = mergeGrnItemPatchIntoRaw(existing, { audit_price: 42 });
    assert.strictEqual(merged.audit_price, 42);
    assert.strictEqual(merged.invoice_quantity, 50);
    assert.strictEqual(merged.accepted_quantity, 38);
    assert.strictEqual(merged.received_price, 50);
  });

  it("applies full body PATCH with quantity validation", () => {
    const merged = mergeGrnItemPatchIntoRaw(existing, {
      invoice_quantity: 50,
      accepted_quantity: 40,
      rejected_quantity: 8,
      shortage_quantity: 2,
      received_price: 50,
      tax_rate: 18,
      audit_price: 45,
    });
    assert.strictEqual(merged.accepted_quantity, 40);
    assert.strictEqual(merged.audit_price, 45);
  });

  it("rejects empty body", () => {
    assert.throws(
      () => mergeGrnItemPatchIntoRaw(existing, {}),
      (e: unknown) =>
        e instanceof GrnItemPatchError && e.message === "No fields to update"
    );
  });

  it("rejects quantity sum mismatch when qty fields are patched", () => {
    assert.throws(
      () =>
        mergeGrnItemPatchIntoRaw(existing, {
          invoice_quantity: 50,
          accepted_quantity: 40,
          rejected_quantity: 8,
          shortage_quantity: 5,
        }),
      (e: unknown) => e instanceof GrnItemPatchError
    );
  });

  it("clears audit_price when null or empty string", () => {
    const withAudit = { ...existing, audit_price: 40 };
    const mergedNull = mergeGrnItemPatchIntoRaw(withAudit, { audit_price: null });
    assert.strictEqual(mergedNull.audit_price, undefined);
    const mergedEmpty = mergeGrnItemPatchIntoRaw(withAudit, { audit_price: "" });
    assert.strictEqual(mergedEmpty.audit_price, undefined);
  });

  it("defaults omitted qty fields from existing raw keys", () => {
    const merged = mergeGrnItemPatchIntoRaw(
      { acceptedQuantity: 100, receivedPrice: 48, taxRate: 5 },
      { audit_price: 40 }
    );
    assert.strictEqual(merged.audit_price, 40);
    assert.strictEqual(merged.acceptedQuantity, 100);
    assert.strictEqual(merged.receivedPrice, 48);
    assert.strictEqual(merged.taxRate, 5);
  });
});
