import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPublicStorageUrl,
  inferExtension,
  isExternalImageUrl,
  isZapStoragePublicUrl,
  listingImageObjectPath,
  sanitizeStorageSegment,
  slotToObjectBasename,
} from "../../scripts/lib/listingImageStorage.mjs";

const BASE = "https://abc.supabase.co";

describe("listingImageStorage pure helpers", () => {
  it("slotToObjectBasename maps columns", () => {
    assert.equal(slotToObjectBasename("img_hd"), "hd");
    assert.equal(slotToObjectBasename("img_link2"), "alt2");
  });

  it("sanitizeStorageSegment removes path chars", () => {
    assert.equal(sanitizeStorageSegment("a/b"), "a_b");
  });

  it("buildPublicStorageUrl", () => {
    const u = buildPublicStorageUrl(BASE, "listing-images", "SKU/hd.jpg");
    assert.equal(u, "https://abc.supabase.co/storage/v1/object/public/listing-images/SKU/hd.jpg");
  });

  it("isZapStoragePublicUrl", () => {
    const u = `${BASE}/storage/v1/object/public/listing-images/X/hd.jpg`;
    assert.equal(isZapStoragePublicUrl(u, BASE), true);
    assert.equal(isZapStoragePublicUrl("https://cdn.ecraftindia.com/x.jpg", BASE), false);
  });

  it("isExternalImageUrl", () => {
    assert.equal(
      isExternalImageUrl("https://cdn.ecraftindia.com/x.jpg", BASE),
      true
    );
    assert.equal(
      isExternalImageUrl(`${BASE}/storage/v1/object/public/listing-images/X/hd.jpg`, BASE),
      false
    );
    assert.equal(isExternalImageUrl("", BASE), false);
  });

  it("inferExtension from content-type and url", () => {
    assert.equal(inferExtension("http://x/y", "image/png"), ".png");
    assert.equal(inferExtension("http://x/y.webp", ""), ".webp");
    assert.equal(inferExtension("http://x/y", ""), ".jpg");
  });

  it("listingImageObjectPath", () => {
    assert.equal(
      listingImageObjectPath("SKU_1", "img_hd", ".jpg"),
      "SKU_1/hd.jpg"
    );
  });
});
