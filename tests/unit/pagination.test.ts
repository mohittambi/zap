import { describe, it } from "node:test";
import assert from "node:assert";
import { parsePagination } from "../../src/server/validators/pagination";

describe("parsePagination", () => {
  it("returns defaults for empty query", () => {
    const out = parsePagination({});
    assert.strictEqual(out.page, 1);
    assert.strictEqual(out.limit, 100);
    assert.strictEqual(out.offset, 0);
  });

  it("uses page and limit from query", () => {
    const out = parsePagination({ page: "2", limit: "50" });
    assert.strictEqual(out.page, 2);
    assert.strictEqual(out.limit, 50);
    assert.strictEqual(out.offset, 50);
  });

  it("uses count as alias for limit", () => {
    const out = parsePagination({ count: "25" });
    assert.strictEqual(out.limit, 25);
  });

  it("clamps page to 1", () => {
    assert.strictEqual(parsePagination({ page: "0" }).page, 1);
    assert.strictEqual(parsePagination({ page: "-1" }).page, 1);
  });

  it("caps limit by maxLimit", () => {
    const out = parsePagination(
      { limit: "999" },
      { page: 1, limit: 100, maxLimit: 200 }
    );
    assert.strictEqual(out.limit, 200);
  });
});
