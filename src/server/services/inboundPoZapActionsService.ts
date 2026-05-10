import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as XLSX from "xlsx";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";

/**
 * Ensures a PO snapshot row exists and returns its `po_raw` + canonical vendor id.
 *
 * For **eAutomate-source POs** the snapshot is populated by `sync:po:details*`;
 * absence indicates the PO was never synced (404).
 *
 * For **zap-source POs** the snapshot is intentionally not populated by sync
 * (doctrine #3). The snapshot row is still useful as a holder for zap-side
 * action state (`zap_status`, `zap_notes`) so the existing Modify/Cancel/PDF
 * routes work uniformly. We lazy-create an empty row on first access.
 */
export async function assertVendorPoSnapshot(
  _pathVendorId: number,
  poId: number
) {
  const r = await query(
    `SELECT vendor_id, po_raw FROM inbound_po_detail_snapshot WHERE po_id = $1`,
    [poId]
  );
  if (r.rows.length > 0) {
    return {
      po_raw: r.rows[0].po_raw as Record<string, unknown>,
      canonicalVendorId: Number(r.rows[0].vendor_id),
    };
  }

  /** No snapshot. If this is a zap-source PO, lazy-create one from canonical
   * vendor_purchase_orders so all downstream callers can rely on the row. */
  const canonical = await query(
    `SELECT vendor_id, source FROM vendor_purchase_orders WHERE po_id = $1`,
    [poId]
  );
  if (canonical.rows.length === 0) {
    throw new AppError("PO not found", 404);
  }
  if (canonical.rows[0].source !== "zap") {
    /** eAutomate-source PO with no snapshot: requires a sync run, not a create. */
    throw new AppError("PO snapshot not found", 404);
  }
  const vid = Number(canonical.rows[0].vendor_id);
  await query(
    `INSERT INTO inbound_po_detail_snapshot (
       po_id, vendor_id, synced_at, vendor_raw, vendor_listings_raw, sku_names_raw, po_raw
     ) VALUES (
       $1, $2, NOW(), '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb
     )
     ON CONFLICT (po_id) DO NOTHING`,
    [poId, vid]
  );
  return {
    po_raw: {} as Record<string, unknown>,
    canonicalVendorId: vid,
  };
}

export async function mergeInboundPoRaw(
  vendorId: number,
  poId: number,
  patch: Record<string, unknown>
): Promise<void> {
  await assertVendorPoSnapshot(vendorId, poId);
  const json = JSON.stringify(patch);
  const r = await query(
    `UPDATE inbound_po_detail_snapshot
     SET po_raw = po_raw || $1::jsonb,
         synced_at = NOW()
     WHERE po_id = $2
     RETURNING po_id`,
    [json, poId]
  );
  if (r.rows.length === 0) {
    throw new AppError("Could not update PO", 500);
  }
}

/** Buyer entity rendered on every Inbound PO document. Constants today;
 * lift into a per-organization settings table when zap is multi-tenant. */
const BUYER = {
  name: "Eunoia Crafts India Private Ltd.",
  address:
    "Khasra no. 1660, Jat Colony, Jaisinghpura road, Bhankrota, Jaipur, Rajasthan, India, 302026",
  gstin: "08AAGCE1266P1Z7",
} as const;

const DELIVERY_TERMS = [
  "Kindly adhere to the specified quantity mentioned in the Purchase Order, as quantities not aligned with the PO will not be admissible.",
  "Please ensure that all items are sent in suitable primary packaging for their protection.",
  "We kindly request you to include the attached Purchase Order ID when sending your invoice.",
  "Kindly provide a complete and accurate tax invoice for the transaction. Please note that without the proper invoice, the merchandise will not be accepted.",
  "To facilitate smooth processing, kindly ensure that the address and GSTIN on the bill match the details provided in the Purchase Order.",
  "E-way bills are mandatory for invoices exceeding a value of 50,000 INR.",
] as const;

type PoDocumentData = {
  poId: number;
  poNumber: string;
  poReleaseDate: string;
  poExpiryDate: string;
  totalItems: number;
  totalQuantity: number;
  vendor: {
    name: string;
    addressLine: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    gstin: string | null;
    contactNumber: string | null;
  };
  lines: Array<{
    sku_id: string;
    quantity: number;
    description: string | null;
    dimension: string | null;
  }>;
};

function fmtDayLong(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Read everything the PDF + Excel renderers need from canonical zap tables.
 * Works for both zap-source and eAutomate-source POs (no snapshot dependency). */
export async function loadPoDocumentData(poId: number): Promise<PoDocumentData> {
  const headerR = await query(
    `SELECT po.po_id, po.expected_date, po.created_at, po.sku_count, po.total_quantity,
            v.id AS vendor_id, v.vendor_name, v.vendor_address_line, v.vendor_city,
            v.vendor_state, v.vendor_postal_code, v.vendor_gstin, v.vendor_contact_number
       FROM vendor_purchase_orders po
       JOIN vendors v ON v.id = po.vendor_id
      WHERE po.po_id = $1`,
    [poId]
  );
  if (headerR.rows.length === 0) {
    throw new AppError("PO not found", 404);
  }
  const h = headerR.rows[0];

  const linesR = await query(
    `SELECT l.sku_id, l.quantity,
            ls.description, ls.dimension
       FROM vendor_purchase_order_lines l
       LEFT JOIN listings ls ON ls.sku_id = l.sku_id
      WHERE l.po_id = $1
      ORDER BY l.id ASC`,
    [poId]
  );

  return {
    poId,
    poNumber: String(poId),
    poReleaseDate: fmtDayLong(
      h.created_at instanceof Date
        ? h.created_at.toISOString()
        : (h.created_at as string | null)
    ),
    poExpiryDate: fmtDayLong(
      h.expected_date instanceof Date
        ? h.expected_date.toISOString()
        : (h.expected_date as string | null)
    ),
    totalItems: Number(h.sku_count ?? 0),
    totalQuantity: Number(h.total_quantity ?? 0),
    vendor: {
      name: (h.vendor_name as string | null) ?? "—",
      addressLine: (h.vendor_address_line as string | null) ?? null,
      city: (h.vendor_city as string | null) ?? null,
      state: (h.vendor_state as string | null) ?? null,
      postalCode: (h.vendor_postal_code as string | null) ?? null,
      gstin: (h.vendor_gstin as string | null) ?? null,
      contactNumber: (h.vendor_contact_number as string | null) ?? null,
    },
    lines: linesR.rows.map((r) => ({
      sku_id: String(r.sku_id),
      quantity: Number(r.quantity ?? 0),
      description: (r.description as string | null) ?? null,
      dimension: (r.dimension as string | null) ?? null,
    })),
  };
}

function buildVendorAddressLines(v: PoDocumentData["vendor"]): string[] {
  const parts: string[] = [v.name];
  if (v.addressLine) parts.push(v.addressLine);
  const cityState = [v.city, v.state, v.postalCode]
    .filter((s) => s != null && String(s).trim() !== "")
    .join(", ");
  if (cityState) parts.push(cityState);
  if (v.gstin) parts.push(`GST - ${v.gstin}`);
  if (v.contactNumber) parts.push(`Contact Number - ${v.contactNumber}`);
  return parts;
}

export async function buildInboundPoPdfBytes(
  _vendorId: number,
  poId: number
): Promise<{ bytes: Uint8Array; filename: string }> {
  const data = await loadPoDocumentData(poId);

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 595.28; // A4 portrait
  const PAGE_H = 841.89;
  const MARGIN = 40;
  const HEADER_BAND = rgb(0.86, 0.85, 0.95); // light lavender
  const TITLE_COLOR = rgb(0.45, 0.4, 0.85);
  const TEXT = rgb(0.1, 0.1, 0.15);
  const MUTED = rgb(0.32, 0.32, 0.4);

  let page = pdf.addPage([PAGE_W, PAGE_H]);

  function newPage() {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    drawPageHeader(false);
    return PAGE_H - 100; // y after header
  }

  function drawText(
    text: string,
    x: number,
    y: number,
    opts: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb>; maxWidth?: number } = {}
  ): number {
    const f = opts.bold ? fontBold : font;
    const size = opts.size ?? 10;
    const color = opts.color ?? TEXT;
    const maxWidth = opts.maxWidth;
    const lines = maxWidth ? wrap(text, f, size, maxWidth) : [text];
    let cursorY = y;
    for (const ln of lines) {
      page.drawText(ln, { x, y: cursorY, size, font: f, color });
      cursorY -= size + 4;
    }
    return cursorY;
  }

  function wrap(
    text: string,
    f: typeof font,
    size: number,
    maxWidth: number
  ): string[] {
    const words = text.split(/\s+/);
    const out: string[] = [];
    let cur = "";
    for (const w of words) {
      const tentative = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(tentative, size) <= maxWidth) {
        cur = tentative;
      } else {
        if (cur) out.push(cur);
        cur = w;
      }
    }
    if (cur) out.push(cur);
    return out.length === 0 ? [""] : out;
  }

  function drawCardHeader(x: number, y: number, w: number, label: string) {
    page.drawRectangle({
      x,
      y: y - 22,
      width: w,
      height: 22,
      color: HEADER_BAND,
    });
    page.drawText(label, {
      x: x + 10,
      y: y - 16,
      size: 10,
      font: fontBold,
      color: TEXT,
    });
  }

  function drawCard(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    body: string[]
  ) {
    page.drawRectangle({
      x,
      y: y - h,
      width: w,
      height: h,
      borderColor: rgb(0.85, 0.85, 0.9),
      borderWidth: 1,
      color: rgb(1, 1, 1),
    });
    drawCardHeader(x, y, w, label);
    let cursorY = y - 36;
    for (const line of body) {
      cursorY = drawText(line, x + 10, cursorY, {
        size: 10,
        maxWidth: w - 20,
      });
      cursorY -= 2;
    }
  }

  function drawPageHeader(showTitle: boolean) {
    /** Top brand block — text-only "eCraftIndia" placeholder where the real
     * logo would go. Replace with a PNG embed once the logo asset is wired. */
    const top = PAGE_H - 30;
    page.drawText("eCraftIndia", {
      x: MARGIN,
      y: top - 10,
      size: 18,
      font: fontBold,
      color: rgb(0.85, 0.18, 0.27),
    });
    page.drawText("ART OF INDIA · HOME DELIVERED", {
      x: MARGIN,
      y: top - 26,
      size: 7,
      font,
      color: MUTED,
    });
    if (showTitle) {
      page.drawText("Purchase Order", {
        x: PAGE_W - MARGIN - 220,
        y: top - 18,
        size: 28,
        font: fontBold,
        color: TITLE_COLOR,
      });
    }
  }

  // ── Page 1 ────────────────────────────────────────────────────────────────
  drawPageHeader(true);
  let y = PAGE_H - 110;

  const colW = (PAGE_W - MARGIN * 2 - 12) / 2;
  const buyerBody = [BUYER.name, BUYER.address, `GST - ${BUYER.gstin}`];
  drawCard(MARGIN, y, colW, 92, "Billing Address", buyerBody);
  drawCard(MARGIN + colW + 12, y, colW, 92, "Shipping Address", buyerBody);
  y -= 110;

  const vendorLines = buildVendorAddressLines(data.vendor);
  const summaryLines = [
    `P.O. Number - ${data.poNumber}`,
    `P.O Release Date : ${data.poReleaseDate}`,
    `P.O Expiry Date - ${data.poExpiryDate}`,
    `Total Items - ${data.totalItems}`,
    `Total Quantity - ${data.totalQuantity}`,
  ];
  const cardH = Math.max(110, 36 + Math.max(vendorLines.length, summaryLines.length) * 14);
  drawCard(MARGIN, y, colW, cardH, "Vendor Details", vendorLines);
  drawCard(MARGIN + colW + 12, y, colW, cardH, "Summary", summaryLines);
  y -= cardH + 20;

  const termsBodyHeight = 30 + DELIVERY_TERMS.length * 26;
  page.drawRectangle({
    x: MARGIN,
    y: y - termsBodyHeight,
    width: PAGE_W - MARGIN * 2,
    height: termsBodyHeight,
    borderColor: rgb(0.85, 0.85, 0.9),
    borderWidth: 1,
    color: rgb(1, 1, 1),
  });
  drawCardHeader(MARGIN, y, PAGE_W - MARGIN * 2, "Delivery Terms -");
  let termY = y - 40;
  for (let i = 0; i < DELIVERY_TERMS.length; i += 1) {
    const next = drawText(`${i + 1}) ${DELIVERY_TERMS[i]}`, MARGIN + 12, termY, {
      size: 10,
      maxWidth: PAGE_W - MARGIN * 2 - 24,
    });
    termY = next - 6;
  }

  // ── Pages 2+ : SKU lines (3 per page like the reference) ─────────────────
  const LINES_PER_PAGE = 3;
  const LINE_BLOCK_H = 110;
  for (let i = 0; i < data.lines.length; i += LINES_PER_PAGE) {
    const startY = newPage();
    let cursorY = startY;
    for (let j = i; j < Math.min(i + LINES_PER_PAGE, data.lines.length); j += 1) {
      const line = data.lines[j];
      page.drawRectangle({
        x: MARGIN,
        y: cursorY - LINE_BLOCK_H,
        width: PAGE_W - MARGIN * 2,
        height: LINE_BLOCK_H,
        borderColor: rgb(0.85, 0.85, 0.9),
        borderWidth: 1,
        color: rgb(1, 1, 1),
      });
      /** Image placeholder block (left column) — embed listings.img_hd later. */
      page.drawRectangle({
        x: MARGIN + 14,
        y: cursorY - LINE_BLOCK_H + 14,
        width: 80,
        height: LINE_BLOCK_H - 28,
        color: rgb(0.97, 0.97, 0.99),
        borderColor: rgb(0.88, 0.88, 0.93),
        borderWidth: 1,
      });
      page.drawText("image", {
        x: MARGIN + 36,
        y: cursorY - LINE_BLOCK_H / 2 - 4,
        size: 8,
        font,
        color: MUTED,
      });
      const textX = MARGIN + 14 + 80 + 18;
      const textW = PAGE_W - MARGIN * 2 - (textX - MARGIN) - 14;
      let ly = cursorY - 20;
      ly = drawText(`Required Quantity: ${line.quantity}`, textX, ly, {
        bold: true,
        size: 11,
        maxWidth: textW,
      });
      ly -= 6;
      ly = drawText(`SKU ID: ${line.sku_id}`, textX, ly, {
        size: 10,
        maxWidth: textW,
      });
      ly -= 6;
      ly = drawText(
        `L.W.H. : ${line.dimension && line.dimension.trim() !== "" ? line.dimension : "NA"}`,
        textX,
        ly,
        { size: 10, maxWidth: textW, color: MUTED }
      );
      cursorY -= LINE_BLOCK_H + 12;
    }
  }

  const bytes = await pdf.save();
  return {
    bytes,
    filename: `${data.poId}_purchase_order.pdf`,
  };
}

/**
 * Workbook with three sheets:
 *  - Summary: PO + buyer + vendor + delivery terms (key/value rows)
 *  - Line Items: one row per SKU with qty, description, dimension
 *  - Delivery Terms: one row per term, numbered
 *
 * Same data source as the PDF (loadPoDocumentData) so both formats stay consistent.
 */
export async function buildInboundPoXlsxBytes(
  _vendorId: number,
  poId: number
): Promise<{ bytes: Uint8Array; filename: string }> {
  const data = await loadPoDocumentData(poId);
  const v = data.vendor;

  const summaryRows: Array<[string, string]> = [
    ["P.O. Number", data.poNumber],
    ["P.O. Release Date", data.poReleaseDate],
    ["P.O. Expiry Date", data.poExpiryDate],
    ["Total Items", String(data.totalItems)],
    ["Total Quantity", String(data.totalQuantity)],
    ["", ""],
    ["Billing Address", BUYER.name],
    ["", BUYER.address],
    ["GST", BUYER.gstin],
    ["", ""],
    ["Shipping Address", BUYER.name],
    ["", BUYER.address],
    ["GST", BUYER.gstin],
    ["", ""],
    ["Vendor Name", v.name],
    ["Vendor Address", v.addressLine ?? ""],
    [
      "Vendor City / State / Postal",
      [v.city, v.state, v.postalCode].filter(Boolean).join(", "),
    ],
    ["Vendor GSTIN", v.gstin ?? ""],
    ["Vendor Contact", v.contactNumber ?? ""],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet([
    ["Field", "Value"],
    ...summaryRows,
  ]);
  summarySheet["!cols"] = [{ wch: 32 }, { wch: 80 }];

  const linesSheet = XLSX.utils.aoa_to_sheet([
    ["#", "SKU ID", "Required Quantity", "Description", "L.W.H. (dimension)"],
    ...data.lines.map((l, i) => [
      i + 1,
      l.sku_id,
      l.quantity,
      l.description ?? "",
      l.dimension && l.dimension.trim() !== "" ? l.dimension : "NA",
    ]),
  ]);
  linesSheet["!cols"] = [
    { wch: 4 },
    { wch: 20 },
    { wch: 18 },
    { wch: 60 },
    { wch: 40 },
  ];

  const termsSheet = XLSX.utils.aoa_to_sheet([
    ["#", "Term"],
    ...DELIVERY_TERMS.map((t, i) => [i + 1, t]),
  ]);
  termsSheet["!cols"] = [{ wch: 4 }, { wch: 120 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");
  XLSX.utils.book_append_sheet(wb, linesSheet, "Line Items");
  XLSX.utils.book_append_sheet(wb, termsSheet, "Delivery Terms");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return {
    bytes: new Uint8Array(buf),
    filename: `${data.poId}_purchase_order.xlsx`,
  };
}

export async function buildGrnReportCsv(
  vendorId: number,
  poId: number
): Promise<{ csv: string; filename: string }> {
  await assertVendorPoSnapshot(vendorId, poId);

  const r = await query(
    `SELECT g.sort_index, g.grn_id, g.raw AS link_raw,
            ig.grn_status, ig.vendor_invoice_number, ig.created_at,
            ig.grn_accepted_quantity, ig.grn_rejected_quantity
     FROM inbound_po_detail_grns g
     LEFT JOIN inbound_grns ig ON ig.grn_id = g.grn_id
     WHERE g.po_id = $1
     ORDER BY g.sort_index ASC`,
    [poId]
  );

  const headers = [
    "sort_index",
    "grn_id",
    "grn_status",
    "vendor_invoice_number",
    "created_at",
    "accepted_qty",
    "rejected_qty",
    "link_raw_json",
  ];

  function esc(v: unknown): string {
    const s = v == null ? "" : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  const rows: string[] = [headers.join(",")];
  for (const row of r.rows) {
    const linkRaw =
      typeof row.link_raw === "object"
        ? JSON.stringify(row.link_raw)
        : String(row.link_raw ?? "");
    rows.push(
      [
        esc(row.sort_index),
        esc(row.grn_id),
        esc(row.grn_status),
        esc(row.vendor_invoice_number),
        esc(row.created_at),
        esc(row.grn_accepted_quantity),
        esc(row.grn_rejected_quantity),
        esc(linkRaw),
      ].join(",")
    );
  }

  const csv = rows.join("\n") + "\n";
  return { csv, filename: `po-${poId}-grn-report.csv` };
}
