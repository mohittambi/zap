/**
 * Ingest PO detail snapshot from eautomate (6 GETs per PO).
 *
 * Usage:
 *   npm run sync:po:details -- --vendor <id> --po <id>
 *   npm run sync:po:details:from-db
 *   npm run sync:po:details:missing
 *   npm run sync:po:details:if-needed -- --po <id>
 *   npm run sync:po:details:from-db -- --missing-only --concurrency 4
 *
 * Env: DATABASE_URL, EAUTOMATE_COOKIE or EAUTOMATE_BEARER_TOKEN
 * Optional: SYNC_PO_DETAILS_CONCURRENCY (same as --concurrency)
 * Optional: PG_POOL_MAX — set to concurrency + 2 when using session pooler
 */
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { query } from "../src/server/db";
import {
  ingestPoDetailsByVendorAndPo,
  listPoIdsNeedingDetailIngest,
} from "../src/server/services/eautomatePoDetailsIngestService";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

function parseArgs(argv: string[]) {
  let vendor: number | null = null;
  let po: number | null = null;
  let fromDb = false;
  let missingOnly = false;
  let continueOnError = false;
  let concurrency = Math.max(
    1,
    Number(process.env.SYNC_PO_DETAILS_CONCURRENCY) || 1
  );
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--vendor" && argv[i + 1]) {
      vendor = Number(argv[i + 1]);
      i += 1;
    } else if (a === "--po" && argv[i + 1]) {
      po = Number(argv[i + 1]);
      i += 1;
    } else if (a === "--from-vendor-pos") {
      fromDb = true;
    } else if (a === "--missing-only") {
      missingOnly = true;
    } else if (a === "--continue-on-error") {
      continueOnError = true;
    } else if (a === "--concurrency" && argv[i + 1]) {
      concurrency = Math.min(12, Math.max(1, Number(argv[i + 1]) || 1));
      i += 1;
    }
  }
  return { vendor, po, fromDb, missingOnly, continueOnError, concurrency };
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  let idx = 0;
  async function runOne() {
    while (true) {
      const i = idx++;
      if (i >= items.length) break;
      await worker(items[i], i);
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => runOne()
  );
  await Promise.all(workers);
}

async function main() {
  const { vendor, po, fromDb, missingOnly, continueOnError, concurrency } =
    parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  if (concurrency > 1 && !process.env.PG_POOL_MAX) {
    process.env.PG_POOL_MAX = String(concurrency + 2);
  }

  const pairs: { vendor_id: number; po_id: number; reason?: string }[] = [];
  if (fromDb) {
    if (missingOnly) {
      const missing = await listPoIdsNeedingDetailIngest();
      for (const row of missing) {
        pairs.push(row);
      }
      if (pairs.length === 0) {
        console.log(
          "All eAutomate POs have inbound_po_detail_snapshot and line rows."
        );
        return;
      }
      console.log(
        `Ingesting PO details for ${pairs.length} PO(s) missing snapshot/lines...`
      );
    } else {
      const r = await query(
        `SELECT vendor_id, po_id FROM vendor_purchase_orders WHERE source = 'eautomate' ORDER BY po_id ASC`
      );
      for (const row of r.rows as {
        vendor_id: string | number;
        po_id: string | number;
      }[]) {
        pairs.push({
          vendor_id: Number(row.vendor_id),
          po_id: Number(row.po_id),
        });
      }
      if (pairs.length === 0) {
        console.error("No eAutomate rows in vendor_purchase_orders. Sync vendor POs first.");
        process.exit(1);
      }
      console.log(`Ingesting PO details for ${pairs.length} PO(s) (full refresh)...`);
    }
    if (concurrency > 1) {
      console.log(`Concurrency: ${concurrency} (PG_POOL_MAX=${process.env.PG_POOL_MAX})`);
    }
  } else if (
    vendor != null &&
    Number.isFinite(vendor) &&
    vendor >= 1 &&
    po != null &&
    Number.isFinite(po) &&
    po >= 1
  ) {
    pairs.push({ vendor_id: vendor, po_id: po });
  } else {
    console.error(
      "Usage: npm run sync:po:details -- --vendor <id> --po <id>\n" +
        "   or: npm run sync:po:details:from-db\n" +
        "   or: npm run sync:po:details:missing\n" +
        "   or: npm run sync:po:details:if-needed -- --po <id>"
    );
    process.exit(1);
  }

  let ok = 0;
  let fail = 0;
  let done = 0;
  const progressEvery = 25;

  await runPool(pairs, concurrency, async ({ vendor_id, po_id, reason }) => {
    try {
      const suffix = reason ? ` [${reason}]` : "";
      await ingestPoDetailsByVendorAndPo(vendor_id, po_id);
      ok += 1;
      done += 1;
      console.log(`PO ${po_id} (vendor ${vendor_id})${suffix}... ok`);
    } catch (e) {
      fail += 1;
      done += 1;
      console.log(`PO ${po_id} (vendor ${vendor_id})... failed`);
      console.error(e instanceof Error ? e.message : e);
      if (!continueOnError) {
        throw e;
      }
    }
    if (done > 0 && done % progressEvery === 0) {
      console.log(`[po-details] … ${done}/${pairs.length} processed (${ok} ok, ${fail} failed)`);
    }
  });

  console.log(`Done. ${ok} ok, ${fail} failed.`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
