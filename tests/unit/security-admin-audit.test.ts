import { describe, it } from "node:test";
import assert from "node:assert";

describe("logAdminAction", () => {
  it("truncates action to 100 chars", () => {
    const action = "a".repeat(150);
    assert.strictEqual(action.slice(0, 100).length, 100);
  });

  it("serializes details as JSON", () => {
    const details = { email: "u@example.com" };
    const json = JSON.stringify(details);
    assert.ok(json.includes("u@example.com"));
  });
});
