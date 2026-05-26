/**
 * Seed company_ean_mappings from EAN Code Dump File.xlsx at repo root.
 *
 * Env: DATABASE_URL (required)
 *
 * Usage:
 *   npm run seed:ean-mappings
 *   npx tsx scripts/seed-ean-mappings.ts
 *   npx tsx scripts/seed-ean-mappings.ts --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import XLSX from "xlsx";
import { query } from "../src/server/db";
import {
  eanValueToString,
  isValidEanValue,
  normalizeCompanyName,
} from "../src/server/services/eanMappingsService";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..");
const repoRoot = path.join(webRoot, "..");

dotenv.config({ path: path.join(webRoot, ".env.local") });
dotenv.config({ path: path.join(webRoot, ".env") });

type ColumnDef = {
  columnKey: string;
  excelHeader: string;
  label: string;
  eanType: string;
  /** Normalized substrings; company matches if normalized name includes any token. */
  companyTokens: string[];
};

const COLUMN_DEFS: ColumnDef[] = [
  {
    columnKey: "zepto_ean",
    excelHeader: "EAN ( ZEPTO )",
    label: "EAN (ZEPTO)",
    eanType: "ean",
    companyTokens: ["zepto"],
  },
  {
    columnKey: "swiggy_item_code",
    excelHeader: "Item Code ( Swiggy )",
    label: "Item Code (Swiggy)",
    eanType: "item_code",
    companyTokens: ["swiggy"],
  },
  {
    columnKey: "myntra_sku",
    excelHeader: "SKU code ( Myntra )",
    label: "SKU code (Myntra)",
    eanType: "sku_code",
    companyTokens: ["myntra"],
  },
  {
    columnKey: "pepperfry_sku",
    excelHeader: "SKU ( Pepperfry )",
    label: "SKU (Pepperfry)",
    eanType: "sku_code",
    companyTokens: ["pepperfry"],
  },
  {
    columnKey: "blinkit_code",
    excelHeader: "Blink it",
    label: "Blinkit",
    eanType: "code",
    companyTokens: ["blinkit", "blink"],
  },
  {
    columnKey: "bigbasket_code",
    excelHeader: "big basket",
    label: "Big Basket",
    eanType: "code",
    companyTokens: ["bigbasket", "big basket"],
  },
  {
    columnKey: "flipkart_code",
    excelHeader: "Flipkart",
    label: "Flipkart",
    eanType: "code",
    companyTokens: ["flipkart"],
  },
  {
    columnKey: "dmart_code",
    excelHeader: "Dmart",
    label: "Dmart",
    eanType: "code",
    companyTokens: ["dmart"],
  },
  {
    columnKey: "vaaree_code",
    excelHeader: "Vaaree",
    label: "Vaaree",
    eanType: "code",
    companyTokens: ["vaaree"],
  },
  {
    columnKey: "amazon_asin",
    excelHeader: "ASIN ( Amazon )",
    label: "ASIN (Amazon)",
    eanType: "asin",
    companyTokens: ["amazon"],
  },
];

function findHeaderIndex(headers: string[], target: string): number {
  const norm = (s: string) => s.trim().toLowerCase();
  const t = norm(target);
  let idx = headers.findIndex((h) => norm(h) === t);
  if (idx >= 0) return idx;
  idx = headers.findIndex((h) => norm(h).includes(t) || t.includes(norm(h)));
  return idx;
}

function resolveCompanyId(
  companies: { id: number; name: string | null }[],
  tokens: string[]
): number | null {
  for (const c of companies) {
    const n = normalizeCompanyName(c.name ?? "");
    if (!n) continue;
    for (const tok of tokens) {
      const t = normalizeCompanyName(tok);
      if (n.includes(t) || t.includes(n)) return c.id;
    }
  }
  return null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const xlsxPath = path.join(repoRoot, "EAN Code Dump File.xlsx");
  if (!fs.existsSync(xlsxPath)) {
    console.error(`Missing file: ${xlsxPath}`);
    process.exit(1);
  }

  const wb = XLSX.readFile(xlsxPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
  if (data.length < 2) {
    console.error("XLSX has no data rows");
    process.exit(1);
  }

  const headers = (data[0] as unknown[]).map((h) => String(h));
  const skuIdx = findHeaderIndex(headers, "SKU Code");
  const ean1Idx = findHeaderIndex(headers, "EAN 1");
  if (skuIdx < 0) {
    console.error("SKU Code column not found");
    process.exit(1);
  }

  const companiesR = await query(`SELECT id, name FROM companies ORDER BY id`);
  const companies = companiesR.rows.map((r) => ({
    id: Number(r.id),
    name: r.name != null ? String(r.name) : null,
  }));

  const colBindings: {
    def: ColumnDef;
    headerIdx: number;
    companyId: number | null;
  }[] = [];

  for (const def of COLUMN_DEFS) {
    const headerIdx = findHeaderIndex(headers, def.excelHeader);
    if (headerIdx < 0) {
      console.warn(`[warn] Excel column not found: "${def.excelHeader}"`);
      continue;
    }
    const companyId = resolveCompanyId(companies, def.companyTokens);
    if (companyId == null) {
      console.warn(`[warn] No company match for ${def.label} (tokens: ${def.companyTokens.join(", ")})`);
      continue;
    }
    colBindings.push({ def, headerIdx, companyId });
    if (!dryRun) {
      await query(
        `INSERT INTO company_ean_column_config (company_id, column_key, label)
         VALUES ($1, $2, $3)
         ON CONFLICT (company_id) DO UPDATE SET column_key = EXCLUDED.column_key, label = EXCLUDED.label`,
        [companyId, def.columnKey, def.label]
      );
    }
    console.log(`[map] ${def.label} → company_id=${companyId}, col=${headerIdx}`);
  }

  let processed = 0;
  let upserted = 0;
  let skippedEmpty = 0;

  const BATCH = 1000;
  let batch: {
    sku_code: string;
    company_id: number;
    zap_ean: string | null;
    ean_type: string;
    universal_ean: string | null;
  }[] = [];

  async function flushBatch() {
    if (batch.length === 0) return;
    if (!dryRun) {
      const skuCodes = batch.map((r) => r.sku_code);
      const companyIds = batch.map((r) => r.company_id);
      const zapEans = batch.map((r) => r.zap_ean);
      const eanTypes = batch.map((r) => r.ean_type);
      const universalEans = batch.map((r) => r.universal_ean);
      await query(
        `INSERT INTO company_ean_mappings (sku_code, company_id, zap_ean, ean_type, universal_ean, updated_at)
         SELECT sku, cid, zap, etype, uni, NOW()
           FROM UNNEST($1::text[], $2::bigint[], $3::text[], $4::text[], $5::text[])
             AS t(sku, cid, zap, etype, uni)
         ON CONFLICT (sku_code, company_id) DO UPDATE SET
           zap_ean = COALESCE(EXCLUDED.zap_ean, company_ean_mappings.zap_ean),
           ean_type = EXCLUDED.ean_type,
           universal_ean = COALESCE(EXCLUDED.universal_ean, company_ean_mappings.universal_ean),
           updated_at = NOW()`,
        [skuCodes, companyIds, zapEans, eanTypes, universalEans]
      );
      upserted += batch.length;
    } else {
      upserted += batch.length;
    }
    batch = [];
  }

  for (let i = 1; i < data.length; i++) {
    const row = data[i] as unknown[];
    const sku = String(row[skuIdx] ?? "").trim();
    if (!sku) continue;
    processed += 1;

    const universal =
      ean1Idx >= 0 && isValidEanValue(row[ean1Idx])
        ? eanValueToString(row[ean1Idx])
        : null;

    for (const { def, headerIdx, companyId } of colBindings) {
      const raw = row[headerIdx];
      const zap = isValidEanValue(raw) ? eanValueToString(raw) : null;
      if (!zap && !universal) {
        skippedEmpty += 1;
        continue;
      }
      batch.push({
        sku_code: sku,
        company_id: companyId!,
        zap_ean: zap,
        ean_type: def.eanType,
        universal_ean: universal,
      });
      if (batch.length >= BATCH) await flushBatch();
    }
  }
  await flushBatch();

  console.log(
    JSON.stringify(
      {
        dryRun,
        processed_skus: processed,
        upserted,
        skipped_empty_values: skippedEmpty,
        company_columns: colBindings.length,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
