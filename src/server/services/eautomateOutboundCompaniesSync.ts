import { query } from "@/server/db";
import { fetchEautomate } from "@/server/eautomate-proxy";

function extractRows(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data;
    if (Array.isArray(o.content)) return o.content;
    if (Array.isArray(o.companies)) return o.companies;
  }
  return [];
}

function companyDescriptionFromAttributes(attributes: unknown): Record<string, unknown> {
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
    return {};
  }
  return attributes as Record<string, unknown>;
}

/** Throttle successful syncs so repeated form loads do not hammer the upstream API. */
let lastSuccessfulOutboundCompaniesSync = 0;
const OUTBOUND_COMPANIES_SYNC_MS = 90_000;

export type OutboundCompaniesSyncResult = {
  ok: boolean;
  upserted: number;
  skipped: boolean;
  error?: string;
};

/**
 * GET https://web.eautomate.in/public/api/companies (or EAUTOMATE_BASE_URL) and upsert into `companies`.
 * Uses EAUTOMATE_BEARER_TOKEN / EAUTOMATE_COOKIE when set (same as npm run sync:outbound-companies).
 */
export async function syncOutboundCompaniesFromPublicApi(opts?: {
  force?: boolean;
}): Promise<OutboundCompaniesSyncResult> {
  const now = Date.now();
  if (
    !opts?.force &&
    now - lastSuccessfulOutboundCompaniesSync < OUTBOUND_COMPANIES_SYNC_MS
  ) {
    return { ok: true, upserted: 0, skipped: true };
  }

  const base = (process.env.EAUTOMATE_BASE_URL || "https://web.eautomate.in").replace(
    /\/$/,
    ""
  );

  let res: Response;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 45_000);
    res = await fetchEautomate(`${base}/public/api/companies`, {
      cache: "no-store",
      signal: ac.signal,
    });
    clearTimeout(t);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Request failed";
    return { ok: false, upserted: 0, skipped: false, error: msg };
  }

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return {
      ok: false,
      upserted: 0,
      skipped: false,
      error: `HTTP ${res.status}: ${t.slice(0, 200)}`,
    };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return {
      ok: false,
      upserted: 0,
      skipped: false,
      error: "Invalid JSON from companies API",
    };
  }

  const rows = extractRows(json);
  let upserted = 0;

  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const id = Number(r.company_id ?? r.id);
    if (!Number.isFinite(id) || id <= 0) continue;
    const rawName = r.company_name;
    const name =
      rawName != null && typeof rawName !== "object"
        ? String(rawName).slice(0, 200)
        : `Company ${id}`;
    const attrs = companyDescriptionFromAttributes(r.attributes);
    const active = r.is_active != null ? Number(r.is_active) : 1;
    const ca = r.created_at;
    const ua = r.updated_at;
    const createdAt =
      typeof ca === "string" && ca.length > 0 ? new Date(ca) : new Date();
    const updatedAt =
      typeof ua === "string" && ua.length > 0 ? new Date(ua) : new Date();

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
    upserted += 1;
  }

  lastSuccessfulOutboundCompaniesSync = Date.now();
  return { ok: true, upserted, skipped: false };
}
