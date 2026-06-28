import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clientIpFromRequest,
  inferResourceFromPath,
  userAgentFromRequest,
} from "../../src/lib/requestMeta.ts";

describe("requestMeta", () => {
  it("clientIpFromRequest prefers x-forwarded-for", () => {
    const req = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1" },
    });
    assert.equal(clientIpFromRequest(req), "203.0.113.1");
  });

  it("inferResourceFromPath maps app routes", () => {
    assert.equal(inferResourceFromPath("/listings/warehouse"), "listings");
    assert.equal(inferResourceFromPath("/inbound/grns/1"), "inbound");
    assert.equal(inferResourceFromPath("/api/insights/forecast/SKU1"), "insights");
    assert.equal(inferResourceFromPath("/api/admin/users"), "admin");
  });

  it("userAgentFromRequest returns header", () => {
    const req = new Request("http://localhost/", {
      headers: { "user-agent": "TestAgent/1.0" },
    });
    assert.equal(userAgentFromRequest(req), "TestAgent/1.0");
  });
});
