import { fetchEautomate, getEautomateBaseUrl } from "@/server/eautomate-proxy";
import { query } from "@/server/db";

export function extractEautomateCompanyRows(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data;
    if (Array.isArray(o.content)) return o.content;
    if (Array.isArray(o.companies)) return o.companies;
  }
  return [];
}

export async function fetchEautomateCompaniesJson(): Promise<unknown> {
  const base = getEautomateBaseUrl();
  const url = `${base}/public/api/companies`;
  const res = await fetchEautomate(url, {
    cache: "no-store",
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`eAutomate companies HTTP ${res.status}${t ? `: ${t.slice(0, 300)}` : ""}`);
  }
  return res.json();
}

export async function upsertCompaniesFromEautomatePayload(payload: unknown): Promise<number> {
  const rows = extractEautomateCompanyRows(payload);
  let n = 0;
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const id = Number(r.company_id ?? r.id);
    if (!Number.isFinite(id) || id <= 0) continue;
    const name =
      r.company_name != null ? String(r.company_name).slice(0, 200) : `Company ${id}`;
    const attrs =
      r.attributes && typeof r.attributes === "object" && !Array.isArray(r.attributes)
        ? r.attributes
        : {};
    const active = r.is_active != null ? Number(r.is_active) : 1;
    const createdAt = r.created_at ? new Date(String(r.created_at)) : new Date();
    const updatedAt = r.updated_at ? new Date(String(r.updated_at)) : new Date();
    await query(
      `INSERT INTO companies (id, name, code_primary, attributes, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         attributes = EXCLUDED.attributes,
         is_active = EXCLUDED.is_active,
         updated_at = EXCLUDED.updated_at`,
      [
        id,
        name,
        String(id),
        JSON.stringify(attrs),
        Number.isFinite(active) ? active : 1,
        createdAt,
        updatedAt,
      ]
    );
    n += 1;
  }
  return n;
}

export async function syncCompaniesFromEautomate(): Promise<{ upserted: number }> {
  const json = await fetchEautomateCompaniesJson();
  const upserted = await upsertCompaniesFromEautomatePayload(json);
  return { upserted };
}
