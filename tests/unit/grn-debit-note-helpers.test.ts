import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { csvRow, pickNum, pickStr } from "../../src/server/services/grnDebitNoteService.js";

describe("csvRow", () => {
  it("returns plain value unchanged", () => {
    assert.strictEqual(csvRow(["hello", "world"]), "hello,world");
  });

  it("wraps cell in quotes when it contains a comma", () => {
    assert.strictEqual(csvRow(["a,b", "c"]), '"a,b",c');
  });

  it("doubles embedded quotes and wraps cell", () => {
    assert.strictEqual(csvRow(['say "hi"']), '"say ""hi"""');
  });

  it("wraps cell in quotes when it contains a newline", () => {
    const result = csvRow(["line1\nline2"]);
    assert.ok(result.startsWith('"'), "should be quoted");
    assert.ok(result.includes("line1\nline2"), "should preserve newline");
  });

  it("handles numeric cells without quoting", () => {
    assert.strictEqual(csvRow([42, 3.14]), "42,3.14");
  });

  it("handles zero and negative numbers", () => {
    assert.strictEqual(csvRow([0, -5]), "0,-5");
  });
});

describe("pickNum", () => {
  it("returns the numeric value of the first matching key", () => {
    assert.strictEqual(pickNum({ qty: 10, count: 20 }, ["qty"]), 10);
  });

  it("skips missing keys and returns the first match", () => {
    assert.strictEqual(pickNum({ b: 7 }, ["a", "b"]), 7);
  });

  it("returns 0 when no key matches", () => {
    assert.strictEqual(pickNum({ x: 1 }, ["a", "b"]), 0);
  });

  it("parses a string number", () => {
    assert.strictEqual(pickNum({ price: "99.5" }, ["price"]), 99.5);
  });

  it("skips null and empty-string values", () => {
    assert.strictEqual(pickNum({ a: null, b: "" , c: 5 }, ["a", "b", "c"]), 5);
  });

  it("returns 0 for NaN-valued key", () => {
    assert.strictEqual(pickNum({ a: "not-a-number" }, ["a"]), 0);
  });
});

describe("pickStr", () => {
  it("returns the string value of the first matching key", () => {
    assert.strictEqual(pickStr({ name: "  Bolt  " }, ["name"]), "Bolt");
  });

  it("skips missing keys and returns the first match", () => {
    assert.strictEqual(pickStr({ b: "found" }, ["a", "b"]), "found");
  });

  it("returns empty string when no key matches", () => {
    assert.strictEqual(pickStr({ x: "v" }, ["a", "b"]), "");
  });

  it("converts a number value to string", () => {
    assert.strictEqual(pickStr({ id: 42 }, ["id"]), "42");
  });

  it("converts boolean true to string", () => {
    assert.strictEqual(pickStr({ flag: true }, ["flag"]), "true");
  });

  it("skips whitespace-only strings", () => {
    assert.strictEqual(pickStr({ a: "   ", b: "real" }, ["a", "b"]), "real");
  });
});
