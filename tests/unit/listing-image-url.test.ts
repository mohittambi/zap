import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  listingImageCandidatesFromRow,
  pickListingImageFromRow,
} from "../../src/lib/listing-image-url";

describe("listing-image-url", () => {
  it("reads nested listing img_hd", () => {
    const row = {
      po_secondary_sku: "MSAH513",
      listing: {
        img_hd: "http://example.com/hd.jpg",
        img_white: "http://example.com/w.jpg",
      },
    };
    assert.equal(pickListingImageFromRow(row), "http://example.com/hd.jpg");
    assert.equal(listingImageCandidatesFromRow(row).length, 2);
  });

  it("reads root-level image fields", () => {
    const row = { img_hd: "https://cdn.example/a.png" };
    assert.equal(pickListingImageFromRow(row), "https://cdn.example/a.png");
  });
});
