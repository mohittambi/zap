import assert from "node:assert/strict";
import zlib from "node:zlib";
import { describe, it } from "node:test";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import { AppError } from "../../src/server/errors";
import type { OutboundSkuLookups } from "../../src/server/services/eanMappingsService";
import {
  BULK_PO_REPORT_MAX_IDS,
  SKU_REPORT_COLUMN_HEADERS,
  buildBulkPendencyPdfMergedFromPos,
  buildBulkPendencyPdfZipFromPos,
  buildBulkSkuReportXlsxFromPos,
  extractListingsRowsFromSnapshotNormalized,
  parseBulkPoIds,
  resolvePendencyTotalPoQty,
  type OutboundPoRow,
} from "../../src/server/services/outboundPurchaseOrdersService";
import {
  buildPendencyRowsFromListings,
  createOutboundPoPendencyPdf,
} from "../../src/server/utils/outboundPoPendencyPdf";

function emptyLookups(): OutboundSkuLookups {
  return {
    companyId: null,
    companyCodeBySecondarySku: new Map(),
    eanBySkuKey: new Map(),
    listingSkuByKey: new Map(),
    binStockBySkuId: new Map(),
    labelsMrpBySecondarySku: new Map(),
    labelsMrpByMasterSku: new Map(),
  };
}

const testSkuDeps = {
  resolveRows: async (po: OutboundPoRow) =>
    extractListingsRowsFromSnapshotNormalized(po.listings_snapshot),
  loadLookups: async () => emptyLookups(),
  enrichRows: async (rows: Record<string, unknown>[]) => rows,
};

async function testPendencyPdfBuilder(po: OutboundPoRow): Promise<Uint8Array | null> {
  const rows = extractListingsRowsFromSnapshotNormalized(po.listings_snapshot);
  if (rows.length === 0) return null;
  const pendRows = buildPendencyRowsFromListings(rows, emptyLookups());
  return createOutboundPoPendencyPdf({
    companyName: po.company_name,
    poNumber: po.po_number,
    deliveryLocation: po.delivery_city,
    expiryDate: po.expiry_date,
    additionDate: po.created_at,
    totalPoQty: resolvePendencyTotalPoQty(po, rows),
    rows: pendRows,
  });
}

const testPendencyDeps = { buildPdf: testPendencyPdfBuilder };

function makePo(
  overrides: Partial<OutboundPoRow> & { id: number; po_number: string }
): OutboundPoRow {
  return {
    id: overrides.id,
    sold_via: null,
    company_id: overrides.company_id ?? null,
    po_number: overrides.po_number,
    delivery_city: overrides.delivery_city ?? "CHN-SS-MH-THIRUVALLUR",
    delivery_address: null,
    billing_address: null,
    buyer_gstin: null,
    po_issue_date: null,
    expiry_date: null,
    po_type: overrides.po_type ?? "Regular/BAU",
    po_creation_status: null,
    po_acknowledgement_status: null,
    po_fulfillment_status: null,
    created_by: null,
    created_at: "2026-01-01 10:00:00",
    updated_at: null,
    is_wip: "YES",
    remarks: null,
    company_name: overrides.company_name ?? "Zepto",
    analytics_object: {},
    listings_snapshot: overrides.listings_snapshot ?? { rows: [] },
    calculated_po_status: null,
    eautomate_synced_at: null,
    ...overrides,
  };
}

const sampleLine = {
  po_secondary_sku: "10149918",
  master_sku: "AAC500",
  company_code_primary: "AAC500",
  demand: 100,
  packed: 10,
  dispatched: 5,
  mrp: 1299,
  title: "Sample Product",
  rate_without_tax: 500,
};

function pdfBytesContain(bytes: Uint8Array, text: string): boolean {
  const raw = Buffer.from(bytes).toString("latin1");
  if (raw.includes(text)) return true;

  const hex = Buffer.from(text, "utf8").toString("hex").toUpperCase();
  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null = streamRe.exec(raw);
  while (match !== null) {
    try {
      const decompressed = zlib
        .inflateSync(Buffer.from(match[1], "binary"))
        .toString("latin1");
      if (decompressed.includes(text) || decompressed.toUpperCase().includes(hex)) {
        return true;
      }
    } catch {
      // not a flate stream
    }
    match = streamRe.exec(raw);
  }
  return false;
}

describe("parseBulkPoIds", () => {
  it("rejects non-array ids", () => {
    assert.throws(
      () => parseBulkPoIds("1"),
      (e: unknown) => e instanceof AppError && e.statusCode === 400
    );
  });

  it("rejects empty ids", () => {
    assert.throws(
      () => parseBulkPoIds([]),
      (e: unknown) => e instanceof AppError && e.statusCode === 400
    );
  });

  it("rejects more than max ids", () => {
    const ids = Array.from({ length: BULK_PO_REPORT_MAX_IDS + 1 }, (_, i) => i + 1);
    assert.throws(
      () => parseBulkPoIds(ids),
      (e: unknown) =>
        e instanceof AppError &&
        e.statusCode === 400 &&
        String(e.message).includes(String(BULK_PO_REPORT_MAX_IDS))
    );
  });

  it("rejects invalid ids", () => {
    assert.throws(
      () => parseBulkPoIds([0, -1, "x"]),
      (e: unknown) => e instanceof AppError && e.statusCode === 400
    );
  });

  it("dedupes duplicate ids preserving order", () => {
    assert.deepEqual(parseBulkPoIds([3, 1, 3, 2, 1]), [3, 1, 2]);
  });
});

describe("buildBulkSkuReportXlsxFromPos", () => {
  it("merges two POs into one workbook with a single header row", async () => {
    const poA = makePo({
      id: 1,
      po_number: "P4782416",
      listings_snapshot: { rows: [{ ...sampleLine, po_secondary_sku: "SKU-A" }] },
    });
    const poB = makePo({
      id: 2,
      po_number: "P4782417",
      listings_snapshot: { rows: [{ ...sampleLine, po_secondary_sku: "SKU-B" }] },
    });

    const { buffer, filename, skippedPoNumbers } =
      await buildBulkSkuReportXlsxFromPos([poA, poB], testSkuDeps);

    assert.equal(skippedPoNumbers.length, 0);
    assert.match(filename, /^bulk-sku-report-\d{4}-\d{2}-\d{2}\.xlsx$/);

    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheet = wb.Sheets["SKU Report"];
    assert.ok(sheet);
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
    assert.equal(aoa.length, 3);
    assert.deepEqual(aoa[0], [...SKU_REPORT_COLUMN_HEADERS]);
    assert.equal(aoa[0].length, 41);

    const poNumberIdx = aoa[0].indexOf("po_number");
    const skuIdx = aoa[0].indexOf("po_secondary_sku");
    const masterIdx = aoa[0].indexOf("master_sku");
    assert.equal(aoa[1][poNumberIdx], "P4782416");
    assert.equal(aoa[1][skuIdx], "SKU-A");
    assert.equal(aoa[1][masterIdx], "AAC500");
    assert.equal(aoa[2][poNumberIdx], "P4782417");
    assert.equal(aoa[2][skuIdx], "SKU-B");
  });

  it("skips empty POs and records skipped po numbers", async () => {
    const withLines = makePo({
      id: 1,
      po_number: "P-WITH-LINES",
      listings_snapshot: { rows: [sampleLine] },
    });
    const empty = makePo({
      id: 2,
      po_number: "P-EMPTY",
      listings_snapshot: { rows: [] },
    });

    const { buffer, skippedPoNumbers } = await buildBulkSkuReportXlsxFromPos(
      [withLines, empty],
      testSkuDeps
    );
    assert.deepEqual(skippedPoNumbers, ["P-EMPTY"]);
    const wb = XLSX.read(buffer, { type: "buffer" });
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets["SKU Report"], {
      header: 1,
    }) as string[][];
    assert.equal(aoa.length, 2);
  });

  it("throws 422 when all POs have no line items", async () => {
    const empty = makePo({ id: 1, po_number: "P-EMPTY", listings_snapshot: { rows: [] } });
    await assert.rejects(
      () => buildBulkSkuReportXlsxFromPos([empty], testSkuDeps),
      (e: unknown) => e instanceof AppError && e.statusCode === 422
    );
  });
});

describe("buildBulkPendencyPdfZipFromPos", () => {
  it("creates one PDF per PO with pendency filenames", async () => {
    const poA = makePo({
      id: 1,
      po_number: "P4782416",
      company_name: "Zepto",
      listings_snapshot: { rows: [sampleLine] },
    });
    const poB = makePo({
      id: 2,
      po_number: "P4782417",
      company_name: "Zepto",
      listings_snapshot: {
        rows: [{ ...sampleLine, po_secondary_sku: "10149863", master_sku: "AAC501" }],
      },
    });

    const { buffer, filename, skippedPoNumbers } =
      await buildBulkPendencyPdfZipFromPos([poA, poB], testPendencyDeps);

    assert.equal(skippedPoNumbers.length, 0);
    assert.match(filename, /^bulk-pendency-pdf-\d{4}-\d{2}-\d{2}\.zip$/);

    const zip = await JSZip.loadAsync(buffer);
    const names = Object.keys(zip.files).sort();
    assert.deepEqual(names, ["pendency-P4782416.pdf", "pendency-P4782417.pdf"]);

    const pdfA = await zip.file("pendency-P4782416.pdf")!.async("uint8array");
    assert.ok(pdfBytesContain(pdfA, "Zepto Pendency"));
    assert.ok(pdfBytesContain(pdfA, "P4782416"));
    assert.ok(pdfBytesContain(pdfA, "10149918"));
    assert.ok(pdfBytesContain(pdfA, "1299"));
    assert.ok(pdfBytesContain(pdfA, "Total PO Qty: 100"));
    assert.ok(pdfBytesContain(pdfA, "Expiry:"));
    assert.ok(pdfBytesContain(pdfA, "Addition:"));
  });

  it("omits empty POs from zip and lists them as skipped", async () => {
    const withLines = makePo({
      id: 1,
      po_number: "P-WITH-LINES",
      listings_snapshot: { rows: [sampleLine] },
    });
    const empty = makePo({
      id: 2,
      po_number: "P-EMPTY",
      listings_snapshot: { rows: [] },
    });

    const { buffer, skippedPoNumbers } = await buildBulkPendencyPdfZipFromPos(
      [withLines, empty],
      testPendencyDeps
    );
    assert.deepEqual(skippedPoNumbers, ["P-EMPTY"]);
    const zip = await JSZip.loadAsync(buffer);
    assert.equal(Object.keys(zip.files).length, 1);
    assert.ok(zip.file("pendency-P-WITH-LINES.pdf"));
  });

  it("throws 422 when every PO is empty", async () => {
    const empty = makePo({ id: 1, po_number: "P-EMPTY", listings_snapshot: { rows: [] } });
    await assert.rejects(
      () => buildBulkPendencyPdfZipFromPos([empty], testPendencyDeps),
      (e: unknown) => e instanceof AppError && e.statusCode === 422
    );
  });
});

describe("buildBulkPendencyPdfMergedFromPos", () => {
  it("merges multiple PO PDFs into one document", async () => {
    const poA = makePo({
      id: 1,
      po_number: "P4782416",
      company_name: "Zepto",
      listings_snapshot: { rows: [sampleLine] },
    });
    const poB = makePo({
      id: 2,
      po_number: "P4782417",
      company_name: "Blinkit",
      listings_snapshot: {
        rows: [{ ...sampleLine, po_secondary_sku: "10149863" }],
      },
    });

    const singleA = await buildBulkPendencyPdfZipFromPos([poA], testPendencyDeps);
    const zipA = await JSZip.loadAsync(singleA.buffer);
    const bytesA = await zipA.file("pendency-P4782416.pdf")!.async("uint8array");
    const pdfA = await PDFDocument.load(bytesA);

    const { buffer } = await buildBulkPendencyPdfMergedFromPos(
      [poA, poB],
      testPendencyDeps
    );
    const merged = await PDFDocument.load(buffer);

    assert.ok(merged.getPageCount() >= pdfA.getPageCount());
    assert.ok(pdfBytesContain(buffer, "P4782416"));
    assert.ok(pdfBytesContain(buffer, "P4782417"));
    assert.ok(pdfBytesContain(buffer, "Zepto Pendency"));
    assert.ok(pdfBytesContain(buffer, "Blinkit Pendency"));
  });
});
