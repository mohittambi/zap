#!/usr/bin/env node
/**
 * GET eAutomate /public/api/companies → upsert companies (id, name, attributes, is_active, timestamps).
 *
 * Env: DATABASE_URL, EAUTOMATE_COOKIE or EAUTOMATE_BEARER_TOKEN, optional EAUTOMATE_BASE_URL
 *
 * Usage: node scripts/sync-eautomate-companies.mjs
 *    or: npm run sync:outbound-companies
 */
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  const dotenv = await import("dotenv");
  const root = path.join(__dirname, "..");
  dotenv.default.config({ path: path.join(root, ".env.local") });
  dotenv.default.config({ path: path.join(root, ".env") });
} catch {
  /* optional */
}

function extractRows(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.content)) return data.content;
    if (Array.isArray(data.companies)) return data.companies;
  }
  return [];
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const base = (process.env.EAUTOMATE_BASE_URL || "https://web.eautomate.in").replace(/\/$/, "");
  const headers = { Accept: "application/json" };
  const token = process.env.EAUTOMATE_BEARER_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  const cookie = process.env.EAUTOMATE_COOKIE;
  if (cookie) headers.Cookie = cookie;

  const res = await fetch(`${base}/public/api/companies`, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error(`HTTP ${res.status}`, t.slice(0, 400));
    process.exit(1);
  }
  const json = await res.json();
  const rows = extractRows(json);

  const pool = new pg.Pool({ connectionString: url });
  let n = 0;
  try {
    for (const raw of rows) {
      if (!raw || typeof raw !== "object") continue;
      const id = Number(raw.company_id ?? raw.id);
      if (!Number.isFinite(id) || id <= 0) continue;
      const name =
        raw.company_name != null ? String(raw.company_name).slice(0, 200) : `Company ${id}`;
      const attrs =
        raw.attributes && typeof raw.attributes === "object" && !Array.isArray(raw.attributes)
          ? raw.attributes
          : {};
      const active = raw.is_active != null ? Number(raw.is_active) : 1;
      const createdAt = raw.created_at ? new Date(String(raw.created_at)) : new Date();
      const updatedAt = raw.updated_at ? new Date(String(raw.updated_at)) : new Date();
      await pool.query(
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
    console.log(`Upserted ${n} company row(s).`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
