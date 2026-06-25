import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergePoGrnSources, mergeGrnReceiptIntoPoLines } from "../../src/server/services/eautomatePoDetailsIngestService";

/**
 * mergePoGrnSources combines two zap-side tables into the unified GRN list
 * shown on the PO detail page:
 *   - inbound_po_detail_grns (rich raw JSONB mirrored from eAutomate)
 *   - inbound_grns           (canonical GRN rows; zap-created drafts use negative ids)
 * Reflects the rule: if the PO is created in zap, GRNs created in zap show
 * directly without an eAutomate sync.
 */

describe("mergePoGrnSources", () => {
  const eaSnap = (
    grnId: number,
    partial: Record<string, unknown> = {}
  ) => ({
    sort_index: 0,
    grn_id: grnId,
    raw: {
      grn_id: grnId,
      grn_status: "CLOSED",
      grn_audit_status: "CLOSED",
      vendor_invoice_number: `INV-${grnId}`,
      created_at: "2026-04-20T15:49:00.000Z",
      ...partial,
    },
  });

  const zapRow = (
    grnId: number,
    partial: Record<string, unknown> = {}
  ) => ({
    grn_id: grnId,
    vendor_invoice_number: `LOCAL-${grnId}`,
    box_count_invoice: 4,
    actual_box_count_received: 4,
    grn_sku_count: 1,
    grn_status: "DRAFT",
    grn_audit_status: null,
    grn_accepted_quantity: 0,
    grn_rejected_quantity: 0,
    grn_shortage_quantity: 0,
    created_by: "ops.test",
    created_at: new Date("2026-05-10T10:00:00.000Z"),
    updated_at: new Date("2026-05-10T10:00:00.000Z"),
    /** Default to 'zap' so legacy tests (which create zap drafts) still tag correctly.
     * Tests that need eAutomate or undefined override via `partial`. */
    source: "zap" as const,
    ...partial,
  });

  it("returns just the eAutomate snapshot rows when nothing local exists", () => {
    const out = mergePoGrnSources([eaSnap(3157)], []);
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].grn_id, 3157);
    assert.strictEqual(out[0].raw.vendor_invoice_number, "INV-3157");
  });

  it("returns just the zap-canonical rows when no snapshot exists (locally-created PO + GRN)", () => {
    const out = mergePoGrnSources([], [zapRow(-101)]);
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].grn_id, -101);
    assert.strictEqual(out[0].raw.grn_status, "DRAFT");
    assert.strictEqual(out[0].raw.vendor_invoice_number, "LOCAL--101");
    assert.strictEqual(out[0].raw.zap_origin, "draft");
  });

  it("zap-canonical row with positive id and source='zap' is tagged 'zap', not 'draft'", () => {
    const out = mergePoGrnSources([], [zapRow(7777, { source: "zap" })]);
    assert.strictEqual(out[0].raw.zap_origin, "zap");
  });

  it("regression: post-migration sequence-allocated zap GRN (positive id, source='zap') gets 'zap' marker", () => {
    /** After migration 060, new zap drafts get ids ≥ 10^10 with source='zap'.
     * The merge must tag these as 'zap' so the GRN card link is enabled
     * (positive id alone used to mean 'eAutomate-synced'). */
    const out = mergePoGrnSources(
      [],
      [zapRow(10000000010, { source: "zap" })]
    );
    assert.strictEqual(out[0].raw.zap_origin, "zap");
  });

  it("eAutomate-synced row (in inbound_grns with source='eautomate') gets NO zap_origin marker", () => {
    const out = mergePoGrnSources(
      [],
      [zapRow(3157, { source: "eautomate" })]
    );
    assert.strictEqual(out[0].raw.zap_origin, undefined);
  });

  it("legacy negative-id row without source column falls back to 'draft' marker", () => {
    /** Pre-migration legacy rows have no source. Negative id → still tag as draft
     * for backward compatibility until the backfill runs. */
    const out = mergePoGrnSources([], [zapRow(-101, { source: undefined })]);
    assert.strictEqual(out[0].raw.zap_origin, "draft");
  });

  it("snapshot-only rows do NOT get a zap_origin marker (they came from eAutomate)", () => {
    const out = mergePoGrnSources([eaSnap(3157)], []);
    assert.strictEqual(out[0].raw.zap_origin, undefined);
  });

  it("merges by grn_id — snapshot wins when both have the same id (richer raw)", () => {
    const out = mergePoGrnSources(
      [eaSnap(500, { vendor_invoice_number: "EA-500" })],
      [zapRow(500, { vendor_invoice_number: "LOCAL-500" })]
    );
    assert.strictEqual(out.length, 1, "deduped by grn_id");
    assert.strictEqual(
      out[0].raw.vendor_invoice_number,
      "EA-500",
      "snapshot raw is preferred"
    );
  });

  it("includes both when ids differ (e.g. eAutomate GRNs + a zap draft on the same PO)", () => {
    const out = mergePoGrnSources(
      [eaSnap(3157), eaSnap(3158)],
      [zapRow(-101)]
    );
    const ids = out.map((g) => g.grn_id).sort((a, b) => Number(a) - Number(b));
    assert.deepStrictEqual(ids, [-101, 3157, 3158]);
  });

  it("sorts by latest activity timestamp DESC across sources", () => {
    /** Old eAutomate GRN (Apr) + newer zap draft (May) → draft should sit first. */
    const out = mergePoGrnSources(
      [eaSnap(3157, { updated_at: "2026-04-20T15:49:00.000Z" })],
      [zapRow(-101, { updated_at: new Date("2026-05-10T10:00:00.000Z") })]
    );
    assert.strictEqual(out[0].grn_id, -101, "newer (May) comes first");
    assert.strictEqual(out[1].grn_id, 3157, "older (Apr) comes second");
  });

  it("falls back to created_at when updated_at is missing", () => {
    const out = mergePoGrnSources(
      [eaSnap(3157, { updated_at: null, created_at: "2026-06-01T00:00:00.000Z" })],
      [zapRow(-101, { updated_at: null, created_at: new Date("2026-05-01T00:00:00.000Z") })]
    );
    assert.strictEqual(out[0].grn_id, 3157, "newer created_at wins");
  });

  it("converts Date objects in zap rows to ISO strings", () => {
    const out = mergePoGrnSources([], [zapRow(-1)]);
    assert.strictEqual(out[0].raw.created_at, "2026-05-10T10:00:00.000Z");
    assert.strictEqual(typeof out[0].raw.created_at, "string");
  });

  it("regression: zap-source POs (snapshot deliberately empty) show only inbound_grns rows", () => {
    /** getPoDetailsBundle passes [] for snapGrnsR.rows when header.source === 'zap'
     * to suppress phantom eAutomate snapshot rows under a colliding po_id
     * (the GRN-3157-under-zap-PO-16719 bug). Mirror that contract here. */
    const out = mergePoGrnSources(
      [], // <-- snapshot intentionally suppressed for zap-source PO
      [zapRow(-101), zapRow(-102)]
    );
    const ids = out.map((g) => g.grn_id).sort((a, b) => Number(a) - Number(b));
    assert.deepStrictEqual(ids, [-102, -101]);
    assert.ok(
      out.every((g) => g.raw.zap_origin === "draft" || g.raw.zap_origin === "zap"),
      "every row carries the zap_origin marker"
    );
  });

  it("skips zap rows with missing/invalid grn_id", () => {
    const out = mergePoGrnSources(
      [],
      [
        zapRow(0),
        { ...zapRow(0), grn_id: null },
        zapRow(42),
      ]
    );
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].grn_id, 42);
  });
});

describe("mergeGrnReceiptIntoPoLines", () => {
  it("merges canonical GRN receipt totals into zap PO line raw", () => {
    const lines = [
      {
        sku_id: "CTEALIGHT_LEMON_SO10",
        raw: { sku_id: "CTEALIGHT_LEMON_SO10", quantity: 2000 },
      },
    ];
    const receipt = new Map([
      [
        "CTEALIGHT_LEMON_SO10",
        {
          received_quantity: 2000,
          accepted_quantity: 1800,
          rejected_quantity: 200,
          shortage_quantity: 0,
        },
      ],
    ]);
    const out = mergeGrnReceiptIntoPoLines(lines, receipt);
    assert.strictEqual(out.length, 1);
    const raw = out[0].raw as Record<string, unknown>;
    assert.strictEqual(raw.quantity, 2000);
    assert.strictEqual(raw.invoice_quantity, 2000);
    assert.strictEqual(raw.received_quantity, 2000);
    assert.strictEqual(raw.accepted_quantity, 1800);
    assert.strictEqual(raw.rejected_quantity, 200);
  });

  it("leaves lines unchanged when no receipt exists for sku", () => {
    const lines = [{ sku_id: "UNKNOWN", raw: { quantity: 5 } }];
    const out = mergeGrnReceiptIntoPoLines(lines, new Map());
    assert.deepStrictEqual(out, lines);
  });
});
