import * as XLSX from "xlsx";
import { parseDelimitedRow } from "@/server/utils/csvParse";

export type ParsedConsignmentPackingRow = {
  rowNumber: number;
  box_number: number;
  box_name: string;
  po_secondary_sku: string;
  quantity: number;
  company_code_primary: string | null;
  company_code_secondary: string | null;
};

export type ConsignmentPackingParseError = {
  row: number;
  field: string;
  message: string;
};

export type ConsignmentPackingParseResult = {
  rows: ParsedConsignmentPackingRow[];
  errors: ConsignmentPackingParseError[];
};

function normHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

type PackingField =
  | "box_number"
  | "box_name"
  | "po_secondary_sku"
  | "quantity"
  | "company_code_primary"
  | "company_code_secondary";

function mapHeaderToField(norm: string): PackingField | null {
  const direct: Record<string, PackingField> = {
    bin_number: "box_number",
    box_number: "box_number",
    box_no: "box_number",
    bin_no: "box_number",
    bin_name: "box_name",
    box_name: "box_name",
    bin_type: "box_name",
    box_type: "box_name",
    po_secondary_sku: "po_secondary_sku",
    secondary_sku: "po_secondary_sku",
    sku: "po_secondary_sku",
    item_code: "po_secondary_sku",
    sku_id: "po_secondary_sku",
    sku_code: "po_secondary_sku",
    product_code: "po_secondary_sku",
    quantity: "quantity",
    qty: "quantity",
    box_quantity: "quantity",
    bin_quantity: "quantity",
    company_code_primary: "company_code_primary",
    primary_company_code: "company_code_primary",
    company_code_secondary: "company_code_secondary",
    secondary_company_code: "company_code_secondary",
    ean: "company_code_primary",
    barcode: "company_code_secondary",
    upc: "company_code_secondary",
  };
  if (direct[norm]) return direct[norm];
  if (norm.includes("bin") && norm.includes("number")) return "box_number";
  if (norm.includes("box") && norm.includes("number")) return "box_number";
  if (norm.includes("bin") && norm.includes("name")) return "box_name";
  if (norm.includes("box") && norm.includes("name")) return "box_name";
  if (norm.includes("item") && norm.includes("code")) return "po_secondary_sku";
  if (norm.includes("secondary") && norm.includes("sku")) return "po_secondary_sku";
  if (norm.includes("company") && norm.includes("primary")) return "company_code_primary";
  if (norm.includes("company") && norm.includes("secondary")) return "company_code_secondary";
  if (norm.includes("qty") || norm.includes("quantity")) return "quantity";
  return null;
}

export function userFacingField(field: PackingField): string {
  switch (field) {
    case "box_number":
      return "Bin Number";
    case "box_name":
      return "Bin Name";
    case "po_secondary_sku":
      return "Item Code";
    case "quantity":
      return "Quantity";
    case "company_code_primary":
      return "Company Code Primary";
    case "company_code_secondary":
      return "Company Code Secondary";
    default:
      return field;
  }
}

function parsePositiveInt(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.trunc(n);
}

function parseStr(v: unknown, maxLen?: number): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return maxLen != null ? s.slice(0, maxLen) : s;
}

function finalizeRow(
  rowNumber: number,
  raw: Partial<Record<PackingField, unknown>>
): { row?: ParsedConsignmentPackingRow; errors: ConsignmentPackingParseError[] } {
  const errors: ConsignmentPackingParseError[] = [];
  const boxNumber = parsePositiveInt(raw.box_number);
  const boxName = parseStr(raw.box_name, 120);
  const sku = parseStr(raw.po_secondary_sku, 120);
  const quantity = parsePositiveInt(raw.quantity);

  if (boxNumber == null) {
    errors.push({
      row: rowNumber,
      field: userFacingField("box_number"),
      message: "Bin Number must be a positive integer",
    });
  }
  if (!boxName) {
    errors.push({
      row: rowNumber,
      field: userFacingField("box_name"),
      message: "Bin Name is required",
    });
  }
  if (!sku) {
    errors.push({
      row: rowNumber,
      field: userFacingField("po_secondary_sku"),
      message: "Item Code is required",
    });
  }
  if (quantity == null) {
    errors.push({
      row: rowNumber,
      field: userFacingField("quantity"),
      message: "Quantity must be a positive integer",
    });
  }

  if (errors.length > 0) return { errors };

  return {
    row: {
      rowNumber,
      box_number: boxNumber!,
      box_name: boxName!,
      po_secondary_sku: sku!,
      quantity: quantity!,
      company_code_primary: parseStr(raw.company_code_primary, 120),
      company_code_secondary: parseStr(raw.company_code_secondary, 120),
    },
    errors,
  };
}

function parseMatrix(matrix: unknown[][]): ConsignmentPackingParseResult {
  if (matrix.length < 2) {
    return {
      rows: [],
      errors: [{ row: 1, field: "Header", message: "Spreadsheet must include a header row and at least one data row" }],
    };
  }
  const headerRow = matrix[0] as unknown[];
  const fieldNames = headerRow.map((h) => {
    const s = h == null ? "" : String(h);
    return mapHeaderToField(normHeader(s));
  });

  const hasBinNumber = fieldNames.includes("box_number");
  const hasBinName = fieldNames.includes("box_name");
  const hasSku = fieldNames.includes("po_secondary_sku");
  const hasQty = fieldNames.includes("quantity");
  const headerErrors: ConsignmentPackingParseError[] = [];
  if (!hasBinNumber) {
    headerErrors.push({
      row: 1,
      field: "Header",
      message: "Missing required column: Bin Number",
    });
  }
  if (!hasBinName) {
    headerErrors.push({
      row: 1,
      field: "Header",
      message: "Missing required column: Bin Name",
    });
  }
  if (!hasSku) {
    headerErrors.push({
      row: 1,
      field: "Header",
      message: "Missing required column: Item Code",
    });
  }
  if (!hasQty) {
    headerErrors.push({
      row: 1,
      field: "Header",
      message: "Missing required column: Quantity",
    });
  }
  if (headerErrors.length > 0) {
    return { rows: [], errors: headerErrors };
  }

  const rows: ParsedConsignmentPackingRow[] = [];
  const errors: ConsignmentPackingParseError[] = [];

  for (let r = 1; r < matrix.length; r += 1) {
    const line = matrix[r] as unknown[];
    const raw: Partial<Record<PackingField, unknown>> = {};
    let any = false;
    for (let c = 0; c < fieldNames.length; c += 1) {
      const fn = fieldNames[c];
      if (!fn) continue;
      const val = line[c];
      if (val != null && val !== "") {
        raw[fn] = val;
        any = true;
      }
    }
    if (!any) continue;
    const rowNumber = r + 1;
    const parsed = finalizeRow(rowNumber, raw);
    if (parsed.row) rows.push(parsed.row);
    errors.push(...parsed.errors);
  }

  return { rows, errors };
}

function parseCsv(buf: Buffer): ConsignmentPackingParseResult {
  const text = buf.toString("utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return {
      rows: [],
      errors: [{ row: 1, field: "Header", message: "CSV must include a header row and at least one data row" }],
    };
  }
  const delim = lines[0].includes("\t") && !lines[0].includes(",") ? "\t" : ",";
  const matrix: unknown[][] = lines.map((line) => parseDelimitedRow(line, delim));
  return parseMatrix(matrix);
}

function parseXlsx(buf: Buffer): ConsignmentPackingParseResult {
  const wb = XLSX.read(buf, { type: "buffer" });
  const name = wb.SheetNames[0];
  if (!name) {
    return { rows: [], errors: [{ row: 1, field: "Header", message: "Workbook has no sheets" }] };
  }
  const sheet = wb.Sheets[name];
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
  }) as unknown[][];
  return parseMatrix(matrix);
}

export function parseConsignmentPackingSpreadsheet(
  buf: Buffer,
  filename: string
): ConsignmentPackingParseResult {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    return parseXlsx(buf);
  }
  return parseCsv(buf);
}

export type GroupedConsignmentBin = {
  box_number: number;
  box_name: string;
  items: {
    po_secondary_sku: string;
    quantity: number;
    company_code_primary: string | null;
    company_code_secondary: string | null;
  }[];
};

export function groupPackingRowsByBin(
  rows: ParsedConsignmentPackingRow[]
): GroupedConsignmentBin[] {
  const map = new Map<string, GroupedConsignmentBin>();
  for (const row of rows) {
    const key = `${row.box_number}::${row.box_name.toLowerCase()}`;
    let group = map.get(key);
    if (!group) {
      group = {
        box_number: row.box_number,
        box_name: row.box_name,
        items: [],
      };
      map.set(key, group);
    }
    group.items.push({
      po_secondary_sku: row.po_secondary_sku,
      quantity: row.quantity,
      company_code_primary: row.company_code_primary,
      company_code_secondary: row.company_code_secondary,
    });
  }
  return [...map.values()].sort((a, b) => a.box_number - b.box_number);
}
