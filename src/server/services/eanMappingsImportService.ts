import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { parseDelimitedRow } from "@/server/utils/csvParse";
import {
  isValidEanValue,
  normalizeCompanyName,
  upsertEanMappings,
  eanValueToString,
} from "@/server/services/eanMappingsService";

export type EanImportRowStatus =
  | "new"
  | "replace"
  | "unchanged"
  | "warning"
  | "error";

export type EanImportPreviewRow = {
  rowNumber: number;
  sku_code: string;
  company_name: string;
  company_id: number | null;
  zap_ean: string | null;
  ean_type: string;
  universal_ean: string | null;
  status: EanImportRowStatus;
  issues: string[];
  existing?: {
    zap_ean: string | null;
    ean_type: string | null;
    universal_ean: string | null;
  };
};

export type EanImportPreview = {
  ok: boolean;
  rowsPreview: EanImportPreviewRow[];
  stats: {
    totalRows: number;
    newCount: number;
    replaceCount: number;
    unchangedCount: number;
    warningCount: number;
    errorCount: number;
  };
};

type ParsedImportRow = {
  rowNumber: number;
  sku_code: string;
  company_name: string;
  company_id: number | null;
  zap_ean: string | null;
  ean_type: string;
  universal_ean: string | null;
};

function eanCellValue(raw: string): string | null {
  const s = eanValueToString(raw);
  return s || null;
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export async function exportEanMappingsCsv(opts?: {
  companyId?: number;
  search?: string;
}): Promise<string> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let p = 1;
  if (opts?.companyId != null && opts.companyId > 0) {
    conditions.push(`m.company_id = $${p}`);
    params.push(opts.companyId);
    p += 1;
  }
  const search = typeof opts?.search === "string" ? opts.search.trim() : "";
  if (search) {
    const q = `%${search.toLowerCase()}%`;
    conditions.push(
      `(LOWER(m.sku_code) LIKE $${p} OR LOWER(COALESCE(m.zap_ean, '')) LIKE $${p} OR LOWER(COALESCE(c.name, '')) LIKE $${p})`
    );
    params.push(q);
    p += 1;
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const r = await query(
    `SELECT m.sku_code, c.name AS company_name, m.zap_ean, m.ean_type, m.universal_ean
       FROM company_ean_mappings m
       LEFT JOIN companies c ON c.id = m.company_id
       ${where}
       ORDER BY m.sku_code ASC, c.name ASC NULLS LAST`,
    params
  );
  const lines = [
    "sku_code,company_name,zap_ean,ean_type,universal_ean",
    ...r.rows.map((row) =>
      [
        csvEscape(String(row.sku_code)),
        csvEscape(row.company_name != null ? String(row.company_name) : ""),
        csvEscape(row.zap_ean != null ? String(row.zap_ean) : ""),
        csvEscape(row.ean_type != null ? String(row.ean_type) : "code"),
        csvEscape(row.universal_ean != null ? String(row.universal_ean) : ""),
      ].join(",")
    ),
  ];
  return lines.join("\n");
}

async function loadCompanies(): Promise<
  { id: number; name: string | null; norm: string }[]
> {
  const r = await query(`SELECT id, name FROM companies ORDER BY id`);
  return r.rows.map((row) => ({
    id: Number(row.id),
    name: row.name != null ? String(row.name) : null,
    norm: normalizeCompanyName(row.name != null ? String(row.name) : ""),
  }));
}

function resolveCompanyId(
  companies: { id: number; name: string | null; norm: string }[],
  companyName: string,
  companyIdRaw: string
): number | null {
  const idN = Number(companyIdRaw);
  if (companyIdRaw && Number.isFinite(idN) && idN > 0) return idN;
  const norm = normalizeCompanyName(companyName);
  if (!norm) return null;
  for (const c of companies) {
    if (!c.norm) continue;
    if (c.norm === norm || c.norm.includes(norm) || norm.includes(c.norm)) {
      return c.id;
    }
  }
  return null;
}

export function parseEanMappingsImportCsv(buf: Buffer): ParsedImportRow[] {
  const text = buf.toString("utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const header = parseDelimitedRow(lines[0], ",").map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const skuIdx = idx("sku_code");
  const companyNameIdx = idx("company_name");
  const companyIdIdx = idx("company_id");
  const zapIdx = idx("zap_ean");
  const typeIdx = idx("ean_type");
  const universalIdx = idx("universal_ean");
  if (skuIdx < 0) {
    throw new AppError("CSV must include sku_code column", 400);
  }

  const rows: ParsedImportRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseDelimitedRow(lines[i], ",");
    const sku_code = (cells[skuIdx] ?? "").trim();
    if (!sku_code) continue;
    rows.push({
      rowNumber: i + 1,
      sku_code,
      company_name: companyNameIdx >= 0 ? (cells[companyNameIdx] ?? "").trim() : "",
      company_id:
        companyIdIdx >= 0 && (cells[companyIdIdx] ?? "").trim()
          ? Number(cells[companyIdIdx]) || null
          : null,
      zap_ean: zapIdx >= 0 ? eanCellValue(cells[zapIdx] ?? "") : null,
      ean_type: typeIdx >= 0 ? (cells[typeIdx] ?? "").trim() || "code" : "code",
      universal_ean:
        universalIdx >= 0 ? eanCellValue(cells[universalIdx] ?? "") : null,
    });
  }
  return rows;
}

export async function previewEanMappingsImport(
  buf: Buffer
): Promise<EanImportPreview> {
  const parsed = parseEanMappingsImportCsv(buf);
  const companies = await loadCompanies();
  for (const row of parsed) {
    if (row.company_id != null) continue;
    row.company_id = resolveCompanyId(companies, row.company_name, "");
  }

  const skuCodes = [...new Set(parsed.map((r) => r.sku_code))];
  const existingR =
    skuCodes.length > 0
      ? await query(
          `SELECT sku_code, company_id, zap_ean, ean_type, universal_ean
             FROM company_ean_mappings
            WHERE sku_code = ANY($1::text[])`,
          [skuCodes]
        )
      : { rows: [] };
  const existingByKey = new Map<
    string,
    { zap_ean: string | null; ean_type: string | null; universal_ean: string | null }
  >();
  for (const row of existingR.rows) {
    existingByKey.set(`${row.sku_code}::${row.company_id}`, {
      zap_ean: row.zap_ean != null ? String(row.zap_ean) : null,
      ean_type: row.ean_type != null ? String(row.ean_type) : null,
      universal_ean: row.universal_ean != null ? String(row.universal_ean) : null,
    });
  }

  const listingR =
    skuCodes.length > 0
      ? await query(`SELECT sku_id FROM listings WHERE sku_id = ANY($1::text[])`, [
          skuCodes,
        ])
      : { rows: [] };
  const listingSkus = new Set(listingR.rows.map((r) => String(r.sku_id)));

  const seen = new Set<string>();
  const rowsPreview: EanImportPreviewRow[] = [];
  let newCount = 0;
  let replaceCount = 0;
  let unchangedCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  for (const row of parsed) {
    const issues: string[] = [];
    let status: EanImportRowStatus = "new";

    if (!row.company_id) {
      status = "error";
      issues.push("Unknown company — use company_name or company_id.");
      errorCount += 1;
    } else if (!row.zap_ean && !row.universal_ean) {
      status = "error";
      issues.push("At least one of zap_ean or universal_ean is required.");
      errorCount += 1;
    } else if (row.zap_ean && !isValidEanValue(row.zap_ean) && row.zap_ean.length < 3) {
      status = "error";
      issues.push("Invalid zap_ean value.");
      errorCount += 1;
    } else {
      const key = `${row.sku_code}::${row.company_id}`;
      if (seen.has(key)) {
        status = "error";
        issues.push("Duplicate row in CSV for same sku_code + company.");
        errorCount += 1;
      } else {
        seen.add(key);
        const existing = existingByKey.get(key);
        if (!existing) {
          if (!listingSkus.has(row.sku_code)) {
            status = "warning";
            issues.push("sku_code not found in listings catalogue.");
            warningCount += 1;
          } else {
            status = "new";
            newCount += 1;
          }
        } else {
          const same =
            (existing.zap_ean ?? "") === (row.zap_ean ?? "") &&
            (existing.ean_type ?? "") === (row.ean_type ?? "") &&
            (existing.universal_ean ?? "") === (row.universal_ean ?? "");
          if (same) {
            status = "unchanged";
            unchangedCount += 1;
          } else {
            status = "replace";
            replaceCount += 1;
          }
        }
      }
    }

    rowsPreview.push({
      rowNumber: row.rowNumber,
      sku_code: row.sku_code,
      company_name: row.company_name,
      company_id: row.company_id,
      zap_ean: row.zap_ean,
      ean_type: row.ean_type,
      universal_ean: row.universal_ean,
      status,
      issues,
      existing: existingByKey.get(`${row.sku_code}::${row.company_id}`),
    });
  }

  return {
    ok: errorCount === 0 && rowsPreview.some((r) => r.status !== "unchanged"),
    rowsPreview,
    stats: {
      totalRows: rowsPreview.length,
      newCount,
      replaceCount,
      unchangedCount,
      warningCount,
      errorCount,
    },
  };
}

export async function applyEanMappingsImport(
  buf: Buffer,
  approvedRowNumbers: number[]
): Promise<{ upserted: number; skipped: number }> {
  const preview = await previewEanMappingsImport(buf);
  const approved = new Set(approvedRowNumbers);
  const toApply = preview.rowsPreview.filter((row) => {
    if (row.status === "error" || row.status === "unchanged") return false;
    if (
      (row.status === "replace" || row.status === "warning") &&
      !approved.has(row.rowNumber)
    ) {
      return false;
    }
    return true;
  });

  if (toApply.length === 0) {
    return { upserted: 0, skipped: preview.rowsPreview.length };
  }

  const rows = toApply
    .filter((r) => r.company_id != null)
    .map((r) => ({
      sku_code: r.sku_code,
      company_id: r.company_id as number,
      zap_ean: r.zap_ean,
      ean_type: r.ean_type || "code",
      universal_ean: r.universal_ean,
    }));

  return upsertEanMappings(rows);
}
