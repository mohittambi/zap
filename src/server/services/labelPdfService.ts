import {
  PDFDocument,
  StandardFonts,
  rgb,
  degrees,
  type PDFPage,
  type PDFFont,
} from "pdf-lib";
import { toBuffer as barcodeToBuffer } from "bwip-js/node";

/**
 * 40mm × 70mm label, 90° page rotation.
 * **Fixed layout**: absolute X/Y for text; EAN-13 / Code128 barcode **only** as bwip-js PNG at **bottom center** (no QR).
 */
export const LABEL_PAGE_WIDTH_PT = 113.38582677165354;
export const LABEL_PAGE_HEIGHT_PT = 198.4251968503937;
export const LABEL_PAGE_WIDTH_75x38_PT = 107.71653543307087;
export const LABEL_PAGE_HEIGHT_75x38_PT = 212.5984251968504;

const MM_TO_PT = 2.834645669291339;

/** ~10mm inset from left/right — prevents clipped first letters ("nufactured"). */
const PAGE_MARGIN_H_PT = 10 * MM_TO_PT;
const TEXT_LEFT_PT = PAGE_MARGIN_H_PT;

/** Barcode band at bottom (fixed; does not push text — text Y max computed below this). */
const BARCODE_BOTTOM_MARGIN_PT = 10;
/** ~14% of label height — leaves room for 8pt text above without overlap. */
const BARCODE_DRAW_HEIGHT_PT = LABEL_PAGE_HEIGHT_PT * 0.14;
/** Gap between last text line and barcode graphic. */
const TEXT_ABOVE_BARCODE_GAP_PT = 8;

/** Lowest baseline for any text line (above barcode band). */
const TEXT_MIN_Y_PT =
  BARCODE_BOTTOM_MARGIN_PT + BARCODE_DRAW_HEIGHT_PT + TEXT_ABOVE_BARCODE_GAP_PT + 4;

/** 8pt body / 7pt small (readable; fits within bounds). */
const FS_SMALL = 7;
const FS_BODY = 8;
const LEADING_SMALL = 8.5;
const LEADING_BODY = 9.5;

/** Max digits from `qrSequence` (ignored for rendering — QR disabled). */
const QR_SEQUENCE_DIGIT_CAP = 4;

/** WinAnsi-safe text for StandardFonts. */
export function sanitizeLabelPdfText(text: string): string {
  return String(text ?? "")
    .replace(/\u20b9/g, "Rs.")
    .replace(/\u00a3/g, "GBP")
    .replace(/\u20ac/g, "EUR")
    .replace(/\u2014|\u2013/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\x00-\xff]/g, "?");
}

export type LabelRow = {
  barcode: string;
  marketedBy: string;
  manufacturedBy: string;
  title: string;
  dateOfManufacture: string;
  color: string;
  brand: string;
  material: string;
  netQuantity: string;
  productDimension: string;
  oneSetContains: string;
  modelNumber: string;
  mrp: string;
  countryOfOrigin: string;
  styleId: string;
  qrSequence: string;
  labelCount: string;
};

function formatMrp(mrp: string): string {
  const n = Number.parseFloat(String(mrp).replace(/,/g, "").trim());
  if (Number.isNaN(n)) return sanitizeLabelPdfText(String(mrp ?? ""));
  return n.toFixed(2);
}

function ean13CheckDigit12(d12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = Number.parseInt(d12.charAt(i), 10);
    if (Number.isNaN(d)) return "";
    sum += i % 2 === 0 ? d : d * 3;
  }
  return String((10 - (sum % 10)) % 10);
}

export function normalizeEan13(barcode: string): string | null {
  const d = String(barcode ?? "").replace(/\D/g, "");
  if (d.length === 12) {
    const check = ean13CheckDigit12(d);
    if (!check) return null;
    return `${d}${check}`;
  }
  if (d.length === 13) {
    const check = ean13CheckDigit12(d.slice(0, 12));
    if (!check || check !== d[12]) return null;
    return d;
  }
  return null;
}

export function normalizeQrSequenceDigits(qrSequence: string): string {
  const d = String(qrSequence ?? "").replace(/\D/g, "");
  return d.slice(0, QR_SEQUENCE_DIGIT_CAP);
}

export type SplitBarcodeResult = {
  ean13: string | null;
  mergedQrDigits: string;
};

export function splitBarcodeInput(raw: string): SplitBarcodeResult {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (d.length >= 17) {
    const head = d.slice(0, 13);
    const ean13 = normalizeEan13(head);
    return {
      ean13,
      mergedQrDigits: d.slice(13, 13 + QR_SEQUENCE_DIGIT_CAP),
    };
  }
  if (d.length === 16) {
    const head = d.slice(0, 13);
    const ean13 = normalizeEan13(head);
    const tail = d.slice(13);
    return {
      ean13,
      mergedQrDigits: tail.length <= QR_SEQUENCE_DIGIT_CAP ? tail : tail.slice(0, QR_SEQUENCE_DIGIT_CAP),
    };
  }
  return { ean13: normalizeEan13(raw), mergedQrDigits: "" };
}

/**
 * Barcode graphic uses **`row.barcode` only** (never `modelNumber`).
 * `qrDigits` kept for CSV/API compatibility; **QR is not rendered**.
 */
export function resolveEanAndQrPayload(row: LabelRow): {
  linearPayload: string;
  bcid: "ean13" | "code128";
  qrDigits: string;
} {
  const primary = (row.barcode ?? "").trim();
  const split = splitBarcodeInput(primary);
  let qrDigits =
    normalizeQrSequenceDigits(row.qrSequence ?? "") || split.mergedQrDigits;

  if (split.ean13) {
    return {
      linearPayload: split.ean13,
      bcid: "ean13",
      qrDigits: qrDigits.slice(0, QR_SEQUENCE_DIGIT_CAP),
    };
  }

  const fallback = sanitizeLabelPdfText(primary || "0").slice(0, 80);
  return {
    linearPayload: primary ? fallback : "0",
    bcid: "code128",
    qrDigits: qrDigits.slice(0, QR_SEQUENCE_DIGIT_CAP),
  };
}

function wrapToWidth(
  text: string,
  maxWidth: number,
  font: PDFFont,
  size: number
): string[] {
  const t = sanitizeLabelPdfText(text).trim();
  if (!t) return [];
  const words = t.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const tryLine = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(tryLine, size) <= maxWidth) cur = tryLine;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Horizontal EAN-13 / Code128 PNG for bottom strip (no rotation — 1D bars vertical in symbol).
 */
async function makeLinearBarcodePng(
  payload: string,
  bcid: "ean13" | "code128"
): Promise<Uint8Array> {
  const t =
    bcid === "ean13"
      ? payload.replace(/\D/g, "").slice(0, 13)
      : sanitizeLabelPdfText(payload || "0").slice(0, 80);
  const buf = await barcodeToBuffer({
    bcid,
    text: t,
    scale: 2,
    height: 22,
    includetext: false,
  });
  return new Uint8Array(buf);
}

/** Fixed bottom barcode rectangle: full width inside horizontal margins. */
function bottomBarcodeRect(pageWidth: number): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return {
    x: PAGE_MARGIN_H_PT,
    y: BARCODE_BOTTOM_MARGIN_PT,
    width: Math.max(40, pageWidth - 2 * PAGE_MARGIN_H_PT),
    height: BARCODE_DRAW_HEIGHT_PT,
  };
}

type TextSeg = { y: number; size: number; leading: number; parts: string[] };

/**
 * Fixed Y baselines (absolute). Spacing tuned for 7–8pt fonts; all baselines ≥ TEXT_MIN_Y_PT.
 */
function buildSegments(
  row: LabelRow,
  font: PDFFont,
  contentW: number
): TextSeg[] {
  const segs: TextSeg[] = [];

  const marketedBlock: string[] = [
    "Marketed By/For Consumer",
    ...wrapToWidth(
      `Complaints: ${row.marketedBy || ""}`.trim(),
      contentW,
      font,
      FS_SMALL
    ),
  ];
  segs.push({
    y: 188,
    size: FS_SMALL,
    leading: LEADING_SMALL,
    parts: marketedBlock,
  });

  segs.push({
    y: 168,
    size: FS_SMALL,
    leading: LEADING_SMALL,
    parts: wrapToWidth(
      `Manufactured By: ${row.manufacturedBy || ""}`.trim(),
      contentW,
      font,
      FS_SMALL
    ),
  });
  segs.push({
    y: 150,
    size: FS_SMALL,
    leading: LEADING_SMALL,
    parts: wrapToWidth(`Title: ${row.title || ""}`.trim(), contentW, font, FS_SMALL),
  });
  segs.push({
    y: 135,
    size: FS_BODY,
    leading: LEADING_BODY,
    parts: wrapToWidth(
      `Date of Mfg.: ${row.dateOfManufacture || ""}`.trim(),
      contentW,
      font,
      FS_BODY
    ),
  });
  segs.push({
    y: 124,
    size: FS_BODY,
    leading: LEADING_BODY,
    parts: wrapToWidth(`Color: ${row.color || ""}`.trim(), contentW, font, FS_BODY),
  });
  segs.push({
    y: 113,
    size: FS_BODY,
    leading: LEADING_BODY,
    parts: wrapToWidth(`Brand: ${row.brand || ""}`.trim(), contentW, font, FS_BODY),
  });
  segs.push({
    y: 102,
    size: FS_SMALL,
    leading: LEADING_SMALL,
    parts: wrapToWidth(
      `Material: ${row.material || ""}`.trim(),
      contentW,
      font,
      FS_SMALL
    ),
  });
  segs.push({
    y: 91,
    size: FS_BODY,
    leading: LEADING_BODY,
    parts: wrapToWidth(
      `Net Quantity: ${row.netQuantity || ""}`.trim(),
      contentW,
      font,
      FS_BODY
    ),
  });
  segs.push({
    y: 80,
    size: FS_BODY,
    leading: LEADING_BODY,
    parts: wrapToWidth(
      `1 Set Contains: ${row.oneSetContains || ""}`.trim(),
      contentW,
      font,
      FS_BODY
    ),
  });
  segs.push({
    y: 69,
    size: FS_BODY,
    leading: LEADING_BODY,
    parts: wrapToWidth(
      `Product Dimension: ${row.productDimension || ""}`.trim(),
      contentW,
      font,
      FS_BODY
    ),
  });
  segs.push({
    y: 62,
    size: FS_BODY,
    leading: LEADING_BODY,
    parts: wrapToWidth(
      `Model Number: ${row.modelNumber || ""}`.trim(),
      contentW,
      font,
      FS_BODY
    ),
  });

  segs.push({
    y: 58,
    size: FS_BODY,
    leading: LEADING_BODY,
    parts: wrapToWidth(
      `M.R.P(INR): Rs. ${formatMrp(row.mrp || "0")}`,
      contentW,
      font,
      FS_BODY
    ),
  });
  segs.push({
    y: 48,
    size: FS_BODY,
    leading: LEADING_BODY,
    parts: wrapToWidth(
      `Country of Origin: ${row.countryOfOrigin || ""}`.trim(),
      contentW,
      font,
      FS_BODY
    ),
  });

  return segs;
}

/**
 * Fixed baselines: each segment has a declared top `seg.y`; if wrapped lines would fall
 * below `TEXT_MIN_Y_PT`, the whole segment is shifted up so the last line clears the barcode band
 * (no per-line clamp overlap).
 */
function drawTextSegments(page: PDFPage, font: PDFFont, segments: TextSeg[]) {
  for (const seg of segments) {
    const { size, leading, parts } = seg;
    if (parts.length === 0) continue;
    const minTop = TEXT_MIN_Y_PT + (parts.length - 1) * leading;
    let y = Math.max(seg.y, minTop);
    for (let i = 0; i < parts.length; i++) {
      page.drawText(parts[i], {
        x: TEXT_LEFT_PT,
        y: y - i * leading,
        size,
        font,
        color: rgb(0, 0, 0),
      });
    }
  }
}

async function buildRotatedLabelsPdfWithDimensions(
  rows: LabelRow[],
  widthPt: number,
  heightPt: number
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const W = widthPt;
  const H = heightPt;
  const contentW = W - 2 * PAGE_MARGIN_H_PT - 4;

  for (const row of rows) {
    const count = Math.max(1, Math.min(500, Number.parseInt(row.labelCount, 10) || 1));

    const { linearPayload, bcid } = resolveEanAndQrPayload(row);

    let barcodePng: Uint8Array | null = null;
    const skipBarcode = bcid === "code128" && linearPayload === "0";
    if (!skipBarcode) {
      try {
        barcodePng = await makeLinearBarcodePng(linearPayload, bcid);
      } catch {
        barcodePng = null;
      }
    }

    const barRect = bottomBarcodeRect(W);

    for (let c = 0; c < count; c++) {
      const page = pdfDoc.addPage([W, H]);
      page.setRotation(degrees(90));

      drawTextSegments(page, font, buildSegments(row, font, contentW));

      if (barcodePng) {
        const pngImage = await pdfDoc.embedPng(barcodePng);
        page.drawImage(pngImage, {
          x: barRect.x,
          y: barRect.y,
          width: barRect.width,
          height: barRect.height,
        });
      }
    }
  }

  return pdfDoc.save();
}

export async function buildRotatedLabelsPdf(rows: LabelRow[]): Promise<Uint8Array> {
  return buildRotatedLabelsPdfWithDimensions(
    rows,
    LABEL_PAGE_WIDTH_PT,
    LABEL_PAGE_HEIGHT_PT
  );
}

export async function buildLabelsPdf(
  rows: LabelRow[],
  labelSize: "70x40" | "75x38"
): Promise<Uint8Array> {
  if (labelSize === "75x38") {
    return buildRotatedLabelsPdfWithDimensions(
      rows,
      LABEL_PAGE_WIDTH_75x38_PT,
      LABEL_PAGE_HEIGHT_75x38_PT
    );
  }
  return buildRotatedLabelsPdf(rows);
}

function phase1DateStamp(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const mon = date.toLocaleString("en-US", { month: "short" });
  const year = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ampm = date.getHours() >= 12 ? "pm" : "am";
  return `${day} ${mon} ${year}, ${hh}:${mm} ${ampm}`;
}

export async function buildPhase1BoxLabelsPdf(
  startBox: number,
  endBox: number,
  companyInfo: string,
  labelSize: "70x40" | "75x38"
): Promise<Uint8Array> {
  const from = Math.trunc(startBox);
  const to = Math.trunc(endBox);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0 || to < from) {
    throw new Error("Invalid box-number range");
  }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pageW = labelSize === "75x38" ? LABEL_PAGE_WIDTH_75x38_PT : LABEL_PAGE_WIDTH_PT;
  const pageH = labelSize === "75x38" ? LABEL_PAGE_HEIGHT_75x38_PT : LABEL_PAGE_HEIGHT_PT;
  const companyLine = sanitizeLabelPdfText(companyInfo || "").trim() || "—";
  const stamp = phase1DateStamp(new Date());
  const total = to - from + 1;
  const barRect = bottomBarcodeRect(pageW);

  for (let box = from; box <= to; box++) {
    const idx = box - from + 1;
    const page = pdfDoc.addPage([pageW, pageH]);
    page.setRotation(degrees(90));

    page.drawText(`BOX NO. - ${box}`, {
      x: TEXT_LEFT_PT,
      y: pageH - 32,
      size: 13.5,
      font,
      color: rgb(0, 0, 0),
    });
    page.drawText(companyLine, {
      x: TEXT_LEFT_PT,
      y: pageH - 50,
      size: 9,
      font,
      color: rgb(0, 0, 0),
    });
    page.drawText(`Date: ${stamp}`, {
      x: TEXT_LEFT_PT,
      y: pageH - 64,
      size: 9,
      font,
      color: rgb(0, 0, 0),
    });
    page.drawText(`-- ${idx} of ${total} --`, {
      x: TEXT_LEFT_PT,
      y: 22,
      size: 9,
      font,
      color: rgb(0, 0, 0),
    });

    const boxText = String(box).padStart(4, "0");
    try {
      const png = await makeLinearBarcodePng(boxText, "code128");
      const pngImage = await pdfDoc.embedPng(png);
      page.drawImage(pngImage, {
        x: barRect.x,
        y: barRect.y + 10,
        width: barRect.width,
        height: Math.max(20, barRect.height + 8),
      });
    } catch {
      // keep PDF generation resilient even if barcode rendering fails
    }
  }

  return pdfDoc.save();
}
