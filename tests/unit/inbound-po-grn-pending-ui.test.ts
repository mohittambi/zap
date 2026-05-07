import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildInboundPurchaseOrdersQuery,
  buildPendingGrnsListQuery,
  displayPoStatus,
  expiryTone,
  formatExpiryDateDisplay,
  formatInboundListDateTime,
  inboundPaginatedTotalPages,
  inboundPoRowsToCsv,
  parseExpectedDateOnly,
  statusToneClass,
} from "../../src/lib/inboundPoGrnPendingUi";

describe("buildInboundPurchaseOrdersQuery", () => {
  it("includes page, count, and search keyword", () => {
    const q = buildInboundPurchaseOrdersQuery({
      page: 2,
      count: 50,
      searchKeyword: "acme",
    });
    assert.ok(q.includes("page=2"));
    assert.ok(q.includes("count=50"));
    assert.ok(q.includes("search_keyword=acme"));
  });

  it("sorts vendor_ids for stable URLs", () => {
    const q = buildInboundPurchaseOrdersQuery({
      page: 1,
      count: 50,
      searchKeyword: "",
      vendorIds: [30, 5, 12],
    });
    const params = new URLSearchParams(q);
    assert.strictEqual(params.get("vendor_ids"), "5,12,30");
  });

  it("omits vendor_ids when empty", () => {
    const q = buildInboundPurchaseOrdersQuery({
      page: 1,
      count: 50,
      searchKeyword: "x",
      vendorIds: [],
    });
    assert.ok(!q.includes("vendor_ids"));
  });

  it("sets po_id_filter when poIdFilter is non-whitespace", () => {
    const q = buildInboundPurchaseOrdersQuery({
      page: 1,
      count: 50,
      searchKeyword: "",
      poIdFilter: "  PO-9 ",
    });
    assert.ok(q.includes("po_id_filter"));
    assert.ok(q.includes("PO-9"));
  });

  it("omits po_id_filter when filter is blank", () => {
    const q = buildInboundPurchaseOrdersQuery({
      page: 1,
      count: 50,
      searchKeyword: "",
      poIdFilter: "   ",
    });
    assert.ok(!q.includes("po_id_filter"));
  });
});

describe("buildPendingGrnsListQuery", () => {
  it("matches pending GRN list param shape", () => {
    const q = buildPendingGrnsListQuery({
      page: 3,
      count: 100,
      searchKeyword: "inv-1",
    });
    assert.ok(q.startsWith("page=3") || q.includes("page=3"));
    assert.ok(q.includes("count=100"));
    assert.ok(q.includes("search_keyword=inv-1"));
  });
});

describe("inboundPaginatedTotalPages", () => {
  it("returns 1 when total is zero", () => {
    assert.strictEqual(inboundPaginatedTotalPages(0, 50), 1);
  });

  it("ceil-divides when total is positive", () => {
    assert.strictEqual(inboundPaginatedTotalPages(250, 100), 3);
    assert.strictEqual(inboundPaginatedTotalPages(200, 100), 2);
    assert.strictEqual(inboundPaginatedTotalPages(1, 100), 1);
  });

  it("returns 1 when per page is zero (defensive)", () => {
    assert.strictEqual(inboundPaginatedTotalPages(100, 0), 1);
  });
});

describe("displayPoStatus (inbound PO list)", () => {
  it("maps known backend statuses to labels", () => {
    assert.strictEqual(displayPoStatus(null), "—");
    assert.strictEqual(displayPoStatus("PENDING_PUBLISHED"), "Published");
    assert.strictEqual(displayPoStatus("MARKED_CANCELLED"), "Cancelled");
    assert.strictEqual(displayPoStatus("MARKED_MODIFICATION"), "Modification");
  });

  it("humanizes other statuses", () => {
    assert.strictEqual(displayPoStatus("OPEN_PO"), "OPEN PO");
  });
});

describe("parseExpectedDateOnly / formatExpiryDateDisplay", () => {
  it("parses leading YYYY-MM-DD into local calendar date", () => {
    const d = parseExpectedDateOnly("2026-03-15T00:00:00Z");
    assert.ok(d);
    assert.strictEqual(d.getFullYear(), 2026);
    assert.strictEqual(d.getMonth(), 2);
    assert.strictEqual(d.getDate(), 15);
  });

  it("returns null for missing or non-date prefix", () => {
    assert.strictEqual(parseExpectedDateOnly(null), null);
    assert.strictEqual(parseExpectedDateOnly("bad"), null);
  });

  it("formatExpiryDateDisplay falls back to raw when not parseable", () => {
    assert.strictEqual(formatExpiryDateDisplay(null), "—");
    assert.strictEqual(formatExpiryDateDisplay("nope"), "nope");
  });
});

describe("expiryTone", () => {
  /** Local noon June 10 2026 — avoids UTC vs local calendar-day drift in tests. */
  const refLocal = new Date(2026, 5, 10, 12, 0, 0, 0);

  it("unknown when date cannot be parsed", () => {
    assert.strictEqual(expiryTone("x", refLocal), "unknown");
  });

  it("expired when expected date is before reference calendar day", () => {
    assert.strictEqual(expiryTone("2026-06-09", refLocal), "expired");
  });

  it("soon when expected date is within five days after reference day", () => {
    assert.strictEqual(expiryTone("2026-06-10", refLocal), "soon");
    assert.strictEqual(expiryTone("2026-06-15", refLocal), "soon");
  });

  it("ok when expected date is after soon window", () => {
    assert.strictEqual(expiryTone("2026-06-16", refLocal), "ok");
  });
});

describe("formatInboundListDateTime", () => {
  it("returns em dash for null", () => {
    assert.strictEqual(formatInboundListDateTime(null), "—");
  });

  it("returns original string when not a valid date", () => {
    assert.strictEqual(formatInboundListDateTime("not-a-date"), "not-a-date");
  });

  it("formats valid ISO timestamps", () => {
    const s = formatInboundListDateTime("2026-01-15T06:30:00.000Z");
    assert.match(s, /2026/);
    assert.match(s, /15/);
  });
});

describe("statusToneClass (GRN pending queues)", () => {
  it("returns violet tone for approved-like statuses", () => {
    assert.ok(statusToneClass("approved").includes("violet"));
    assert.ok(statusToneClass("DONE").includes("violet"));
  });

  it("returns destructive tone for rejected", () => {
    assert.ok(statusToneClass("rejected").includes("destructive"));
  });

  it("returns empty for null or neutral status", () => {
    assert.strictEqual(statusToneClass(null), "");
    assert.strictEqual(statusToneClass("PENDING"), "");
  });
});

describe("inboundPoRowsToCsv", () => {
  it("escapes commas and quotes in cells", () => {
    const csv = inboundPoRowsToCsv([
      {
        po_id: 1,
        vendor_id: 2,
        vendor_name: 'Acme, "Ltd"',
        expected_date: null,
        status: null,
        sku_count: 0,
        total_quantity: 0,
        number_of_grns: 0,
        sku_fill_rate: 0,
        quantity_fill_rate: 0,
        po_remarks: null,
        created_at: null,
        updated_at: null,
      },
    ]);
    assert.ok(csv.includes('"Acme, ""Ltd"""'));
  });
});
