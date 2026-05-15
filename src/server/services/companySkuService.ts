import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { insertLog } from "@/server/services/secondaryListingsLogsService";

export type CompanyAssociationDetail = {
  relation_id: number;
  company_id: number;
  company_name: string | null;
  company_code_primary: string | null;
};

export type CompanySkuSort =
  | "sku_asc"
  | "sku_desc"
  | "company_asc"
  | "company_desc";

function companySkuOrderBy(sort?: CompanySkuSort | null): string {
  switch (sort) {
    case "sku_desc":
      return "css.secondary_sku DESC";
    case "company_asc":
      return "c.name ASC NULLS LAST, css.secondary_sku ASC";
    case "company_desc":
      return "c.name DESC NULLS LAST, css.secondary_sku ASC";
    case "sku_asc":
    default:
      return "css.secondary_sku ASC";
  }
}

export async function listCompanySkuRelations({
  search_keyword,
  page,
  limit,
  company_id,
  sort,
}: {
  search_keyword: string;
  page: number;
  limit: number;
  company_id?: number | null;
  sort?: CompanySkuSort | null;
}) {
  const offset = (page - 1) * limit;
  let where = "WHERE 1=1";
  const params: unknown[] = [];
  if (search_keyword) {
    params.push(`%${search_keyword}%`);
    const n = params.length;
    where += ` AND (
      c.name ILIKE $${n} OR CAST(c.id AS TEXT) ILIKE $${n}
      OR c.code_primary ILIKE $${n} OR css.secondary_sku ILIKE $${n}
    )`;
  }
  if (company_id != null && Number.isFinite(company_id)) {
    params.push(company_id);
    where += ` AND c.id = $${params.length}`;
  }
  const orderBy = companySkuOrderBy(sort);
  const countR = await query(
    `SELECT COUNT(*)::int AS total
     FROM company_secondary_sku css
     JOIN companies c ON c.id = css.company_id
     ${where}`,
    params
  );
  const total = countR.rows[0].total;
  params.push(limit, offset);
  const listR = await query(
    `SELECT c.id AS company_id, c.name AS company_name,
            COALESCE(NULLIF(TRIM(css.company_code_primary), ''), c.code_primary) AS company_code_primary,
            css.secondary_sku, css.id AS relation_id
     FROM company_secondary_sku css
     JOIN companies c ON c.id = css.company_id
     ${where}
     ORDER BY ${orderBy}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return {
    total,
    current_page: page,
    per_page_count: limit,
    content: listR.rows,
  };
}

/** Authoritative association rows for a secondary SKU (includes relation_id for CRUD). */
export async function fetchCompanyAssociationsForSecondarySku(
  secondarySku: string
): Promise<CompanyAssociationDetail[]> {
  const trimmed = String(secondarySku ?? "").trim();
  if (!trimmed) return [];
  try {
    const r = await query(
      `SELECT css.id AS relation_id, c.id AS company_id, c.name AS company_name,
              COALESCE(NULLIF(TRIM(css.company_code_primary), ''), c.code_primary) AS company_code_primary
       FROM company_secondary_sku css
       JOIN companies c ON c.id = css.company_id
       WHERE css.secondary_sku = $1
       ORDER BY css.id`,
      [trimmed]
    );
    return r.rows.map((row) => ({
      relation_id: Number(row.relation_id),
      company_id: Number(row.company_id),
      company_name: row.company_name != null ? String(row.company_name) : null,
      company_code_primary:
        row.company_code_primary != null ? String(row.company_code_primary) : null,
    }));
  } catch {
    return [];
  }
}

async function rebuildCompanyDetailsJsonSnapshot(secondarySku: string): Promise<void> {
  const trimmed = String(secondarySku ?? "").trim();
  if (!trimmed) return;
  const r = await query(
    `SELECT css.id AS relation_id, c.id AS company_id, c.name AS company_name,
            COALESCE(NULLIF(TRIM(css.company_code_primary), ''), c.code_primary) AS company_code_primary
     FROM company_secondary_sku css
     JOIN companies c ON c.id = css.company_id
     WHERE css.secondary_sku = $1
     ORDER BY css.id`,
    [trimmed]
  );
  const arr = r.rows.map((row) => ({
    relation_id: Number(row.relation_id),
    company_id: Number(row.company_id),
    company_name: row.company_name != null ? String(row.company_name) : null,
    company_code_primary:
      row.company_code_primary != null ? String(row.company_code_primary) : null,
  }));
  await query(
    `UPDATE secondary_listings SET company_details = $1::jsonb WHERE secondary_sku = $2`,
    [JSON.stringify(arr), trimmed]
  );
}

function formatTs(d: unknown): string {
  if (d == null) return new Date().toISOString();
  const t = d instanceof Date ? d : new Date(String(d));
  if (Number.isNaN(t.getTime())) return new Date().toISOString();
  return t.toISOString().replace(/\.\d{3}Z$/, ".000000Z");
}

export async function associateCompany(input: {
  secondary_sku: string;
  company_id: number;
  company_code_primary: string;
  createdBy?: string;
}) {
  const secondary_sku = String(input.secondary_sku ?? "").trim().slice(0, 200);
  const company_id = Number(input.company_id);
  const company_code_primary = String(input.company_code_primary ?? "")
    .trim()
    .slice(0, 50);

  if (!secondary_sku) throw new AppError("secondary_sku is required", 400);
  if (!Number.isFinite(company_id)) throw new AppError("company_id is required", 400);
  if (!company_code_primary) throw new AppError("company_code_primary is required", 400);

  const ex = await query(`SELECT 1 FROM companies WHERE id = $1 LIMIT 1`, [company_id]);
  if (ex.rows.length === 0) throw new AppError("Company not found", 404);

  let insert;
  try {
    insert = await query(
      `INSERT INTO company_secondary_sku (company_id, secondary_sku, company_code_primary, updated_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, created_at, updated_at`,
      [company_id, secondary_sku, company_code_primary]
    );
  } catch (e: unknown) {
    const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "";
    if (code === "23505")
      throw new AppError("This company is already associated with this secondary SKU", 409);
    throw e;
  }

  await rebuildCompanyDetailsJsonSnapshot(secondary_sku);

  const id = Number(insert.rows[0].id);
  const nameR = await query(`SELECT name FROM companies WHERE id = $1 LIMIT 1`, [
    company_id,
  ]);
  const company_name =
    nameR.rows[0]?.name != null ? String(nameR.rows[0].name) : "";

  if (input.createdBy) {
    await insertLog({
      secondary_sku,
      company_id,
      operation: "CREATE_ASSOCIATION",
      field_name: "company_code_primary",
      new_value: { company_id, company_code_primary },
      created_by: input.createdBy,
    });
  }

  return {
    id,
    secondary_sku,
    company_id,
    company_code_primary,
    company_name,
    updated_at: formatTs(insert.rows[0].updated_at),
    created_at: formatTs(insert.rows[0].created_at),
  };
}

export async function updateCompanyAssociation(
  relationId: number,
  input: { company_code_primary: string; createdBy?: string }
) {
  const id = Number(relationId);
  if (!Number.isFinite(id) || id <= 0)
    throw new AppError("Invalid association id", 400);
  const company_code_primary = String(input.company_code_primary ?? "")
    .trim()
    .slice(0, 50);
  if (!company_code_primary) throw new AppError("company_code_primary is required", 400);

  const sel = await query(
    `SELECT css.id, css.secondary_sku, css.company_id,
            css.updated_at AS css_updated_at, css.created_at AS css_created_at
     FROM company_secondary_sku css WHERE css.id = $1`,
    [id]
  );
  if (sel.rows.length === 0) throw new AppError("Association not found", 404);

  const row = sel.rows[0];
  const secondary_sku = String(row.secondary_sku);
  const company_id = Number(row.company_id);

  const oldCodeR = await query(
    `SELECT company_code_primary FROM company_secondary_sku WHERE id = $1`,
    [id]
  );
  const old_code = oldCodeR.rows[0]?.company_code_primary ?? null;

  const upd = await query(
    `UPDATE company_secondary_sku
     SET company_code_primary = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, updated_at`,
    [company_code_primary, id]
  );

  await rebuildCompanyDetailsJsonSnapshot(secondary_sku);

  const nameR = await query(`SELECT name FROM companies WHERE id = $1 LIMIT 1`, [
    company_id,
  ]);
  const company_name =
    nameR.rows[0]?.name != null ? String(nameR.rows[0].name) : "";

  if (input.createdBy) {
    await insertLog({
      secondary_sku,
      company_id,
      operation: "UPDATE_CODE",
      field_name: "company_code_primary",
      old_value: { company_code_primary: old_code },
      new_value: { company_code_primary },
      created_by: input.createdBy,
    });
  }

  return {
    id: Number(upd.rows[0].id),
    secondary_sku,
    company_id,
    company_code_primary,
    company_name,
    updated_at: formatTs(upd.rows[0].updated_at),
    created_at: formatTs(row.css_created_at),
  };
}

export async function deleteCompanyAssociation(relationId: number, createdBy?: string) {
  const id = Number(relationId);
  if (!Number.isFinite(id) || id <= 0)
    throw new AppError("Invalid association id", 400);

  const before = await query(
    `SELECT secondary_sku, company_id, company_code_primary FROM company_secondary_sku WHERE id = $1`,
    [id]
  );
  if (before.rows.length === 0) throw new AppError("Association not found", 404);

  const { secondary_sku, company_id, company_code_primary } = before.rows[0];

  await query(`DELETE FROM company_secondary_sku WHERE id = $1`, [id]);
  await rebuildCompanyDetailsJsonSnapshot(String(secondary_sku));

  if (createdBy) {
    await insertLog({
      secondary_sku: String(secondary_sku),
      company_id: Number(company_id),
      operation: "DELETE_ASSOCIATION",
      old_value: { company_id: Number(company_id), company_code_primary },
      created_by: createdBy,
    });
  }

  return { ok: true as const };
}

/**
 * Upsert a company association by (company_id, secondary_sku).
 * Works regardless of whether a relation_id is known (edit for JSONB-only entries).
 */
export async function upsertCompanyAssociation(input: {
  secondary_sku: string;
  company_id: number;
  company_code_primary: string;
  createdBy?: string;
}) {
  const secondary_sku = String(input.secondary_sku ?? "").trim().slice(0, 200);
  const company_id = Number(input.company_id);
  const company_code_primary = String(input.company_code_primary ?? "").trim().slice(0, 50);

  if (!secondary_sku) throw new AppError("secondary_sku is required", 400);
  if (!Number.isFinite(company_id)) throw new AppError("company_id is required", 400);
  if (!company_code_primary) throw new AppError("company_code_primary is required", 400);

  const ex = await query(`SELECT 1 FROM companies WHERE id = $1 LIMIT 1`, [company_id]);
  if (ex.rows.length === 0) throw new AppError("Company not found", 404);

  const upsert = await query(
    `INSERT INTO company_secondary_sku (company_id, secondary_sku, company_code_primary, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (company_id, secondary_sku)
     DO UPDATE SET company_code_primary = EXCLUDED.company_code_primary, updated_at = NOW()
     RETURNING id, created_at, updated_at`,
    [company_id, secondary_sku, company_code_primary]
  );

  await rebuildCompanyDetailsJsonSnapshot(secondary_sku);

  const nameR = await query(`SELECT name FROM companies WHERE id = $1 LIMIT 1`, [company_id]);
  const company_name = nameR.rows[0]?.name != null ? String(nameR.rows[0].name) : "";

  if (input.createdBy) {
    await insertLog({
      secondary_sku,
      company_id,
      operation: "UPDATE_CODE",
      field_name: "company_code_primary",
      new_value: { company_id, company_code_primary },
      created_by: input.createdBy,
    });
  }

  return {
    id: Number(upsert.rows[0].id),
    secondary_sku,
    company_id,
    company_code_primary,
    company_name,
    updated_at: formatTs(upsert.rows[0].updated_at),
    created_at: formatTs(upsert.rows[0].created_at),
  };
}

/**
 * Delete a company association by (secondary_sku, company_id).
 * Works regardless of whether a relation_id is known.
 */
export async function deleteCompanyBySkuAndCompany(input: {
  secondary_sku: string;
  company_id: number;
  createdBy?: string;
}) {
  const secondary_sku = String(input.secondary_sku ?? "").trim();
  const company_id = Number(input.company_id);

  if (!secondary_sku) throw new AppError("secondary_sku is required", 400);
  if (!Number.isFinite(company_id)) throw new AppError("company_id is required", 400);

  const beforeDel = await query(
    `SELECT company_code_primary FROM company_secondary_sku WHERE secondary_sku = $1 AND company_id = $2`,
    [secondary_sku, company_id]
  );
  const old_code = beforeDel.rows[0]?.company_code_primary ?? null;

  const del = await query(
    `DELETE FROM company_secondary_sku WHERE secondary_sku = $1 AND company_id = $2 RETURNING id`,
    [secondary_sku, company_id]
  );
  if (del.rows.length === 0) {
    // Row may be JSONB-only (not in company_secondary_sku). Remove it from the snapshot.
    await query(
      `UPDATE secondary_listings
       SET company_details = (
         SELECT COALESCE(
           jsonb_agg(elem),
           '[]'::jsonb
         )
         FROM jsonb_array_elements(COALESCE(company_details, '[]'::jsonb)) AS elem
         WHERE (elem->>'company_id')::int IS DISTINCT FROM $2
       )
       WHERE secondary_sku = $1`,
      [secondary_sku, company_id]
    );
  } else {
    await rebuildCompanyDetailsJsonSnapshot(secondary_sku);
  }

  if (input.createdBy) {
    await insertLog({
      secondary_sku,
      company_id,
      operation: "DELETE_ASSOCIATION",
      old_value: { company_id, company_code_primary: old_code },
      created_by: input.createdBy,
    });
  }

  return { ok: true as const };
}

export type CompanyListRow = { id: number; name: string | null; code_primary: string | null };

/** Active companies for associate dropdown (compact list). */
export async function listCompaniesForAssociateDropdown(): Promise<CompanyListRow[]> {
  const r = await query(
    `SELECT id, name, code_primary FROM companies
     WHERE COALESCE(is_active, 1) = 1
     ORDER BY name NULLS LAST, id
     LIMIT 2000`
  );
  return r.rows.map((row) => ({
    id: Number(row.id),
    name: row.name != null ? String(row.name) : null,
    code_primary: row.code_primary != null ? String(row.code_primary) : null,
  }));
}
