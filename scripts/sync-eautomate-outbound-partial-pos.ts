/**
 * GET eAutomate /public/api/incoming_purchase_orders/partial (search_keyword, page, count)
 * and upsert every row into outbound_purchase_orders (id = eAutomate id, full payload in eautomate_raw).
 *
 * Env: DATABASE_URL (required)
 *      EAUTOMATE_COOKIE or EAUTOMATE_BEARER_TOKEN
 *      EAUTOMATE_BASE_URL (optional)
 *      EAUTOMATE_FETCH_TIMEOUT_MS (optional)
 *
 * Usage:
 *   npx tsx scripts/sync-eautomate-outbound-partial-pos.ts
 *   npx tsx scripts/sync-eautomate-outbound-partial-pos.ts --search-keyword "" --count 28
 *   npm run sync:outbound-partial-pos
 */
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { fetchEautomate } from "../src/server/eautomate-proxy";
import { upsertOutboundPoFromEautomatePartial } from "../src/server/services/outboundPurchaseOrdersService";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

function extractRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data as Record<string, unknown>[];
    if (Array.isArray(o.content)) return o.content as Record<string, unknown>[];
    if (Array.isArray(o.partial)) return o.partial as Record<string, unknown>[];
    if (Array.isArray(o.incoming_purchase_orders)) {
      return o.incoming_purchase_orders as Record<string, unknown>[];
    }
    if (Array.isArray(o.purchase_orders)) {
      return o.purchase_orders as Record<string, unknown>[];
    }
  }
  return [];
}

function fetchTimeoutMs(): number {
  const n = Number(process.env.EAUTOMATE_FETCH_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function fetchWithOptionalTimeout(
  url: string,
  init: RequestInit
): Promise<Response> {
  const ms = fetchTimeoutMs();
  if (!ms) return fetchEautomate(url, init);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetchEautomate(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

function parseArgs(argv: string[]) {
  let searchKeyword = "";
  let count = 100;
  let maxPages = 10_000;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--search-keyword" && argv[i + 1] !== undefined) {
      searchKeyword = argv[i + 1];
      i += 1;
    } else if (a === "--count" && argv[i + 1]) {
      count = Math.min(500, Math.max(1, Number(argv[i + 1]) || 100));
      i += 1;
    } else if (a === "--max-pages" && argv[i + 1]) {
      maxPages = Math.max(1, Number(argv[i + 1]) || 1);
      i += 1;
    }
  }
  return { searchKeyword, count, maxPages };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const base = (process.env.EAUTOMATE_BASE_URL || "https://web.eautomate.in").replace(
    /\/$/,
    ""
  );
  const { searchKeyword, count, maxPages } = parseArgs(process.argv.slice(2));

  console.log(
    `[outbound-partial-pos] Sync start — base=${base} search_keyword=${JSON.stringify(searchKeyword)} count/page=${count} maxPages=${maxPages}`
  );

  let page = 1;
  let upserted = 0;
  let failed = 0;

  for (; page <= maxPages; page += 1) {
    const u = new URL(`${base}/public/api/incoming_purchase_orders/partial`);
    u.searchParams.set("search_keyword", searchKeyword);
    u.searchParams.set("page", String(page));
    u.searchParams.set("count", String(count));

    console.log(`[outbound-partial-pos] GET page ${page}…`);
    const t0 = Date.now();
    const res = await fetchWithOptionalTimeout(u.toString(), {
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`HTTP ${res.status}`, text.slice(0, 400));
      process.exit(1);
    }
    const json = (await res.json()) as unknown;
    const rows = extractRows(json);
    console.log(
      `[outbound-partial-pos] Page ${page}: ${rows.length} row(s) in ${Date.now() - t0}ms`
    );

    if (rows.length === 0) break;

    for (const raw of rows) {
      if (!raw || typeof raw !== "object") continue;
      try {
        await upsertOutboundPoFromEautomatePartial(raw as Record<string, unknown>);
        upserted += 1;
      } catch (e) {
        failed += 1;
        console.error(
          `Row id=${(raw as { id?: unknown }).id}:`,
          e instanceof Error ? e.message : e
        );
      }
    }

    if (rows.length < count) break;
  }

  console.log(
    `[outbound-partial-pos] Done. Last page fetched: ${Math.min(page, maxPages)}. Upserted ${upserted} row(s), ${failed} failed.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
