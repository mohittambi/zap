import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hasVendorInvoiceReadyToClose,
  showCloseGrnHeaderAction,
} from "../../src/lib/inboundGrnCloseUi";
import {
  classifyVendorInvoicePick,
  maxVendorInvoiceBytes,
} from "../../src/lib/inboundVendorInvoiceUi";
import {
  isTerminalAccountsStatus,
  normalizeDcnDecisionStatus,
  normalizeGrnAuditStatusForPatch,
} from "../../src/lib/inboundWorkflowNormalization";

describe("normalizeGrnAuditStatusForPatch", () => {
  it("maps AUDITED to CLOSED", () => {
    assert.strictEqual(normalizeGrnAuditStatusForPatch("AUDITED"), "CLOSED");
    assert.strictEqual(normalizeGrnAuditStatusForPatch("  audited  "), "CLOSED");
  });

  it("preserves other values", () => {
    assert.strictEqual(normalizeGrnAuditStatusForPatch("OPEN"), "OPEN");
    assert.strictEqual(normalizeGrnAuditStatusForPatch("CLOSED"), "CLOSED");
  });

  it("passes through unknown values unchanged", () => {
    assert.strictEqual(normalizeGrnAuditStatusForPatch("PENDING"), "PENDING");
    assert.strictEqual(normalizeGrnAuditStatusForPatch(""), "");
  });
});

describe("normalizeDcnDecisionStatus", () => {
  it("accepts APPROVED / REJECTED", () => {
    assert.strictEqual(normalizeDcnDecisionStatus("approved"), "APPROVED");
    assert.strictEqual(normalizeDcnDecisionStatus("REJECTED"), "REJECTED");
  });

  it("returns null for invalid input", () => {
    assert.strictEqual(normalizeDcnDecisionStatus(""), null);
    assert.strictEqual(normalizeDcnDecisionStatus("MAYBE"), null);
    assert.strictEqual(normalizeDcnDecisionStatus({}), null);
  });
});

describe("isTerminalAccountsStatus", () => {
  it("detects terminal statuses", () => {
    assert.strictEqual(isTerminalAccountsStatus("APPROVED"), true);
    assert.strictEqual(isTerminalAccountsStatus("  rejected  "), true);
  });

  it("returns false for pending / empty", () => {
    assert.strictEqual(isTerminalAccountsStatus(""), false);
    assert.strictEqual(isTerminalAccountsStatus("PENDING"), false);
  });
});

describe("classifyVendorInvoicePick", () => {
  it("allows jpg jpeg pdf", () => {
    assert.strictEqual(classifyVendorInvoicePick("inv.pdf", 100), null);
    assert.strictEqual(classifyVendorInvoicePick("a.JPEG", 10), null);
  });

  it("allows jpg extension", () => {
    assert.strictEqual(classifyVendorInvoicePick("photo.jpg", 100), null);
  });

  it("rejects oversize", () => {
    assert.strictEqual(
      classifyVendorInvoicePick("a.pdf", maxVendorInvoiceBytes() + 1),
      "oversize"
    );
  });

  it("allows file exactly at size cap", () => {
    assert.strictEqual(
      classifyVendorInvoicePick("a.pdf", maxVendorInvoiceBytes()),
      null
    );
  });

  it("rejects bad extension", () => {
    assert.strictEqual(classifyVendorInvoicePick("x.png", 100), "bad_extension");
  });

  it("rejects doc extension", () => {
    assert.strictEqual(classifyVendorInvoicePick("invoice.docx", 100), "bad_extension");
  });
});

describe("inbound GRN close UI helpers", () => {
  it("hasVendorInvoiceReadyToClose", () => {
    assert.strictEqual(
      hasVendorInvoiceReadyToClose({
        existingInvoiceFilesCount: 0,
        stagedInvoiceFilesCount: 0,
      }),
      false
    );
    assert.strictEqual(
      hasVendorInvoiceReadyToClose({
        existingInvoiceFilesCount: 1,
        stagedInvoiceFilesCount: 0,
      }),
      true
    );
    assert.strictEqual(
      hasVendorInvoiceReadyToClose({
        existingInvoiceFilesCount: 0,
        stagedInvoiceFilesCount: 2,
      }),
      true
    );
  });

  it("showCloseGrnHeaderAction", () => {
    assert.strictEqual(showCloseGrnHeaderAction("OPEN"), true);
    assert.strictEqual(showCloseGrnHeaderAction("open"), true);
    assert.strictEqual(showCloseGrnHeaderAction("CLOSED"), false);
    assert.strictEqual(showCloseGrnHeaderAction(null), false);
  });
});
