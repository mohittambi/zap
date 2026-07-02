import assert from "node:assert/strict";
import zlib from "node:zlib";
import { describe, it } from "node:test";
import { PDFDocument } from "pdf-lib";
import {
  buildPendencyRowsFromListings,
  createOutboundPoPendencyPdf,
  pendencySkuIdCandidates,
  resolvePendencyRowFields,
  type PendencyLookups,
  type PendencyRow,
} from "../../src/server/utils/outboundPoPendencyPdf";

function emptyLookups(companyId: number | null = null): PendencyLookups {
  return {
    companyId,
    companyCodeBySecondarySku: new Map(),
    eanBySkuKey: new Map(),
    listingSkuByKey: new Map(),
    binStockBySkuId: new Map(),
    labelsMrpBySecondarySku: new Map(),
    labelsMrpByMasterSku: new Map(),
  };
}

function makePendencyRows(rowCount: number): PendencyRow[] {
  return Array.from({ length: rowCount }, (_, i) => ({
    po_secondary_sku: `PEND-${String(i + 1).padStart(4, "0")}`,
    company_code_primary: `MSK-${i + 1}`,
    warehouse_quantity: i % 3 === 0 ? 10 : null,
    mrp: 599,
    pending: 100 - i,
  }));
}

async function makePdf(rowCount: number): Promise<Uint8Array> {
  return createOutboundPoPendencyPdf({
    companyName: "Amazon Etrade",
    poNumber: "3ER6PK9W",
    deliveryLocation: "DED5",
    rows: makePendencyRows(rowCount),
  });
}

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

describe("outboundPoPendencyPdf", () => {
  it("pendencySkuIdCandidates prefers inventory_sku_id then master_sku then po_secondary_sku", () => {
    const ids = pendencySkuIdCandidates({
      po_secondary_sku: "10149864",
      master_sku: "AAC500",
      inventory_sku_id: "INV-1",
      listing: { master_sku: "LIST-MSKU" },
    });
    assert.deepEqual(ids, ["INV-1", "AAC500", "10149864"]);
  });

  it("pendencySkuIdCandidates uses listingSkuByKey before po_secondary_sku", () => {
    const lookups = emptyLookups();
    lookups.listingSkuByKey.set("10149864", {
      master_sku: "AAC500",
      inventory_sku_id: "",
    });
    const ids = pendencySkuIdCandidates(
      { po_secondary_sku: "10149864" },
      lookups
    );
    assert.deepEqual(ids, ["AAC500", "10149864"]);
  });

  it("pendencySkuIdCandidates skips NA and listing duplicates", () => {
    const ids = pendencySkuIdCandidates({
      po_secondary_sku: "NA",
      master_sku: "MSKU",
      inventory_sku_id: "NA",
      listing: { inventory_sku_id: "MSKU", master_sku: "MSKU" },
    });
    assert.deepEqual(ids, ["MSKU"]);
  });

  it("resolvePendencyRowFields uses top-level company_code_primary", () => {
    const fields = resolvePendencyRowFields(
      { company_code_primary: "CODE-A", po_secondary_sku: "SKU1" },
      emptyLookups(30044)
    );
    assert.equal(fields.company_code_primary, "CODE-A");
  });

  it("resolvePendencyRowFields ignores top-level company_code_primary when it equals po_secondary_sku", () => {
    const lookups = emptyLookups();
    lookups.listingSkuByKey.set("10149864", {
      master_sku: "AAC500",
      inventory_sku_id: "",
    });
    const fields = resolvePendencyRowFields(
      {
        company_code_primary: "10149864",
        po_secondary_sku: "10149864",
      },
      lookups
    );
    assert.equal(fields.company_code_primary, "AAC500");
  });

  it("resolvePendencyRowFields falls back to company_secondary_sku map", () => {
    const lookups = emptyLookups(30044);
    lookups.companyCodeBySecondarySku.set("SKU1", "CODE-DB");
    const fields = resolvePendencyRowFields(
      { po_secondary_sku: "SKU1" },
      lookups
    );
    assert.equal(fields.company_code_primary, "CODE-DB");
  });

  it("resolvePendencyRowFields falls back to master_sku when company code sources missing", () => {
    const fields = resolvePendencyRowFields(
      { po_secondary_sku: "10149864", master_sku: "AAC500" },
      emptyLookups()
    );
    assert.equal(fields.company_code_primary, "AAC500");
  });

  it("resolvePendencyRowFields falls back to listing.master_sku", () => {
    const fields = resolvePendencyRowFields(
      {
        po_secondary_sku: "10149864",
        listing: { master_sku: "AAC500" },
      },
      emptyLookups()
    );
    assert.equal(fields.company_code_primary, "AAC500");
  });

  it("resolvePendencyRowFields resolves master_sku from listingSkuByKey", () => {
    const lookups = emptyLookups();
    lookups.listingSkuByKey.set("10149864", {
      master_sku: "AAC500",
      inventory_sku_id: "INV-AAC",
    });
    const fields = resolvePendencyRowFields(
      { po_secondary_sku: "10149864" },
      lookups
    );
    assert.equal(fields.company_code_primary, "AAC500");
  });

  it("resolvePendencyRowFields does not fall back to po_secondary_sku", () => {
    const fields = resolvePendencyRowFields(
      { po_secondary_sku: "10149864" },
      emptyLookups()
    );
    assert.equal(fields.company_code_primary, null);
  });

  it("resolvePendencyRowFields resolves master_sku from company_ean_mappings by PO SKU", () => {
    const lookups = emptyLookups();
    lookups.eanBySkuKey.set("10149864", {
      sku_code: "AAC500",
      channel_ean: "10149864",
      universal_ean: "8901234567890",
      ean_type: "ean",
    });
    const fields = resolvePendencyRowFields(
      { po_secondary_sku: "10149864" },
      lookups
    );
    assert.equal(fields.company_code_primary, "AAC500");
  });

  it("resolvePendencyRowFields does not show EAN barcode as company code primary", () => {
    const lookups = emptyLookups();
    lookups.eanBySkuKey.set("10149864", {
      sku_code: "AAC500",
      channel_ean: "10149864",
      universal_ean: "8901234567890",
      ean_type: "ean",
    });
    const fields = resolvePendencyRowFields(
      { po_secondary_sku: "10149864" },
      lookups
    );
    assert.notEqual(fields.company_code_primary, "8901234567890");
    assert.equal(fields.company_code_primary, "AAC500");
  });

  it("resolvePendencyRowFields prefers listing master_sku when present on row", () => {
    const lookups = emptyLookups();
    lookups.eanBySkuKey.set("10149864", {
      sku_code: "AAC500",
      channel_ean: "10149864",
      universal_ean: "",
      ean_type: "",
    });
    const fields = resolvePendencyRowFields(
      { po_secondary_sku: "10149864", master_sku: "MASTER-ON-ROW" },
      lookups
    );
    assert.equal(fields.company_code_primary, "MASTER-ON-ROW");
  });

  it("resolvePendencyRowFields skips company_secondary_sku when it equals PO SKU", () => {
    const lookups = emptyLookups();
    lookups.companyCodeBySecondarySku.set("10149864", "10149864");
    lookups.eanBySkuKey.set("10149864", {
      sku_code: "AAC500",
      channel_ean: "10149864",
      universal_ean: "",
      ean_type: "",
    });
    const fields = resolvePendencyRowFields(
      { po_secondary_sku: "10149864" },
      lookups
    );
    assert.equal(fields.company_code_primary, "AAC500");
  });

  it("resolvePendencyRowFields prefers company code over sku fallbacks", () => {
    const fields = resolvePendencyRowFields(
      {
        company_code_primary: "REAL-CODE",
        master_sku: "AAC500",
        po_secondary_sku: "10149864",
      },
      emptyLookups()
    );
    assert.equal(fields.company_code_primary, "REAL-CODE");
  });

  it("resolvePendencyRowFields falls back to secondary_sku_company_details for PO company", () => {
    const fields = resolvePendencyRowFields(
      {
        po_secondary_sku: "SKU1",
        secondary_sku_company_details: [
          { company_id: 99, company_code_primary: "OTHER" },
          { company_id: 30044, company_code_primary: "CODE-SNAP" },
        ],
      },
      emptyLookups(30044)
    );
    assert.equal(fields.company_code_primary, "CODE-SNAP");
  });

  it("resolvePendencyRowFields uses bin stock for first matching sku candidate", () => {
    const lookups = emptyLookups();
    lookups.binStockBySkuId.set("INV-1", 42);
    lookups.binStockBySkuId.set("MSKU", 99);
    const fields = resolvePendencyRowFields(
      {
        po_secondary_sku: "10149864",
        master_sku: "MSKU",
        inventory_sku_id: "INV-1",
      },
      lookups
    );
    assert.equal(fields.warehouse_quantity, 42);
  });

  it("resolvePendencyRowFields uses bin stock via EAN sku_code without listings row", () => {
    const lookups = emptyLookups();
    lookups.eanBySkuKey.set("10149918", {
      sku_code: "AAC500",
      channel_ean: "10149918",
      universal_ean: "",
      ean_type: "",
    });
    lookups.binStockBySkuId.set("AAC500", 55);
    const fields = resolvePendencyRowFields(
      { po_secondary_sku: "10149918" },
      lookups
    );
    assert.equal(fields.warehouse_quantity, 55);
    assert.equal(fields.company_code_primary, "AAC500");
  });

  it("resolvePendencyRowFields uses bin stock via listing-resolved master_sku", () => {
    const lookups = emptyLookups();
    lookups.listingSkuByKey.set("10149864", {
      master_sku: "AAC500",
      inventory_sku_id: "",
    });
    lookups.binStockBySkuId.set("AAC500", 120);
    const fields = resolvePendencyRowFields(
      { po_secondary_sku: "10149864" },
      lookups
    );
    assert.equal(fields.warehouse_quantity, 120);
    assert.equal(fields.company_code_primary, "AAC500");
  });

  it("resolvePendencyRowFields accepts zero bin stock", () => {
    const lookups = emptyLookups();
    lookups.binStockBySkuId.set("MSKU", 0);
    const fields = resolvePendencyRowFields(
      { master_sku: "MSKU", po_secondary_sku: "SKU1" },
      lookups
    );
    assert.equal(fields.warehouse_quantity, 0);
  });

  it("resolvePendencyRowFields leaves warehouse_quantity null when no bin match", () => {
    const fields = resolvePendencyRowFields(
      { master_sku: "UNKNOWN", po_secondary_sku: "SKU1" },
      emptyLookups()
    );
    assert.equal(fields.warehouse_quantity, null);
  });

  it("buildPendencyRowsFromListings computes pending from demand packed dispatched", () => {
    const rows = buildPendencyRowsFromListings(
      [
        {
          po_secondary_sku: "SKU1",
          demand: 100,
          packed: 10,
          dispatched: 20,
        },
      ],
      emptyLookups()
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].pending, 70);
    assert.equal(rows[0].po_secondary_sku, "SKU1");
  });

  it("buildPendencyRowsFromListings respects explicit pending", () => {
    const rows = buildPendencyRowsFromListings(
      [{ po_secondary_sku: "SKU1", demand: 100, pending: 5 }],
      emptyLookups()
    );
    assert.equal(rows[0].pending, 5);
  });

  it("buildPendencyRowsFromListings merges lookups into output rows", () => {
    const lookups = emptyLookups(30044);
    lookups.companyCodeBySecondarySku.set("SKU1", "CCP-1");
    lookups.binStockBySkuId.set("MSKU", 250);
    const rows = buildPendencyRowsFromListings(
      [
        {
          po_secondary_sku: "SKU1",
          master_sku: "MSKU",
          mrp: 2999,
        },
      ],
      lookups
    );
    assert.equal(rows[0].company_code_primary, "CCP-1");
    assert.equal(rows[0].warehouse_quantity, 250);
    assert.equal(rows[0].mrp, 2999);
  });

  describe("createOutboundPoPendencyPdf pagination", () => {
    it("renders 0 rows on a single page", async () => {
      const bytes = await makePdf(0);
      const pdf = await PDFDocument.load(bytes);
      assert.equal(pdf.getPageCount(), 1);
    });

    it("renders 10 rows on a single page", async () => {
      const bytes = await makePdf(10);
      const pdf = await PDFDocument.load(bytes);
      assert.equal(pdf.getPageCount(), 1);
      assert.ok(pdfBytesContain(bytes, "PEND-0001"));
      assert.ok(pdfBytesContain(bytes, "PEND-0010"));
    });

    it("paginates 40 rows across multiple pages", async () => {
      const bytes = await makePdf(40);
      const pdf = await PDFDocument.load(bytes);
      assert.ok(pdf.getPageCount() >= 2);
      assert.ok(pdfBytesContain(bytes, "PEND-0001"));
      assert.ok(pdfBytesContain(bytes, "PEND-0040"));
    });

    it("renders all 290 rows across multiple pages (regression)", async () => {
      const bytes = await makePdf(290);
      const pdf = await PDFDocument.load(bytes);
      assert.ok(pdf.getPageCount() >= 8);
      assert.ok(pdfBytesContain(bytes, "PEND-0001"));
      assert.ok(pdfBytesContain(bytes, "PEND-0290"));
      assert.ok(pdfBytesContain(bytes, "MSK-290"));
    });
  });
});
