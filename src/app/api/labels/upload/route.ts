import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { parseCsvLine } from "@/lib/label-csv";
import { buildRotatedLabelsPdf, type LabelRow } from "@/server/services/labelPdfService";

/**
 * Full template: `public/samples/eCraftZap-label-date-template.csv` (includes `qrSequence`).
 * Legacy: same columns with `qrSequence` omitted (no QR image; EAN/Code128 still from `barcode`).
 */
const EXPECTED_HEADERS = [
  "barcode",
  "marketedBy",
  "manufacturedBy",
  "title",
  "dateOfManufacture",
  "color",
  "brand",
  "material",
  "netQuantity",
  "productDimension",
  "oneSetContains",
  "modelNumber",
  "mrp",
  "countryOfOrigin",
  "styleId",
  "qrSequence",
  "labelCount",
] as const;

/** 16-column files: `styleId` then `labelCount` (no `qrSequence`). */
const LEGACY_COLUMN_COUNT = 16;

function rowIsEmpty(cols: string[]): boolean {
  return cols.every((c) => !String(c ?? "").trim());
}

function headersMatchFull(headers: string[]): boolean {
  if (headers.length !== EXPECTED_HEADERS.length) return false;
  for (let i = 0; i < EXPECTED_HEADERS.length; i++) {
    if (headers[i] !== EXPECTED_HEADERS[i]) return false;
  }
  return true;
}

/** Legacy: columns 0–14 match full; column 15 is `labelCount` (no `qrSequence` column). */
function headersMatchLegacy(headers: string[]): boolean {
  if (headers.length !== LEGACY_COLUMN_COUNT) return false;
  for (let i = 0; i < 15; i++) {
    if (headers[i] !== EXPECTED_HEADERS[i]) return false;
  }
  return headers[15] === "labelCount";
}

function csvToLabelRow(cols: string[], legacy: boolean): LabelRow {
  const o = {} as Record<string, string>;
  if (legacy) {
    for (let i = 0; i < 15; i++) {
      o[EXPECTED_HEADERS[i]] = cols[i] ?? "";
    }
    o.qrSequence = "";
    o.labelCount = cols[15] ?? "";
  } else {
    for (let i = 0; i < EXPECTED_HEADERS.length; i++) {
      o[EXPECTED_HEADERS[i]] = cols[i] ?? "";
    }
  }
  return o as unknown as LabelRow;
}

/**
 * @swagger
 * /labels/upload:
 *   post:
 *     summary: Convert a labels CSV into a rotated labels PDF
 *     description: Requires labels:write.
 *     tags: [Labels]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       200: { description: PDF file }
 *       400: { description: Bad request }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
/**
 * POST multipart/form-data field `file` (.csv).
 * Validates header + data rows, returns **application/pdf** (rotated labels, same layout as reference).
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "labels", "write");

    const ct = request.headers.get("content-type") ?? "";
    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Expected multipart/form-data with field file" },
        { status: 400 }
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv")) {
      return NextResponse.json(
        { error: "File must be a .csv" },
        { status: 400 }
      );
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 1) {
      return NextResponse.json({ error: "Empty CSV" }, { status: 400 });
    }

    const headers = parseCsvLine(lines[0]);
    const legacy = headersMatchLegacy(headers);
    const full = headersMatchFull(headers);

    if (!legacy && !full) {
      return NextResponse.json(
        {
          error:
            "Unrecognized CSV header. Use 17 columns with qrSequence (see sample), or 16 columns without qrSequence (styleId, then labelCount).",
          expected: [...EXPECTED_HEADERS],
          got: headers,
        },
        { status: 400 }
      );
    }

    const colCount = legacy ? LEGACY_COLUMN_COUNT : EXPECTED_HEADERS.length;

    const labelRows: LabelRow[] = [];
    for (let li = 1; li < lines.length; li++) {
      const cols = parseCsvLine(lines[li]);
      if (cols.length !== colCount) {
        return NextResponse.json(
          {
            error: `Row ${li + 1}: expected ${colCount} columns, got ${cols.length}`,
          },
          { status: 400 }
        );
      }
      if (rowIsEmpty(cols)) continue;
      labelRows.push(csvToLabelRow(cols, legacy));
    }

    if (labelRows.length === 0) {
      return NextResponse.json(
        { error: "No data rows to print (all rows empty)" },
        { status: 400 }
      );
    }

    const pdfBytes = await buildRotatedLabelsPdf(labelRows);

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="rotated_labels.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
