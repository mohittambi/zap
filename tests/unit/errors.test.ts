import { describe, it } from "node:test";
import assert from "node:assert";
import { AppError, handleApiError } from "../../src/server/errors";

describe("AppError", () => {
  it("sets statusCode and message", () => {
    const err = new AppError("msg", 404);
    assert.strictEqual(err.message, "msg");
    assert.strictEqual(err.statusCode, 404);
    assert.strictEqual(err.code, undefined);
  });

  it("accepts optional code", () => {
    const err = new AppError("msg", 400, "VALIDATION");
    assert.strictEqual(err.code, "VALIDATION");
  });
});

describe("handleApiError", () => {
  it("maps AppError to JSON response", async () => {
    const res = handleApiError(new AppError("Not found", 404));
    assert.strictEqual(res.status, 404);
    const j = (await res.json()) as { error: string };
    assert.strictEqual(j.error, "Not found");
  });

  it("returns 500 for unknown error", async () => {
    const orig = console.error;
    console.error = () => {};
    const res = handleApiError(new Error("boom"));
    console.error = orig;
    assert.strictEqual(res.status, 500);
    const j = (await res.json()) as { error: string };
    assert.strictEqual(j.error, "Internal server error");
  });
});
