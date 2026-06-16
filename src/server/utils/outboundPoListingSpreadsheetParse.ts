import * as XLSX from "xlsx";

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
    item_code: "po_secondary_sku",
    sku_id: "po_secondary_sku",
    sku_code: "po_secondary_sku",
    product_code: "po_secondary_sku",
    company_code_primary: "company_code_primary",
    primary_company_code: "company_code_primary",
    company_code_secondary: "company_code_secondary",
    secondary_company_code: "company_code_secondary",
    box_number: "box_number",
    box_no: "box_number",
    box_quantity: "box_quantity",
    quantity: "original_demand",
    box_name: "box_name",
    submitted_from: "submitted_from",
    mrp: "mrp",
    unit_mrp_inr: "mrp",
    original_demand: "original_demand",
    demand: "original_demand",
    qty: "original_demand",
    qty_ordered: "original_demand",
    total_quantity: "original_demand",
    dispatched_quantity: "dispatched_quantity",
    consignment_quantity: "consignment_quantity",
    overall_fill_rate: "overall_fill_rate",
    fill_rate: "overall_fill_rate",
    hsn_code: "hsn_code",
    hsn: "hsn_code",
    product_upc: "product_upc",
    upc: "product_upc",
    barcode: "product_upc",
    product_description: "title",
    description: "title",
    product_name: "title",
    title: "title",
    basic_cost_price: "rate_without_tax",
    cost_price: "rate_without_tax",
    rate: "rate_without_tax",
    landing_rate: "landing_rate",
    tax_rate: "tax_rate",
    gst_rate: "tax_rate",
    gst_: "tax_rate",
    gst_percent: "tax_rate",
    igst: "tax_rate",
    igst_: "tax_rate",
    igst_percent: "tax_rate",
    total_amt: "total_amount",
    total_amount: "total_amount",
    margin: "margin",
    margin_: "margin",
    remarks: "remarks",
    created_by: "created_by",
    created_at: "created_at",
    updated_at: "updated_at",
  };
  if (direct[norm]) return direct[norm];
  if (norm.includes("secondary") && norm.includes("sku")) return "po_secondary_sku";
  if (norm.includes("item") && norm.includes("code")) return "po_secondary_sku";
  if (norm.includes("company") && norm.includes("primary")) return "company_code_primary";
  if (norm.includes("company") && norm.includes("secondary")) return "company_code_secondary";
  if (norm.includes("box") && norm.includes("number")) return "box_number";
  if (norm.includes("box") && (norm.includes("qty") || norm.includes("quantity")))
    return "box_quantity";
  if (norm.includes("hsn")) return "hsn_code";
  if (norm.includes("upc") || norm.includes("barcode")) return "product_upc";
  if (norm.includes("description") || norm.includes("product_name")) return "title";
  if (
    norm.includes("qty") ||
    (norm.includes("quantity") && !norm.includes("box"))
  ) {
    return "original_demand";
  }
  if (norm.includes("landing") && norm.includes("rate")) return "landing_rate";
  if (norm.includes("igst")) return "tax_rate";
  if (norm.includes("gst")) return "tax_rate";
  if (norm.includes("tax") && norm.includes("rate")) return "tax_rate";
  if (norm.includes("cost") && norm.includes("price")) return "rate_without_tax";
  if (norm.includes("total") && norm.includes("amt")) return "total_amount";
  return null;
}

const INTEGER_FIELDS = new Set([
  "box_number",
  "box_quantity",
  "original_demand",
  "dispatched_quantity",
  "consignment_quantity",
]);

const DECIMAL_FIELDS = new Set([
  "mrp",
  "rate_without_tax",
  "tax_rate",
  "landing_rate",
  "total_amount",
  "margin",
  "overall_fill_rate",
]);

function coerceCell(field: string, v: unknown): unknown {
  if (v == null || v === "") return null;
  if (INTEGER_FIELDS.has(field)) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : String(v);
  }
  if (DECIMAL_FIELDS.has(field)) {
    const n = Number(v);
    return Number.isFinite(n) ? n : String(v);
  }
  return typeof v === "number" ? v : String(v).trim();
}

function isValidListingRow(row: Record<string, unknown>): boolean {
  const sku = row.po_secondary_sku;
  if (sku == null || String(sku).trim() === "") return false;
  const skuStr = String(sku).trim();
  if (/^total\b|^#$/i.test(skuStr)) return false;

  for (const key of ["title", "mrp", "product_upc"] as const) {
    const text = String(row[key] ?? "").trim();
    if (/^total\s|^net\s|cart\s*discount|total\s*amount|total\s*quantity/i.test(text)) {
      return false;
    }
  }
  return true;
}

function normalizeListingRow(row: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row };
  const demand = out.original_demand ?? out.box_quantity ?? out.demand;
  if (demand != null && demand !== "") {
    const n = Number(demand);
    if (Number.isFinite(n)) {
      out.original_demand = Math.trunc(n);
      out.demand = Math.trunc(n);
    }
  }
  if (out.po_secondary_sku != null) {
    out.po_secondary_sku = String(out.po_secondary_sku).trim();
  }
  return out;
}

function finalizeParsedRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map(normalizeListingRow).filter(isValidListingRow);
}

/** RFC 4180-style row split so inch marks and commas inside quoted titles stay intact. */
export function parseDelimitedRow(line: string, delim: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      cells.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

function parseCsv(buf: Buffer): Record<string, unknown>[] {
  const text = buf.toString("utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const delim = lines[0].includes("\t") && !lines[0].includes(",") ? "\t" : ",";
  const headerCells = parseDelimitedRow(lines[0], delim);
  const fieldNames = headerCells.map((h) => {
    const n = normHeader(h);
    return mapHeaderToField(n);
  });
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseDelimitedRow(lines[i], delim);
    const row: Record<string, unknown> = {};
    let any = false;
    for (let c = 0; c < fieldNames.length; c += 1) {
      const fn = fieldNames[c];
      if (!fn) continue;
      const val = coerceCell(fn, cells[c] ?? "");
      if (val != null && val !== "") {
        row[fn] = val;
        any = true;
      }
    }
    if (any) rows.push(row);
  }
  return finalizeParsedRows(rows);
}

function parseXlsx(buf: Buffer): Record<string, unknown>[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const name = wb.SheetNames[0];
  if (!name) return [];
  const sheet = wb.Sheets[name];
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
  }) as unknown[][];
  if (matrix.length < 2) return [];
  const headerRow = matrix[0] as unknown[];
  const fieldNames = headerRow.map((h) => {
    const s = h == null ? "" : String(h);
    const n = normHeader(s);
    return mapHeaderToField(n);
  });
  const rows: Record<string, unknown>[] = [];
  for (let r = 1; r < matrix.length; r += 1) {
    const line = matrix[r] as unknown[];
    const row: Record<string, unknown> = {};
    let any = false;
    for (let c = 0; c < fieldNames.length; c += 1) {
      const fn = fieldNames[c];
      if (!fn) continue;
      const val = coerceCell(String(fn), line[c]);
      if (val != null && val !== "") {
        row[String(fn)] = val;
        any = true;
      }
    }
    if (any) rows.push(row);
  }
  return finalizeParsedRows(rows);
}

/**
 * Parse CSV / XLSX into listing line objects; wrap for `listings_snapshot` (content array).
 */
export function parseOutboundPoLineItemsSpreadsheet(
  buf: Buffer,
  filename: string
): { content: Record<string, unknown>[] } {
  const lower = filename.toLowerCase();
  const rows = lower.endsWith(".csv")
    ? parseCsv(buf)
    : lower.endsWith(".xlsx") || lower.endsWith(".xls")
      ? parseXlsx(buf)
      : parseCsv(buf);
  return { content: rows };
}
