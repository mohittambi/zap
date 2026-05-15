import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyInvoiceFilesPicked,
  closeGrnDisabledHint,
  closeGrnSubmitDisabled,
  closeGrnSubmitLabel,
  hasVendorInvoiceReadyToClose,
  showCloseGrnHeaderAction,
  VENDOR_INVOICE_MAX_FILES,
} from "../../src/lib/inboundGrnCloseUi";

/**
 * Pure helpers backing the Close GRN modal — submit-button state, label
 * derivation, and the file-picker classification step. These rules mirror the
 * server contract (`/api/inbound/grns/{id}/close` requires ≥1 invoice file)
 * so the UI can disable the action before a 4xx round-trip.
 */

describe("hasVendorInvoiceReadyToClose", () => {
  it("returns false when neither existing nor staged files are present", () => {
    assert.strictEqual(
      hasVendorInvoiceReadyToClose({
        existingInvoiceFilesCount: 0,
        stagedInvoiceFilesCount: 0,
      }),
      false
    );
  });

  it("returns true when at least one file is staged in this dialog", () => {
    assert.strictEqual(
      hasVendorInvoiceReadyToClose({
        existingInvoiceFilesCount: 0,
        stagedInvoiceFilesCount: 1,
      }),
      true
    );
  });

  it("returns true when the GRN already has invoices on file (no new staging needed)", () => {
    assert.strictEqual(
      hasVendorInvoiceReadyToClose({
        existingInvoiceFilesCount: 2,
        stagedInvoiceFilesCount: 0,
      }),
      true
    );
  });

  it("returns true when both sources contribute", () => {
    assert.strictEqual(
      hasVendorInvoiceReadyToClose({
        existingInvoiceFilesCount: 1,
        stagedInvoiceFilesCount: 3,
      }),
      true
    );
  });
});

describe("showCloseGrnHeaderAction", () => {
  it("only shows the header action when status is OPEN (case-insensitive, trimmed)", () => {
    assert.strictEqual(showCloseGrnHeaderAction("OPEN"), true);
    assert.strictEqual(showCloseGrnHeaderAction("open"), true);
    assert.strictEqual(showCloseGrnHeaderAction("  OPEN  "), true);
  });

  it("hides the action for any other status", () => {
    assert.strictEqual(showCloseGrnHeaderAction("DRAFT_ZAP"), false);
    assert.strictEqual(showCloseGrnHeaderAction("CLOSED"), false);
    assert.strictEqual(showCloseGrnHeaderAction(null), false);
    assert.strictEqual(showCloseGrnHeaderAction(undefined), false);
    assert.strictEqual(showCloseGrnHeaderAction(""), false);
  });
});

describe("closeGrnSubmitLabel", () => {
  it("idle, no files staged → 'Close GRN'", () => {
    assert.strictEqual(
      closeGrnSubmitLabel({ busy: false, stagedFilesCount: 0 }),
      "Close GRN"
    );
  });

  it("idle, exactly one file staged → singular 'file'", () => {
    assert.strictEqual(
      closeGrnSubmitLabel({ busy: false, stagedFilesCount: 1 }),
      "Upload 1 file & Close GRN"
    );
  });

  it("idle, multiple files staged → plural 'files'", () => {
    assert.strictEqual(
      closeGrnSubmitLabel({ busy: false, stagedFilesCount: 3 }),
      "Upload 3 files & Close GRN"
    );
  });

  it("busy, no files staged → 'Closing…'", () => {
    assert.strictEqual(
      closeGrnSubmitLabel({ busy: true, stagedFilesCount: 0 }),
      "Closing…"
    );
  });

  it("busy with staged files → 'Uploading & Closing…'", () => {
    assert.strictEqual(
      closeGrnSubmitLabel({ busy: true, stagedFilesCount: 2 }),
      "Uploading & Closing…"
    );
  });
});

describe("closeGrnSubmitDisabled", () => {
  it("disabled when busy, regardless of file counts", () => {
    assert.strictEqual(
      closeGrnSubmitDisabled({
        busy: true,
        existingInvoiceFilesCount: 5,
        stagedInvoiceFilesCount: 5,
      }),
      true
    );
  });

  it("disabled when no invoice files (existing or staged) — the user's reported requirement", () => {
    assert.strictEqual(
      closeGrnSubmitDisabled({
        busy: false,
        existingInvoiceFilesCount: 0,
        stagedInvoiceFilesCount: 0,
      }),
      true
    );
  });

  it("enabled when at least one staged file is present", () => {
    assert.strictEqual(
      closeGrnSubmitDisabled({
        busy: false,
        existingInvoiceFilesCount: 0,
        stagedInvoiceFilesCount: 1,
      }),
      false
    );
  });

  it("enabled when the GRN already has invoices on file (no new staging needed)", () => {
    assert.strictEqual(
      closeGrnSubmitDisabled({
        busy: false,
        existingInvoiceFilesCount: 2,
        stagedInvoiceFilesCount: 0,
      }),
      false
    );
  });
});

describe("closeGrnDisabledHint", () => {
  it("returns the helper text when the button is disabled (no files)", () => {
    const hint = closeGrnDisabledHint({
      busy: false,
      existingInvoiceFilesCount: 0,
      stagedInvoiceFilesCount: 0,
    });
    assert.ok(hint && hint.includes("at least one invoice file"));
  });

  it("returns null while busy (UI shows progress label, not a hint)", () => {
    assert.strictEqual(
      closeGrnDisabledHint({
        busy: true,
        existingInvoiceFilesCount: 0,
        stagedInvoiceFilesCount: 0,
      }),
      null
    );
  });

  it("returns null when the button is enabled (no hint needed)", () => {
    assert.strictEqual(
      closeGrnDisabledHint({
        busy: false,
        existingInvoiceFilesCount: 1,
        stagedInvoiceFilesCount: 0,
      }),
      null
    );
    assert.strictEqual(
      closeGrnDisabledHint({
        busy: false,
        existingInvoiceFilesCount: 0,
        stagedInvoiceFilesCount: 2,
      }),
      null
    );
  });
});

describe("classifyInvoiceFilesPicked", () => {
  const file = (name: string, size: number): File =>
    /** node:test runs in Node where File constructor is available; fall back to a
     * minimal duck-typed object if the runtime is older. */
    typeof File !== "undefined"
      ? new File([new Uint8Array(size)], name)
      : ({ name, size } as File);

  const allOk = () => "ok" as const;

  it("returns all files as accepted when validator approves every pick", () => {
    const picks = [file("a.pdf", 100), file("b.pdf", 100)];
    const out = classifyInvoiceFilesPicked(picks, allOk);
    assert.strictEqual(out.accepted.length, 2);
    assert.strictEqual(out.rejected.length, 0);
    assert.strictEqual(out.droppedDueToCap, 0);
  });

  it("partitions files by validator verdict", () => {
    const picks = [
      file("good.pdf", 100),
      file("huge.pdf", 999),
      file("script.exe", 100),
    ];
    const out = classifyInvoiceFilesPicked(picks, (_n, size) => {
      if (size > 500) return "oversize";
      if (_n.endsWith(".exe")) return "bad_extension";
      return "ok";
    });
    assert.strictEqual(out.accepted.length, 1);
    assert.strictEqual(out.accepted[0].name, "good.pdf");
    assert.deepStrictEqual(
      out.rejected.map((r) => [r.file.name, r.reason]),
      [
        ["huge.pdf", "oversize"],
        ["script.exe", "bad_extension"],
      ]
    );
  });

  it("caps the picks at VENDOR_INVOICE_MAX_FILES and reports the drop count", () => {
    const picks = Array.from({ length: VENDOR_INVOICE_MAX_FILES + 3 }, (_, i) =>
      file(`f${i}.pdf`, 100)
    );
    const out = classifyInvoiceFilesPicked(picks, allOk);
    assert.strictEqual(out.accepted.length, VENDOR_INVOICE_MAX_FILES);
    assert.strictEqual(out.droppedDueToCap, 3);
    assert.strictEqual(out.rejected.length, 0);
  });

  it("droppedDueToCap is 0 when picks ≤ cap", () => {
    const picks = [file("only.pdf", 100)];
    const out = classifyInvoiceFilesPicked(picks, allOk);
    assert.strictEqual(out.droppedDueToCap, 0);
    assert.strictEqual(out.accepted.length, 1);
  });

  it("never lets cap-overflow files reach the validator (slice happens first)", () => {
    /** Sentinel: validator throws if called more than VENDOR_INVOICE_MAX_FILES times. */
    let calls = 0;
    const picks = Array.from({ length: VENDOR_INVOICE_MAX_FILES + 5 }, (_, i) =>
      file(`f${i}.pdf`, 100)
    );
    classifyInvoiceFilesPicked(picks, () => {
      calls += 1;
      return "ok";
    });
    assert.strictEqual(calls, VENDOR_INVOICE_MAX_FILES);
  });
});

describe("VENDOR_INVOICE_MAX_FILES", () => {
  it("is a positive integer (sanity guard against accidental zero/negative)", () => {
    assert.ok(Number.isInteger(VENDOR_INVOICE_MAX_FILES));
    assert.ok(VENDOR_INVOICE_MAX_FILES >= 1);
  });
});
