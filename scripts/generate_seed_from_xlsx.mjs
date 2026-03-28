#!/usr/bin/env node
/**
 * Generate web/seeds/003_zap_from_xlsx.sql from a Numbers/Excel export.
 * Usage: node scripts/generate_seed_from_xlsx.mjs [path/to/file.xlsx] [output.sql]
 * Env: SEED_XLSX_PATH, SEED_SQL_OUT
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const mappingPath = path.join(__dirname, "seed-xlsx-mapping.json");
const mapping = JSON.parse(fs.readFileSync(mappingPath, "utf8"));

const xlsxPath =
  process.argv[2] ||
  process.env.SEED_XLSX_PATH ||
  path.join(root, "zap (1).xlsx");

const outPath =
  process.argv[3] ||
  process.env.SEED_SQL_OUT ||
  path.join(root, "seeds", "003_zap_from_xlsx.sql");

const CHUNK = 400;

if (!fs.existsSync(xlsxPath)) {
  console.error("File not found:", xlsxPath);
  process.exit(1);
}

const buf = fs.readFileSync(xlsxPath);
const wb = XLSX.read(buf, { type: "buffer", cellDates: true });

/**
 * Collect normalized string ids from a sheet (for FK checks against truncated exports).
 * @param {string} tableKey
 * @param {string} dbColumn — key in columnMap
 */
function collectIdSetFromSheet(tableKey, dbColumn) {
  const cfg = mapping.tables[tableKey];
  if (!cfg) return new Set();
  const sheet = wb.Sheets[cfg.sheet];
  if (!sheet) return new Set();
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: false,
  });
  const headerRow = matrix[mapping.headerRowIndex ?? 1];
  if (!headerRow) return new Set();
  const dbToCol = buildHeaderIndex(headerRow, cfg.columnMap);
  const colIdx = dbToCol[dbColumn];
  if (colIdx === undefined) return new Set();
  const out = new Set();
  for (const row of matrix.slice(mapping.dataStartRow ?? 3)) {
    if (isEmptyRow(row)) continue;
    const v = normalizeNa(row[colIdx]);
    if (v !== null) out.add(String(v).trim());
  }
  return out;
}

const listingSkuIds = collectIdSetFromSheet("listings", "sku_id");
const warehouseIds = collectIdSetFromSheet("warehouses", "id");
const vendorIds = collectIdSetFromSheet("vendors", "id");

const headerRowIndex = mapping.headerRowIndex ?? 1;
const dataStartRow = mapping.dataStartRow ?? 3;
const skipSheets = new Set(mapping.skipSheets ?? []);

/** @type {Record<string, number>} */
const rowCounters = {};

function nextId(tableKey) {
  rowCounters[tableKey] = (rowCounters[tableKey] ?? 0) + 1;
  return rowCounters[tableKey];
}

function normalizeNa(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const t = value.trim();
    if (t === "" || t.toUpperCase() === "NA" || t === "N/A") return null;
    return t;
  }
  return value;
}

function toSqlString(s) {
  if (s === null || s === undefined) return "NULL";
  return "'" + String(s).replace(/'/g, "''") + "'";
}

function toSqlNumber(n) {
  if (n === null || n === undefined || n === "") return "NULL";
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return "NULL";
  return String(x);
}

function toSqlInt(n) {
  if (n === null || n === undefined || n === "") return "NULL";
  const x = typeof n === "number" ? n : Number.parseInt(String(n).replace(/,/g, ""), 10);
  if (!Number.isFinite(x)) return "NULL";
  return String(Math.trunc(x));
}

/** BIGINT / INT columns that must be unquoted in SQL */
function toSqlBigint(v) {
  if (v === null || v === undefined || v === "") return "NULL";
  const x = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  if (!Number.isFinite(x)) return "NULL";
  return String(Math.trunc(x));
}

function toSqlBoolFromYesNo(v) {
  const s = normalizeNa(v);
  if (s === null) return "NULL";
  const u = String(s).toUpperCase();
  if (u === "YES" || u === "TRUE" || u === "1") return "TRUE";
  if (u === "NO" || u === "FALSE" || u === "0") return "FALSE";
  return "NULL";
}

function toSqlBool(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return toSqlBoolFromYesNo(v);
}

function parseDate(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  const s = normalizeNa(v);
  if (s === null) return null;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;
  return null;
}

function toSqlTimestamp(v) {
  const d = parseDate(v);
  if (!d) return "NULL";
  return `'${d.toISOString()}'::timestamptz`;
}

function toSqlDateOnly(v) {
  const d = parseDate(v);
  if (!d) return "NULL";
  return `'${d.toISOString().slice(0, 10)}'::date`;
}

function toSqlJsonb(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "object") {
    return toSqlString(JSON.stringify(v)) + "::jsonb";
  }
  const s = String(v).trim();
  if (s === "") return "NULL";
  try {
    JSON.parse(s);
    return toSqlString(s) + "::jsonb";
  } catch {
    return toSqlString(s) + "::jsonb";
  }
}

function toSqlNumeric(v) {
  if (v === null || v === undefined || v === "") return "NULL";
  const x = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  if (!Number.isFinite(x)) return "NULL";
  return String(x);
}

/**
 * Infer SQL expression for a column value
 * @param {string} tableKey
 * @param {string} col
 * @param {unknown} raw
 */
function cellToSql(tableKey, col, raw) {
  const v = normalizeNa(raw);
  if (v === null) return "NULL";

  if (
    col === "id" ||
    col === "warehouse_id" ||
    col === "vendor_id"
  ) {
    return toSqlBigint(v);
  }

  // Table-specific typing
  if (col === "inventory_bypass_on") {
    return toSqlString(v === null ? null : String(v).toUpperCase() === "YES" ? "YES" : "NO");
  }
  if (col === "is_active" && tableKey === "forms") {
    const u = String(v).toUpperCase();
    if (u === "YES" || u === "TRUE" || u === "1") return "1";
    if (u === "NO" || u === "FALSE" || u === "0") return "0";
    return toSqlInt(v);
  }
  if (col === "form_payload" && tableKey === "forms") {
    return toSqlJsonb(v);
  }
  if (col === "raw_data") {
    return "NULL";
  }
  if (
    col.endsWith("_at") ||
    col === "created_at" ||
    col === "updated_at" ||
    col === "fetched_at" ||
    col === "po_issue_date" ||
    col === "expiry_date"
  ) {
    return toSqlTimestamp(v);
  }
  if (col === "summary_date" || col === "expected_date") {
    return toSqlDateOnly(v);
  }
  if (
    col === "quantity" ||
    col === "demand" ||
    col === "no_of_constituents" ||
    col === "dispatched_quantity" ||
    col === "packed_quantity" ||
    col === "inward_30d" ||
    col === "inward_60d" ||
    col === "inward_90d" ||
    col === "outward_30d" ||
    col === "outward_60d" ||
    col === "outward_90d" ||
    col === "available_quantity" ||
    col === "ais_quantity" ||
    col === "version"
  ) {
    return toSqlInt(v);
  }
  if (
    col === "actual_weight" ||
    col === "bulk_price" ||
    col === "cost_price" ||
    col === "mrp" ||
    col === "rate_without_tax" ||
    col === "tax_rate"
  ) {
    return toSqlNumeric(v);
  }
  if (col === "is_deleted") {
    return toSqlBool(v);
  }
  if (col === "hsn_code") {
    return toSqlString(String(v));
  }

  // Coerce bigint / phone that might be floats
  if (
    col === "vendor_contact_number" ||
    col === "vendor_postal_code" ||
    col === "sku_id" ||
    col.endsWith("_sku_id") ||
    col === "secondary_sku" ||
    col === "bin_id" ||
    col === "user_id"
  ) {
    if (typeof v === "number") return toSqlString(String(Math.round(v)));
    return toSqlString(String(v));
  }

  if (typeof v === "number" && Number.isInteger(v) && Math.abs(v) < 1e15) {
    return String(v);
  }

  return toSqlString(String(v));
}

function buildHeaderIndex(headerRow, columnMap) {
  /** @type {Record<string, number>} */
  const idx = {};
  for (let i = 0; i < headerRow.length; i++) {
    const h = headerRow[i];
    if (h == null || h === "") continue;
    idx[String(h).trim()] = i;
  }
  /** @type {Record<string, number>} */
  const dbToCol = {};
  for (const [excelName, dbCol] of Object.entries(columnMap)) {
    if (idx[excelName] === undefined) {
      throw new Error(`Missing column "${excelName}" in sheet (check seed-xlsx-mapping.json)`);
    }
    dbToCol[dbCol] = idx[excelName];
  }
  return dbToCol;
}

function rowToObject(row, dbToCol) {
  /** @type {Record<string, unknown>} */
  const o = {};
  for (const [dbCol, colIdx] of Object.entries(dbToCol)) {
    o[dbCol] = row[colIdx];
  }
  return o;
}

function isEmptyRow(row) {
  if (!row || !row.length) return true;
  return row.every((c) => c === null || c === undefined || String(c).trim() === "");
}

function emitInsert(tableKey, cfg, rows, cols) {
  const sqlTable = cfg.sqlTable;
  const conflict = cfg.conflict;
  const updateCols = cfg.updateColumns ?? [];

  const lines = [];
  const colList = cols.join(", ");

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const valueLines = chunk.map((vals) => `(${vals.join(", ")})`);
    let stmt = `INSERT INTO ${sqlTable} (${colList})\nVALUES\n${valueLines.join(",\n")}`;
    if (conflict) {
      const targets = conflict.split(",").map((c) => c.trim());
      const sets = updateCols
        .filter((c) => cols.includes(c))
        .map((c) => c + " = EXCLUDED." + c);
      if (sets.length === 0) {
        stmt += `\nON CONFLICT (${targets.join(", ")}) DO NOTHING;`;
      } else {
        stmt += `\nON CONFLICT (${targets.join(", ")}) DO UPDATE SET\n  ${sets.join(",\n  ")};`;
      }
    } else {
      stmt += ";";
    }
    lines.push(stmt);
  }
  return lines.join("\n\n");
}

function processTable(tableKey) {
  const cfg = mapping.tables[tableKey];
  if (!cfg) {
    throw new Error(`Unknown table key: ${tableKey}`);
  }
  const sheetName = cfg.sheet;
  if (skipSheets.has(sheetName)) return { rows: [], cols: [], sql: "" };

  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    console.warn(`Warning: missing sheet "${sheetName}" — skipping ${tableKey}`);
    return { rows: [], cols: [], sql: "" };
  }

  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: false,
  });

  const headerRow = matrix[headerRowIndex];
  if (!headerRow) {
    throw new Error(`No header row at index ${headerRowIndex} in sheet ${sheetName}`);
  }

  const dbToCol = buildHeaderIndex(headerRow, cfg.columnMap);
  const dataRows = matrix.slice(dataStartRow).filter((r) => !isEmptyRow(r));

  const defaults = cfg.defaults ?? {};
  const idColumn = cfg.idColumn;
  const idStrategy = cfg.idStrategy;

  /** @type {Array<Record<string, string>>} */
  const sqlRows = [];

  for (const row of dataRows) {
    const obj = rowToObject(row, dbToCol);
    if (cfg.requiredNonNull) {
      let skip = false;
      for (const col of cfg.requiredNonNull) {
        if (normalizeNa(obj[col]) === null) {
          skip = true;
          break;
        }
      }
      if (skip) continue;
    }

    // FK safety: skip rows referencing SKUs/warehouses/vendors not present in this export
    if (tableKey === "listing_order_details") {
      const s = normalizeNa(obj.po_secondary_sku);
      if (s === null || !listingSkuIds.has(String(s).trim())) continue;
    }
    if (tableKey === "bins") {
      const w = normalizeNa(obj.warehouse_id);
      const s = normalizeNa(obj.sku_id);
      if (
        w === null ||
        s === null ||
        !warehouseIds.has(String(w).trim()) ||
        !listingSkuIds.has(String(s).trim())
      ) {
        continue;
      }
    }
    if (tableKey === "pack_combos") {
      const p = normalizeNa(obj.parent_sku_id);
      const c = normalizeNa(obj.component_sku_id);
      if (
        p === null ||
        c === null ||
        !listingSkuIds.has(String(p).trim()) ||
        !listingSkuIds.has(String(c).trim())
      ) {
        continue;
      }
    }
    if (tableKey === "vendor_sku") {
      const v = normalizeNa(obj.vendor_id);
      const s = normalizeNa(obj.sku_id);
      if (
        v === null ||
        s === null ||
        !vendorIds.has(String(v).trim()) ||
        !listingSkuIds.has(String(s).trim())
      ) {
        continue;
      }
    }
    if (tableKey === "warehouse_inventory_dump") {
      const w = normalizeNa(obj.warehouse_id);
      const s = normalizeNa(obj.sku_id);
      if (
        w === null ||
        s === null ||
        !warehouseIds.has(String(w).trim()) ||
        !listingSkuIds.has(String(s).trim())
      ) {
        continue;
      }
    }
    if (tableKey === "sku_analytics") {
      const s = normalizeNa(obj.sku_id);
      if (s === null || !listingSkuIds.has(String(s).trim())) continue;
    }
    if (tableKey === "inbound_summary" || tableKey === "incoming_quantity") {
      const s = normalizeNa(obj.sku_id);
      if (s === null || !listingSkuIds.has(String(s).trim())) continue;
    }

    /** @type {Record<string, string>} */
    const sqlVals = {};

    if (idColumn && idStrategy === "row_sequence") {
      sqlVals[idColumn] = String(nextId(tableKey));
    }

    for (const [dbCol, raw] of Object.entries(obj)) {
      sqlVals[dbCol] = cellToSql(tableKey, dbCol, raw);
    }

    for (const [dbCol, defVal] of Object.entries(defaults)) {
      if (sqlVals[dbCol] !== undefined) continue;
      if (defVal === "NOW()") sqlVals[dbCol] = "NOW()";
      else if (defVal === null) sqlVals[dbCol] = "NULL";
      else if (typeof defVal === "boolean") sqlVals[dbCol] = defVal ? "TRUE" : "FALSE";
      else if (typeof defVal === "number") sqlVals[dbCol] = String(defVal);
      else sqlVals[dbCol] = toSqlString(String(defVal));
    }

    if (cfg.requiredNonNull) {
      let bad = false;
      for (const col of cfg.requiredNonNull) {
        const v = sqlVals[col];
        if (v === "NULL" || v === undefined) {
          bad = true;
          break;
        }
      }
      if (bad) continue;
    }

    sqlRows.push(sqlVals);
  }

  if (sqlRows.length === 0) {
    return { rows: [], cols: [], sql: "" };
  }

  const cols = Object.keys(sqlRows[0]);
  const values = sqlRows.map((vals) => cols.map((c) => vals[c]));

  return {
    rows: values,
    cols,
    sql: emitInsert(tableKey, cfg, values, cols),
  };
}

const deleteFirst = [
  "warehouse_inventory_dump",
  "pack_combos",
  "sku_analytics",
  "inbound_summary",
  "incoming_quantity",
];

const parts = [];
parts.push(`-- Generated from ${path.basename(xlsxPath)} — do not edit by hand`);
parts.push(`-- Generator: scripts/generate_seed_from_xlsx.mjs`);
parts.push("");
parts.push("BEGIN;");
parts.push("");

for (const name of deleteFirst) {
  const cfg = mapping.tables[name];
  if (cfg?.deleteBeforeInsert) {
    parts.push(`DELETE FROM ${cfg.sqlTable};`);
  }
}
parts.push("");

for (const tableKey of mapping.insertOrder) {
  const cfg = mapping.tables[tableKey];
  if (!cfg) continue;
  const { sql } = processTable(tableKey);
  if (sql) {
    parts.push(`-- ${cfg.sqlTable}`);
    parts.push(sql);
    parts.push("");
  }
}

parts.push("COMMIT;");
parts.push("");

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, parts.join("\n"), "utf8");
console.log("Wrote", outPath);
