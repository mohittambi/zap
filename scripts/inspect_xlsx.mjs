#!/usr/bin/env node
/**
 * List workbook sheets, row counts, and first-row headers.
 * Usage: node scripts/inspect_xlsx.mjs [path/to/file.xlsx]
 * Env: SEED_XLSX_PATH
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const filePath =
  process.argv[2] ||
  process.env.SEED_XLSX_PATH ||
  path.join(root, "zap (1).xlsx");

if (!fs.existsSync(filePath)) {
  console.error("File not found:", filePath);
  process.exit(1);
}

const buf = fs.readFileSync(filePath);
const wb = XLSX.read(buf, { type: "buffer", cellDates: true });

console.log("File:", path.resolve(filePath));
console.log("Sheets:", wb.SheetNames.length);
console.log("");

for (const name of wb.SheetNames) {
  const sheet = wb.Sheets[name];
  const ref = sheet["!ref"];
  let rows = 0;
  if (ref) {
    const range = XLSX.utils.decode_range(ref);
    rows = range.e.r - range.s.r + 1;
  }
  const data = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: false,
  });
  const headerRow = data[1] ?? data[0];
  const headers = Array.isArray(headerRow)
    ? headerRow.map((h) => (h == null || h === "" ? null : String(h).trim()))
    : [];

  console.log("---");
  console.log("Sheet:", JSON.stringify(name));
  console.log("Rows (incl. header):", data.length || rows);
  console.log("Row 1 (headers):", headers.filter(Boolean).length, "cells");
  console.log(headers.map((h) => h ?? "(empty)").join(" | "));
  for (let i = 2; i <= Math.min(4, data.length - 1); i++) {
    const row = data[i];
    const preview = Array.isArray(row)
      ? row.slice(0, 12).map((c) => (c == null ? "" : String(c).slice(0, 60)))
      : [];
    console.log(`Row ${i} (sample):`, preview.join(" | "));
  }
}
