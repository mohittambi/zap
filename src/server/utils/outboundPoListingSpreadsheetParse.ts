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
  if (
    field === "box_number" ||
    field === "box_quantity" ||
    field === "original_demand" ||
    field === "dispatched_quantity" ||
    field === "consignment_quantity"
  ) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : String(v);
  }
  return typeof v === "number" ? v : String(v).trim();
}

function parseCsv(buf: Buffer): Record<string, unknown>[] {
  const text = buf.toString("utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const delim = lines[0].includes("\t") && !lines[0].includes(",") ? "\t" : ",";
  const headerCells = lines[0].split(delim).map((s) => s.replace(/^"|"$/g, "").trim());
  const fieldNames = headerCells.map((h) => {
    const n = normHeader(h);
    return mapHeaderToField(n);
  });
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = lines[i].split(delim).map((s) => s.replace(/^"|"$/g, "").trim());
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
  return rows;
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
  return rows;
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
