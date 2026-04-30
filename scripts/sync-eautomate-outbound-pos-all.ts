/**
 * POST eAutomate /public/api/incoming_purchase_orders/all/with_filters (paged)
 * and upsert rows into outbound_purchase_orders.
 *
 * Also syncs:
 * - GET /public/api/companies -> companies
 * - GET /public/api/incoming_purchase_orders/delivery_locations -> delivery_locations
 *
 * Usage:
 *   npx tsx scripts/sync-eautomate-outbound-pos-all.ts
 *   npx tsx scripts/sync-eautomate-outbound-pos-all.ts --count 100 --max-pages 200
 *   npm run sync:outbound-pos:all
 */
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pg from "pg";
import { fetchEautomate } from "../src/server/eautomate-proxy";
import { upsertOutboundPoFromEautomateList } from "../src/server/services/outboundPurchaseOrdersService";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

function parseArgs(argv: string[]) {
  let count = 100;
  let maxPages = 10_000;
  let searchKeyword = "";
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--count" && argv[i + 1]) {
      count = Math.min(500, Math.max(1, Number(argv[i + 1]) || 100));
      i += 1;
    } else if (a === "--max-pages" && argv[i + 1]) {
      maxPages = Math.max(1, Number(argv[i + 1]) || 1);
      i += 1;
    } else if (a === "--search-keyword" && argv[i + 1] !== undefined) {
      searchKeyword = argv[i + 1];
      i += 1;
    }
  }
  return { count, maxPages, searchKeyword };
}

function extractRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (!data || typeof data !== "object") return [];
  const o = data as Record<string, unknown>;
  if (Array.isArray(o.content)) return o.content as Record<string, unknown>[];
  if (Array.isArray(o.data)) return o.data as Record<string, unknown>[];
  if (Array.isArray(o.purchase_orders)) return o.purchase_orders as Record<string, unknown>[];
  return [];
}

function extractDeliveryLocations(data: unknown): string[] {
  if (Array.isArray(data)) {
    return data
      .map((x) => String(x ?? "").trim())
      .filter((x) => x.length > 0);
  }
  if (!data || typeof data !== "object") return [];
  const o = data as Record<string, unknown>;
  const arr = Array.isArray(o.data)
    ? o.data
    : Array.isArray(o.content)
      ? o.content
      : Array.isArray(o.delivery_locations)
        ? o.delivery_locations
        : [];
  return arr
    .map((x) => String(x ?? "").trim())
    .filter((x) => x.length > 0);
}

function extractCompanies(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (!data || typeof data !== "object") return [];
  const o = data as Record<string, unknown>;
  if (Array.isArray(o.data)) return o.data as Record<string, unknown>[];
  if (Array.isArray(o.content)) return o.content as Record<string, unknown>[];
  if (Array.isArray(o.companies)) return o.companies as Record<string, unknown>[];
  return [];
}

async function syncCompanies(base: string, client: pg.PoolClient): Promise<number> {
  const res = await fetchEautomate(`${base}/public/api/companies`, { cache: "no-store" });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`companies HTTP ${res.status} ${t.slice(0, 200)}`);
  }
  const data: unknown = await res.json();
  const rows = extractCompanies(data);
  let upserted = 0;
  for (const raw of rows) {
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
    await client.query(
      `INSERT INTO companies (id, name, code_primary, attributes, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         code_primary = EXCLUDED.code_primary,
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
  return upserted;
}

async function syncDeliveryLocations(base: string, client: pg.PoolClient): Promise<number> {
  const res = await fetchEautomate(
    `${base}/public/api/incoming_purchase_orders/delivery_locations`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`delivery_locations HTTP ${res.status} ${t.slice(0, 200)}`);
  }
  const data: unknown = await res.json();
  const rows = extractDeliveryLocations(data);
  let inserted = 0;
  for (const name of rows) {
    const r = await client.query(
      `INSERT INTO delivery_locations (name)
       VALUES ($1)
       ON CONFLICT (name) DO NOTHING`,
      [name]
    );
    inserted += r.rowCount ?? 0;
  }
  return inserted;
}

async function fetchPage(
  base: string,
  page: number,
  count: number,
  searchKeyword: string
): Promise<{ rows: Record<string, unknown>[]; currPageCount: number }> {
  const u = new URL(`${base}/public/api/incoming_purchase_orders/all/with_filters`);
  u.searchParams.set("search_keyword", searchKeyword);
  u.searchParams.set("page", String(page));
  u.searchParams.set("count", String(count));
  const res = await fetchEautomate(u.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      expiryDates: [],
      poStatuses: [],
      poTypes: [],
      companyIds: [],
      deliveryLocations: [],
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`all/with_filters HTTP ${res.status} ${t.slice(0, 300)}`);
  }
  const json = (await res.json()) as Record<string, unknown>;
  const rows = extractRows(json);
  const currPageCount =
    Number.isFinite(Number(json.curr_page_count)) && Number(json.curr_page_count) >= 0
      ? Number(json.curr_page_count)
      : rows.length;
  return { rows, currPageCount };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }
  const base = (process.env.EAUTOMATE_BASE_URL || "https://web.eautomate.in").replace(
    /\/$/,
    ""
  );
  const { count, maxPages, searchKeyword } = parseArgs(process.argv.slice(2));

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    console.log(
      `[outbound-pos-all] start base=${base} search_keyword=${JSON.stringify(searchKeyword)} count=${count} maxPages=${maxPages}`
    );
    const syncedCompanies = await syncCompanies(base, client);
    console.log(`[outbound-pos-all] companies upserted=${syncedCompanies}`);
    const syncedDeliveryLocations = await syncDeliveryLocations(base, client);
    console.log(`[outbound-pos-all] delivery_locations inserted=${syncedDeliveryLocations}`);

    let page = 1;
    let upserted = 0;
    let failed = 0;
    for (; page <= maxPages; page += 1) {
      const t0 = Date.now();
      const { rows, currPageCount } = await fetchPage(base, page, count, searchKeyword);
      console.log(
        `[outbound-pos-all] page=${page} rows=${rows.length} curr_page_count=${currPageCount} in ${Date.now() - t0}ms`
      );
      if (rows.length === 0) break;
      for (const row of rows) {
        try {
          await upsertOutboundPoFromEautomateList(row);
          upserted += 1;
        } catch (e) {
          failed += 1;
          const id = row.id != null ? String(row.id) : "?";
          console.error(
            `[outbound-pos-all] row id=${id} failed:`,
            e instanceof Error ? e.message : e
          );
        }
      }
      if (currPageCount < count) break;
    }
    console.log(
      `[outbound-pos-all] done pages=${Math.min(page, maxPages)} upserted=${upserted} failed=${failed}`
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
