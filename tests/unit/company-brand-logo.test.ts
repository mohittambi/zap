import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  faviconUrlForDomain,
  matchBrandKey,
  resolveCompanyLogoUrl,
  BRAND_DOMAINS,
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

  it("prefers favicon over bundled path for known marketplace names", () => {
    assert.equal(
      resolveCompanyLogoUrl("Zepto", null),
      faviconUrlForDomain(BRAND_DOMAINS.zepto)
    );
    assert.equal(
      resolveCompanyLogoUrl("Blinkit", null),
      faviconUrlForDomain(BRAND_DOMAINS.blinkit)
    );
    assert.equal(
      resolveCompanyLogoUrl("Pepperfry", null),
      faviconUrlForDomain(BRAND_DOMAINS.pepperfry)
    );
  });

  it("returns null for unknown company names", () => {
    assert.equal(resolveCompanyLogoUrl("Unknown Brand XYZ", null), null);
  });
});
