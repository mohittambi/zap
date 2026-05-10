import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isoOrNull,
  rowToHeader,
  toNullableNumber,
  toNumberOrZero,
} from "../../src/server/services/eautomatePoDetailsIngestService";

describe("isoOrNull", () => {
  it("returns null for null and undefined", () => {
    assert.strictEqual(isoOrNull(null), null);
    assert.strictEqual(isoOrNull(undefined), null);
  });

  it("converts Date instances to ISO strings", () => {
    const d = new Date("2026-05-09T12:34:56.000Z");
    assert.strictEqual(isoOrNull(d), "2026-05-09T12:34:56.000Z");
  });

  it("passes strings through unchanged", () => {
    assert.strictEqual(isoOrNull("2026-05-09"), "2026-05-09");
  });

  it("returns null for non-Date, non-string values", () => {
    assert.strictEqual(isoOrNull(123), null);
    assert.strictEqual(isoOrNull({}), null);
    assert.strictEqual(isoOrNull([]), null);
  });
});

describe("toNullableNumber", () => {
  it("returns null for null, undefined, and empty string", () => {
    assert.strictEqual(toNullableNumber(null), null);
    assert.strictEqual(toNullableNumber(undefined), null);
    assert.strictEqual(toNullableNumber(""), null);
  });

  it("coerces numeric strings (pg returns BIGINT as string)", () => {
    assert.strictEqual(toNullableNumber("12302"), 12302);
    assert.strictEqual(toNullableNumber("0"), 0);
  });

  it("returns the number for numeric inputs", () => {
    assert.strictEqual(toNullableNumber(42), 42);
    assert.strictEqual(toNullableNumber(3.14), 3.14);
  });

  it("returns null for non-numeric strings", () => {
    assert.strictEqual(toNullableNumber("not-a-number"), null);
    assert.strictEqual(toNullableNumber("12abc"), null);
  });

  it("returns null for NaN and Infinity", () => {
    assert.strictEqual(toNullableNumber(Number.NaN), null);
    assert.strictEqual(toNullableNumber(Infinity), null);
  });
});

describe("toNumberOrZero", () => {
  it("returns zero for nullish or empty values", () => {
    assert.strictEqual(toNumberOrZero(null), 0);
    assert.strictEqual(toNumberOrZero(undefined), 0);
    assert.strictEqual(toNumberOrZero(""), 0);
  });

  it("returns the parsed number for valid values", () => {
    assert.strictEqual(toNumberOrZero("100"), 100);
    assert.strictEqual(toNumberOrZero(50), 50);
  });

  it("returns zero for non-numeric strings", () => {
    assert.strictEqual(toNumberOrZero("abc"), 0);
  });
});

describe("rowToHeader", () => {
  /** Mirrors the JOIN row in getPoDetailsBundle, with pg's typical BIGINT-as-string output. */
  const rawRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    po_id: "16719",
    vendor_id: "12302",
    vendor_name: "VK Creation",
    vendor_city: "Bengaluru",
    vendor_state: "Karnataka",
    expected_date: new Date("2026-05-15T00:00:00.000Z"),
    status: "PENDING",
    po_remarks: "first batch",
    created_by: "ops@example.com",
    modified_by: "ops@example.com",
    created_at: new Date("2026-05-09T08:30:00.000Z"),
    updated_at: new Date("2026-05-09T08:30:00.000Z"),
    date_published: null,
    sku_count: "5",
    total_quantity: "120",
    number_of_grns: "0",
    total_invoice_quantity: "0",
    total_accepted_quantity: "0",
    total_rejected_quantity: "0",
    sku_fill_rate: "0",
    quantity_fill_rate: "0",
    ...overrides,
  });

  it("coerces po_id and vendor_id from BIGINT-as-string to numbers", () => {
    const h = rowToHeader(rawRow());
    assert.strictEqual(h.po_id, 16719);
    assert.strictEqual(h.vendor_id, 12302);
    assert.strictEqual(typeof h.po_id, "number");
    assert.strictEqual(typeof h.vendor_id, "number");
  });

  it("preserves vendor name from the joined vendors row (not the snapshot)", () => {
    const h = rowToHeader(rawRow({ vendor_name: "VK Creation" }));
    assert.strictEqual(h.vendor_name, "VK Creation");
  });

  it("propagates null vendor location fields", () => {
    const h = rowToHeader(rawRow({ vendor_city: null, vendor_state: null }));
    assert.strictEqual(h.vendor_city, null);
    assert.strictEqual(h.vendor_state, null);
  });

  it("formats Date columns as ISO strings", () => {
    const h = rowToHeader(rawRow());
    assert.strictEqual(h.created_at, "2026-05-09T08:30:00.000Z");
    assert.strictEqual(h.expected_date, "2026-05-15T00:00:00.000Z");
  });

  it("returns null for missing date_published", () => {
    const h = rowToHeader(rawRow({ date_published: null }));
    assert.strictEqual(h.date_published, null);
  });

  it("coerces all numeric columns to numbers, defaulting to 0", () => {
    const h = rowToHeader(rawRow());
    for (const key of [
      "sku_count",
      "total_quantity",
      "number_of_grns",
      "total_invoice_quantity",
      "total_accepted_quantity",
      "total_rejected_quantity",
      "sku_fill_rate",
      "quantity_fill_rate",
    ] as const) {
      assert.strictEqual(typeof h[key], "number", `${key} should be number`);
    }
  });

  it("defaults numeric columns to 0 when null in the row", () => {
    const h = rowToHeader(
      rawRow({
        sku_count: null,
        total_quantity: null,
        sku_fill_rate: null,
      })
    );
    assert.strictEqual(h.sku_count, 0);
    assert.strictEqual(h.total_quantity, 0);
    assert.strictEqual(h.sku_fill_rate, 0);
  });

  it("treats string-typed status and remarks transparently", () => {
    const h = rowToHeader(
      rawRow({ status: "PUBLISHED", po_remarks: "delivered" })
    );
    assert.strictEqual(h.status, "PUBLISHED");
    assert.strictEqual(h.po_remarks, "delivered");
  });

  it("returns null for missing po_remarks", () => {
    const h = rowToHeader(rawRow({ po_remarks: null }));
    assert.strictEqual(h.po_remarks, null);
  });

  it("regression: vendor_name comes from the row, never overridden by snapshot vendor_id", () => {
    /** This is the exact bug the fix addresses: vendor_id 12302 in eAutomate may be ROUXIE,
     *  but zap's vendors row for 12302 is VK Creation. The header MUST report VK Creation. */
    const h = rowToHeader(
      rawRow({ vendor_id: "12302", vendor_name: "VK Creation" })
    );
    assert.strictEqual(h.vendor_id, 12302);
    assert.strictEqual(h.vendor_name, "VK Creation");
    assert.notStrictEqual(h.vendor_name, "ROUXIE (SMART SHOP)");
  });

  it("source defaults to 'eautomate' when missing or unrecognised", () => {
    assert.strictEqual(rowToHeader(rawRow()).source, "eautomate");
    assert.strictEqual(rowToHeader(rawRow({ source: undefined })).source, "eautomate");
    assert.strictEqual(rowToHeader(rawRow({ source: "garbage" })).source, "eautomate");
  });

  it("source is 'zap' when the column is set to 'zap' (zap-created PO)", () => {
    assert.strictEqual(rowToHeader(rawRow({ source: "zap" })).source, "zap");
  });
});
