import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SKU_ID_RE,
  ListingCreateError,
  buildCreateListingDefaults,
  isBulkRowEmpty,
  mapBulkRowToCreateListingInput,
  validateCreateListingInput,
} from "../../src/lib/listingCreate";

describe("validateCreateListingInput", () => {
  it("accepts minimal valid input", () => {
    const out = validateCreateListingInput({
      sku_id: "ZAP-MYSKU-001",
      description: "Test product",
    });
    assert.strictEqual(out.sku_id, "ZAP-MYSKU-001");
    assert.strictEqual(out.description, "Test product");
  });

  it("trims sku_id and description", () => {
    const out = validateCreateListingInput({
      sku_id: "  ABC123  ",
      description: "  Widget  ",
    });
    assert.strictEqual(out.sku_id, "ABC123");
    assert.strictEqual(out.description, "Widget");
  });

  it("rejects missing sku_id", () => {
    assert.throws(
      () => validateCreateListingInput({ description: "x" }),
      (e: unknown) =>
        e instanceof ListingCreateError && e.message === "sku_id is required"
    );
  });

  it("rejects invalid sku_id characters", () => {
    assert.throws(
      () =>
        validateCreateListingInput({
          sku_id: "bad sku!",
          description: "x",
        }),
      (e: unknown) => e instanceof ListingCreateError
    );
    assert.strictEqual(SKU_ID_RE.test("bad sku!"), false);
  });

  it("rejects sku_id longer than 100 chars", () => {
    const longSku = "A".repeat(101);
    assert.throws(
      () =>
        validateCreateListingInput({
          sku_id: longSku,
          description: "x",
        }),
      (e: unknown) => e instanceof ListingCreateError
    );
  });

  it("rejects missing description", () => {
    assert.throws(
      () => validateCreateListingInput({ sku_id: "ABC" }),
      (e: unknown) =>
        e instanceof ListingCreateError && e.message === "description is required"
    );
  });

  it("rejects description over 500 chars", () => {
    assert.throws(
      () =>
        validateCreateListingInput({
          sku_id: "ABC",
          description: "x".repeat(501),
        }),
      (e: unknown) =>
        e instanceof ListingCreateError &&
        e.message === "description must be at most 500 characters"
    );
  });

  it("rejects invalid sku_type", () => {
    assert.throws(
      () =>
        validateCreateListingInput({
          sku_id: "ABC",
          description: "x",
          sku_type: "BUNDLE",
        }),
      (e: unknown) => e instanceof ListingCreateError
    );
  });

  it("accepts optional classification and pricing fields", () => {
    const out = validateCreateListingInput({
      sku_id: "ABC",
      description: "Widget",
      category: "Tools",
      sku_type: "PACK",
      ops_tag: "SM",
      inventory_bypass_on: "YES",
      bulk_price: 99.5,
      actual_weight: 1.2,
      dimension: "10x10 cm",
      no_of_constituents: 3,
      img_hd: "https://example.com/img.jpg",
    });
    assert.strictEqual(out.sku_type, "PACK");
    assert.strictEqual(out.inventory_bypass_on, "YES");
    assert.strictEqual(out.bulk_price, 99.5);
    assert.strictEqual(out.no_of_constituents, 3);
    assert.strictEqual(out.img_hd, "https://example.com/img.jpg");
  });

  it("rejects negative bulk_price", () => {
    assert.throws(
      () =>
        validateCreateListingInput({
          sku_id: "ABC",
          description: "x",
          bulk_price: -1,
        }),
      (e: unknown) =>
        e instanceof ListingCreateError &&
        e.message === "bulk_price must be a non-negative number"
    );
  });

  it("rejects invalid img_hd URL", () => {
    assert.throws(
      () =>
        validateCreateListingInput({
          sku_id: "ABC",
          description: "x",
          img_hd: "not-a-url",
        }),
      (e: unknown) =>
        e instanceof ListingCreateError &&
        e.message === "img_hd must be a valid URL"
    );
  });

  it("accepts all five image URL fields", () => {
    const out = validateCreateListingInput({
      sku_id: "ABC",
      description: "x",
      img_hd: "https://example.com/hd.jpg",
      img_white: "https://example.com/white.jpg",
      img_wdim: "https://example.com/wdim.jpg",
      img_link1: "https://example.com/1.jpg",
      img_link2: "https://example.com/2.jpg",
    });
    assert.strictEqual(out.img_hd, "https://example.com/hd.jpg");
    assert.strictEqual(out.img_white, "https://example.com/white.jpg");
    assert.strictEqual(out.img_wdim, "https://example.com/wdim.jpg");
    assert.strictEqual(out.img_link1, "https://example.com/1.jpg");
    assert.strictEqual(out.img_link2, "https://example.com/2.jpg");
  });

  it("rejects invalid img_white URL", () => {
    assert.throws(
      () =>
        validateCreateListingInput({
          sku_id: "ABC",
          description: "x",
          img_white: "ftp://bad",
        }),
      (e: unknown) => e instanceof ListingCreateError
    );
  });
});

describe("buildCreateListingDefaults", () => {
  it("fills standard defaults for a new listing", () => {
    const input = validateCreateListingInput({
      sku_id: "ZAP-001",
      description: "Test",
    });
    const defaults = buildCreateListingDefaults(input);
    assert.strictEqual(defaults.master_sku, "ZAP-001");
    assert.strictEqual(defaults.inventory_sku_id, "ZAP-001");
    assert.strictEqual(defaults.pack_combo_sku_id, "NA");
    assert.strictEqual(defaults.sku_type, "SINGLE");
    assert.strictEqual(defaults.inventory_bypass_on, "NO");
    assert.strictEqual(defaults.no_of_constituents, 1);
    assert.strictEqual(defaults.available_quantity, 0);
    assert.strictEqual(defaults.source, "zap");
  });

  it("respects explicit sku_type and inventory_bypass_on", () => {
    const input = validateCreateListingInput({
      sku_id: "ZAP-002",
      description: "Pack item",
      sku_type: "COMBO",
      inventory_bypass_on: "YES",
      no_of_constituents: 4,
    });
    const defaults = buildCreateListingDefaults(input);
    assert.strictEqual(defaults.sku_type, "COMBO");
    assert.strictEqual(defaults.inventory_bypass_on, "YES");
    assert.strictEqual(defaults.no_of_constituents, 4);
  });
});

describe("mapBulkRowToCreateListingInput", () => {
  it("maps snake_case CSV headers", () => {
    const mapped = mapBulkRowToCreateListingInput({
      sku_id: "ZAP-001",
      description: "Widget",
      category: "Tools",
      img_hd: "https://example.com/a.jpg",
    });
    assert.strictEqual(mapped.sku_id, "ZAP-001");
    assert.strictEqual(mapped.description, "Widget");
    assert.strictEqual(mapped.category, "Tools");
    assert.strictEqual(mapped.img_hd, "https://example.com/a.jpg");
  });

  it("maps legacy spreadsheet headers", () => {
    const mapped = mapBulkRowToCreateListingInput({
      "SKU ID": "LEG-001",
      Description: "Legacy row",
      "SKU Type": "PACK",
      "Bulk Price": 99,
    });
    assert.strictEqual(mapped.sku_id, "LEG-001");
    assert.strictEqual(mapped.description, "Legacy row");
    assert.strictEqual(mapped.sku_type, "PACK");
    assert.strictEqual(mapped.bulk_price, 99);
  });
});

describe("isBulkRowEmpty", () => {
  it("treats blank rows as empty", () => {
    assert.strictEqual(isBulkRowEmpty({}), true);
    assert.strictEqual(isBulkRowEmpty({ sku_id: "", description: "" }), true);
  });

  it("detects non-empty rows", () => {
    assert.strictEqual(isBulkRowEmpty({ sku_id: "A", description: "x" }), false);
  });
});
