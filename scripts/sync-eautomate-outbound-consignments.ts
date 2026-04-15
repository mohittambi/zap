/**
 * POST eAutomate consignments/all/paginated (all pages) + GET delivery_locations into Zap DB.
 * Companies: use npm run sync:outbound-companies separately.
 *
 * Env: DATABASE_URL, EAUTOMATE_COOKIE or EAUTOMATE_BEARER_TOKEN, optional EAUTOMATE_BASE_URL
 *
 * Usage:
 *   npm run sync:outbound-consignments
 *   npx tsx scripts/sync-eautomate-outbound-consignments.ts --count 100 --max-pages 50
 */
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { fetchEautomate } from "../src/server/eautomate-proxy";
import {
  upsertOutboundConsignmentFromEautomate,
  upsertOutboundConsignmentDeliveryLocationsFromApi,
} from "../src/server/services/outboundConsignmentsService";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

const DEFAULT_BODY = {
  poNumber: "",
  invoiceNumber: "",
  companyIds: [] as number[],
  deliveryLocations: [] as string[],
  rtdDates: [] as string[],
};

function extractRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const o = data as Record<string, unknown>;
    for (const key of ["data", "content", "consignments", "records", "items"]) {
      const v = o[key];
      if (Array.isArray(v)) return v as Record<string, unknown>[];
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const inner = extractRows(v);
        if (inner.length > 0) return inner;
      }
    }
  }
  return [];
}

function extractLocationRows(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data;
    if (Array.isArray(o.content)) return o.content;
    if (Array.isArray(o.locations)) return o.locations;
    if (Array.isArray(o.delivery_locations)) return o.delivery_locations;
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
  let skipLocations = false;
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
    } else if (a === "--skip-locations") {
      skipLocations = true;
    }
  }
  return { searchKeyword, count, maxPages, skipLocations };
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
  const { searchKeyword, count, maxPages, skipLocations } = parseArgs(process.argv.slice(2));
  console.log(
    `[outbound-consignments] base=${base} count/page=${count} maxPages=${maxPages} search_keyword=${JSON.stringify(searchKeyword)}`
  );

  if (!skipLocations) {
    const locUrl = `${base}/public/api/incoming_purchase_orders/delivery_locations`;
    console.log("[outbound-consignments] GET delivery_locations…");
    const locRes = await fetchWithOptionalTimeout(locUrl, {
      cache: "no-store",
    });
    if (!locRes.ok) {
      const t = await locRes.text().catch(() => "");
      console.warn(`[outbound-consignments] delivery_locations HTTP ${locRes.status}`, t.slice(0, 300));
    } else {
      const locJson: unknown = await locRes.json();
      const locRows = extractLocationRows(locJson);
      const nLoc = await upsertOutboundConsignmentDeliveryLocationsFromApi(locRows);
      console.log(`[outbound-consignments] Upserted ${nLoc} delivery location row(s).`);
    }
  }

  let upserted = 0;
  let failed = 0;
  let lastPage = 0;

  for (let page = 1; page <= maxPages; page += 1) {
    const u = new URL(
      `${base}/public/api/incoming_purchase_orders/consignments/all/paginated`
    );
    u.searchParams.set("search_keyword", searchKeyword);
    u.searchParams.set("page", String(page));
    u.searchParams.set("count", String(count));

    console.log(`[outbound-consignments] POST page ${page}…`);
    const t0 = Date.now();
    const res = await fetchWithOptionalTimeout(u.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(DEFAULT_BODY),
      cache: "no-store",
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error(`HTTP ${res.status}`, t.slice(0, 400));
      process.exit(1);
    }
    const json: unknown = await res.json();
    const rows = extractRows(json);
    lastPage = page;
    console.log(
      `[outbound-consignments] Page ${page}: ${rows.length} row(s) in ${Date.now() - t0}ms`
    );

    if (rows.length === 0) break;

    for (const raw of rows) {
      if (!raw || typeof raw !== "object") continue;
      const r = await upsertOutboundConsignmentFromEautomate(raw as Record<string, unknown>);
      if (r.ok) upserted += 1;
      else {
        failed += 1;
        console.warn(`Skip: ${r.reason}`, (raw as { id?: unknown }).id);
      }
    }

    if (rows.length < count) break;
  }

  console.log(
    `[outbound-consignments] Done. Last page ${lastPage}. Upserted ${upserted}, skipped ${failed}.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
