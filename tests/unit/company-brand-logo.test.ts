import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  localBrandLogoPath,
  matchBrandKey,
  resolveCompanyLogoUrl,
} from "../../src/lib/company-brand-logo";

describe("company-brand-logo", () => {
  it("matches known marketplace names", () => {
    assert.equal(matchBrandKey("Amazon Etrade - RK World"), "amazon");
    assert.equal(matchBrandKey("Blinkit"), "blinkit");
    assert.equal(matchBrandKey("Flipkart Grocery"), "flipkart");
    assert.equal(matchBrandKey("More Retail"), "more");
  });

  it("prefers DB logo_url", () => {
    assert.equal(
      resolveCompanyLogoUrl("Blinkit", "/custom/logo.png"),
      "/custom/logo.png"
    );
  });

  it("resolves bundled path for unknown DB but known name", () => {
    assert.equal(
      resolveCompanyLogoUrl("Zepto", null),
      localBrandLogoPath("zepto")
    );
  });

  it("resolves local path for Pepperfry", () => {
    assert.equal(
      resolveCompanyLogoUrl("Pepperfry", null),
      localBrandLogoPath("pepperfry")
    );
  });
});
