import * as XLSX from "xlsx";

export type CsvRowError = {
  row: number;
  field: string;
  message: string;
};

export type SpreadsheetParseResult = {
  content: Record<string, unknown>[];
  errors: CsvRowError[];
  missingColumns: string[];
};

/** Fields that must be present and non-empty in every data row. */
const MANDATORY_FIELDS: ReadonlyArray<string> = [
  "company_code_primary",
  "company_code_secondary",
  "original_demand",
  "hsn_code",
  "title",
  "mrp",
  "rate_without_tax",
  "tax_rate",
];

/** Fields that must be numeric (and >= 0). */
const NUMERIC_FIELDS = new Set([
  "box_number",
  "box_quantity",
  "original_demand",
  "dispatched_quantity",
  "consignment_quantity",
  "mrp",
  "rate_without_tax",
  "tax_rate",
]);

/** Fields that are integers (truncated). */
const INT_FIELDS = new Set([
  "box_number",
  "box_quantity",
  "original_demand",
  "dispatched_quantity",
  "consignment_quantity",
]);

function normHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/** Map header cell to eAutomate listing field names (see listings/paginated rows). */
function mapHeaderToField(norm: string): string | null {
  const direct: Record<string, string> = {
    po_secondary_sku: "po_secondary_sku",
    secondary_sku: "po_secondary_sku",
    sku: "po_secondary_sku",
    company_code_primary: "company_code_primary",
    primary_company_code: "company_code_primary",
    company_code_secondary: "company_code_secondary",
    secondary_company_code: "company_code_secondary",
    box_number: "box_number",
    box_no: "box_number",
    box_quantity: "box_quantity",
    quantity: "box_quantity",
    box_name: "box_name",
    submitted_from: "submitted_from",
    mrp: "mrp",
    original_demand: "original_demand",
    demand: "original_demand",
    dispatched_quantity: "dispatched_quantity",
    consignment_quantity: "consignment_quantity",
    overall_fill_rate: "overall_fill_rate",
    fill_rate: "overall_fill_rate",
    created_by: "created_by",
    created_at: "created_at",
    updated_at: "updated_at",
    hsn_code: "hsn_code",
    hsn: "hsn_code",
    title: "title",
    product_title: "title",
    rate_without_tax: "rate_without_tax",
    rate_excl_tax: "rate_without_tax",
    tax_rate: "tax_rate",
    gst_rate: "tax_rate",
  };
  if (direct[norm]) return direct[norm];
  if (norm.includes("secondary") && norm.includes("sku")) return "po_secondary_sku";
  if (norm.includes("company") && norm.includes("primary")) return "company_code_primary";
  if (norm.includes("company") && norm.includes("secondary")) return "company_code_secondary";
  if (norm.includes("box") && norm.includes("number")) return "box_number";
  if (norm.includes("box") && (norm.includes("qty") || norm.includes("quantity")))
    return "box_quantity";
  return null;
}

function coerceCell(field: string, v: unknown): unknown {
  if (v == null || v === "") return null;
  if (NUMERIC_FIELDS.has(field)) {
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v); // keep raw string so validation can flag it
    return INT_FIELDS.has(field) ? Math.trunc(n) : n;
  }
  return typeof v === "number" ? v : String(v).trim();
}

type RawRow = Record<string, unknown>;

function validateRow(row: RawRow, rowIndex: number): CsvRowError[] {
  const errs: CsvRowError[] = [];
  for (const field of MANDATORY_FIELDS) {
    const val = row[field];
    if (val == null || val === "") {
      errs.push({ row: rowIndex, field, message: `${field} is required` });
      continue;
    }
    if (NUMERIC_FIELDS.has(field)) {
      const n = Number(val);
      if (!Number.isFinite(n)) {
        errs.push({ row: rowIndex, field, message: `${field} must be a number (got "${val}")` });
        continue;
      }
      if (field === "original_demand" && n <= 0) {
        errs.push({ row: rowIndex, field, message: `${field} must be greater than 0` });
      }
      if ((field === "mrp" || field === "rate_without_tax" || field === "tax_rate") && n < 0) {
        errs.push({ row: rowIndex, field, message: `${field} must be 0 or greater` });
      }
    }
  }
  return errs;
}

function extractFieldNames(headerCells: string[]): (string | null)[] {
  return headerCells.map((h) => mapHeaderToField(normHeader(h)));
}

function detectMissingColumns(fieldNames: (string | null)[]): string[] {
  const present = new Set(fieldNames.filter(Boolean) as string[]);
  return MANDATORY_FIELDS.filter((f) => !present.has(f));
}

function buildRows(
  rawRows: { cells: (string | unknown)[]; index: number }[],
  fieldNames: (string | null)[]
): { rows: RawRow[]; errors: CsvRowError[] } {
  const rows: RawRow[] = [];
  const errors: CsvRowError[] = [];
  for (const { cells, index } of rawRows) {
    const row: RawRow = {};
    for (let c = 0; c < fieldNames.length; c += 1) {
      const fn = fieldNames[c];
      if (!fn) continue;
      const coerced = coerceCell(fn, cells[c] ?? "");
      if (coerced != null && coerced !== "") row[fn] = coerced;
    }
    const rowErrors = validateRow(row, index);
    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
    } else {
      rows.push(row);
    }
  }
  return { rows, errors };
}

function parseCsv(buf: Buffer): SpreadsheetParseResult {
  const text = buf.toString("utf8").replace(/^﻿/, ""); // strip BOM
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { content: [], errors: [], missingColumns: MANDATORY_FIELDS.slice() };
  }
  const delim = lines[0].includes("\t") && !lines[0].includes(",") ? "\t" : ",";

  const splitCsvLine = (line: string): string[] => {
    const cells: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else {
        if (ch === '"') inQ = true;
        else if (ch === delim) { cells.push(cur.trim()); cur = ""; }
        else cur += ch;
      }
    }
    cells.push(cur.trim());
    return cells;
  };

  const headerCells = splitCsvLine(lines[0]);
  const fieldNames = extractFieldNames(headerCells);
  const missingColumns = detectMissingColumns(fieldNames);
  if (missingColumns.length > 0) {
    return { content: [], errors: [], missingColumns };
  }

  const rawRows = lines.slice(1).map((line, i) => ({
    cells: splitCsvLine(line),
    index: i + 1,
  }));
  const { rows, errors } = buildRows(rawRows, fieldNames);
  return { content: rows, errors, missingColumns: [] };
}

function parseXlsx(buf: Buffer): SpreadsheetParseResult {
  const wb = XLSX.read(buf, { type: "buffer" });
  const name = wb.SheetNames[0];
  if (!name) return { content: [], errors: [], missingColumns: MANDATORY_FIELDS.slice() };
  const sheet = wb.Sheets[name];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
  if (matrix.length < 2) {
    return { content: [], errors: [], missingColumns: MANDATORY_FIELDS.slice() };
  }

  const headerRow = (matrix[0] as unknown[]).map((h) =>
    h == null ? "" : String(h)
  );
  const fieldNames = extractFieldNames(headerRow);
  const missingColumns = detectMissingColumns(fieldNames);
  if (missingColumns.length > 0) {
    return { content: [], errors: [], missingColumns };
  }

  const rawRows = matrix.slice(1).map((line, i) => ({
    cells: line as unknown[],
    index: i + 1,
  }));
  const { rows, errors } = buildRows(rawRows, fieldNames);
  return { content: rows, errors, missingColumns: [] };
}

/**
 * Parse CSV / XLSX into listing line objects with mandatory-field validation.
 * Returns `errors` (per-row field errors) and `missingColumns` (headers absent from the file).
 * Only rows that pass validation are included in `content`.
 */
export function parseOutboundPoLineItemsSpreadsheet(
  buf: Buffer,
  filename: string
): SpreadsheetParseResult {
  const lower = filename.toLowerCase();
  return lower.endsWith(".csv")
    ? parseCsv(buf)
    : lower.endsWith(".xlsx") || lower.endsWith(".xls")
      ? parseXlsx(buf)
      : parseCsv(buf);
}
