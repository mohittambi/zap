import { describe, it } from "node:test";
import assert from "node:assert";
import { AppError } from "../../src/server/errors";
import {
  assertBlobSize,
  assertFileSize,
  assertFileType,
  assertInvoiceLikeFile,
} from "../../src/server/lib/uploadGuards";

function makeFile(name: string, size: number, type = ""): File {
  const buf = new Uint8Array(size);
  return new File([buf], name, { type });
}

describe("assertFileSize", () => {
  it("throws for oversized file", () => {
    const f = makeFile("big.pdf", 100);
    assert.throws(
      () => assertFileSize(f, 50),
      (e: unknown) => e instanceof AppError && e.statusCode === 400
    );
  });
});

describe("assertBlobSize", () => {
  it("throws for oversized blob", () => {
    const b = new Blob([new Uint8Array(100)]);
    assert.throws(() => assertBlobSize(b, 50));
  });
});

describe("assertFileType", () => {
  it("rejects disallowed extension", () => {
    const f = makeFile("evil.exe", 10);
    assert.throws(() =>
      assertFileType(f, ["pdf", "jpg"], ["application/pdf"])
    );
  });

  it("accepts allowed extension", () => {
    const f = makeFile("doc.pdf", 10, "application/pdf");
    assert.doesNotThrow(() =>
      assertFileType(f, ["pdf"], ["application/pdf"])
    );
  });
});

describe("assertInvoiceLikeFile", () => {
  it("accepts jpeg invoice", () => {
    const f = makeFile("inv.jpg", 100, "image/jpeg");
    assert.doesNotThrow(() => assertInvoiceLikeFile(f, 1024));
  });
});
