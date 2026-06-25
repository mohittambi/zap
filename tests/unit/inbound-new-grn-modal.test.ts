import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyInvoiceBoxCountChange,
  buildPoLinePreviewRows,
  initialNewGrnBoxFieldState,
  mergeActualBoxCountChange,
  pickPoLineOrderedQty,
} from "@/lib/inboundNewGrnModal";

describe("pickPoLineOrderedQty", () => {
  it("reads quantity from common PO line keys", () => {
    assert.equal(pickPoLineOrderedQty({ quantity: 12 }), 12);
    assert.equal(pickPoLineOrderedQty({ required_quantity: "8" }), 8);
    assert.equal(pickPoLineOrderedQty({ listing: { ordered_quantity: 5 } }), 5);
  });

  it("returns null when no quantity key is present", () => {
    assert.equal(pickPoLineOrderedQty({ sku_id: "A" }), null);
    assert.equal(pickPoLineOrderedQty(null), null);
  });
});

describe("applyInvoiceBoxCountChange", () => {
  it("mirrors invoice box count into actual boxes until manually edited", () => {
    const next = applyInvoiceBoxCountChange("4", {
      boxActual: "",
      actualBoxManuallyEdited: false,
    });
    assert.deepEqual(next, {
      boxInvoice: "4",
      boxActual: "4",
      actualBoxManuallyEdited: false,
    });
  });

  it("does not overwrite actual boxes after manual edit", () => {
    const next = applyInvoiceBoxCountChange("6", {
      boxActual: "3",
      actualBoxManuallyEdited: true,
    });
    assert.equal(next.boxInvoice, "6");
    assert.equal(next.boxActual, "3");
    assert.equal(next.actualBoxManuallyEdited, true);
  });
});

describe("mergeActualBoxCountChange", () => {
  it("marks actual boxes as manually edited", () => {
    const next = mergeActualBoxCountChange("2", {
      boxInvoice: "5",
      actualBoxManuallyEdited: false,
    });
    assert.equal(next.boxActual, "2");
    assert.equal(next.actualBoxManuallyEdited, true);
    assert.equal(next.boxInvoice, "5");
  });
});

describe("buildPoLinePreviewRows", () => {
  it("returns preview rows and remaining count", () => {
    const lines = Array.from({ length: 7 }, (_, i) => ({
      line_index: i,
      sku_id: `SKU-${i}`,
      raw: { quantity: i + 1 },
    }));
    const preview = buildPoLinePreviewRows(lines, 5);
    assert.equal(preview.total, 7);
    assert.equal(preview.rows.length, 5);
    assert.equal(preview.remaining, 2);
    assert.equal(preview.rows[0]?.ordered_qty, 1);
  });
});

describe("initialNewGrnBoxFieldState", () => {
  it("starts empty with mirroring enabled", () => {
    assert.deepEqual(initialNewGrnBoxFieldState(), {
      boxInvoice: "",
      boxActual: "",
      actualBoxManuallyEdited: false,
    });
  });
});
