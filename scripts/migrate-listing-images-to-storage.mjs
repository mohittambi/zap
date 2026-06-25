#!/usr/bin/env node
/**
 * DORMANT — migrate listing image URLs from external CDN to Zap Storage (doctrine #14).
 * Built, NOT ACTIVATED: do not run --apply-db in production without explicit approval.
 *
 * Safe modes (no DB writes):
 *   --dry-run              probe only, no upload
 *   default without --apply-db   upload optional, never UPDATE listings
 *
 * DB writes require BOTH --apply-db AND env LISTING_IMAGE_MIGRATION_ALLOW_DB=1
 *
 * Usage:
 *   node scripts/migrate-listing-images-to-storage.mjs --dry-run --limit 10 --concurrency 1
 *   node scripts/migrate-listing-images-to-storage.mjs --limit 10 --concurrency 1
 *   npm run migrate:listing-images -- --dry-run --limit 5
 *
 * Env: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *      ZAP_STORAGE_BUCKET_LISTINGS (default listing-images)
 *      LISTING_IMAGE_MIGRATION_ALLOW_DB=1  (required for --apply-db)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import {
  downloadImage,
  isExternalImageUrl,
  isListingStorageConfigured,
  isZapStoragePublicUrl,
  mirrorListingImage,
} from "./lib/listingImageStorage.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.join(__dirname, "..");
const LOGS_DIR = path.join(WEB_ROOT, "logs");
const CHECKPOINT_FILE = path.join(LOGS_DIR, "listing-image-migrate-checkpoint.jsonl");

try {
  const dotenv = await import("dotenv");
  dotenv.default.config({ path: path.join(WEB_ROOT, ".env.local") });
  dotenv.default.config({ path: path.join(WEB_ROOT, ".env") });
} catch {
  /* optional */
}

function parseArgs(argv) {
  const out = {
    limit: null,
    concurrency: 1,
    dryRun: false,
    applyDb: false,
    resume: false,
    field: null,
    runId: new Date().toISOString().replace(/[:.]/g, "-"),
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--apply-db") out.applyDb = true;
    else if (a === "--resume") out.resume = true;
    else if (a === "--limit") out.limit = Number(argv[++i]);
    else if (a === "--concurrency") out.concurrency = Math.max(1, Number(argv[++i]) || 1);
    else if (a === "--field") out.field = argv[++i];
    else if (a === "--run-id") out.runId = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function printHelp() {
  console.log(`migrate-listing-images-to-storage.mjs

  --dry-run           Probe URLs; no upload, no DB
  --limit N           Max rows to process
  --concurrency N     Parallel workers (default 1; ramp gradually)
  --apply-db          UPDATE listings on success (requires LISTING_IMAGE_MIGRATION_ALLOW_DB=1)
  --resume            Skip checkpoint + already-migrated Zap URLs
  --field img_hd      Single column only
  --run-id ID         Log file prefix
`);
}

function loadCheckpointKeys() {
  const keys = new Set();
  if (!fs.existsSync(CHECKPOINT_FILE)) return keys;
  const lines = fs.readFileSync(CHECKPOINT_FILE, "utf8").split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const j = JSON.parse(line);
      if (j.status === "ok" && j.sku_id && j.field) {
        keys.add(`${j.sku_id}\0${j.field}`);
      }
    } catch {
      /* skip bad line */
    }
  }
  return keys;
}

function appendCheckpoint(entry) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
  fs.appendFileSync(CHECKPOINT_FILE, `${JSON.stringify(entry)}\n`, "utf8");
}

async function fetchWorkItems(client, fieldFilter) {
  const res = await client.query(`
    SELECT l.sku_id, t.field, TRIM(t.url::text) AS source_url
    FROM listings l
    CROSS JOIN LATERAL unnest(
      ARRAY[l.img_hd, l.img_white, l.img_wdim, l.img_link1, l.img_link2],
      ARRAY['img_hd', 'img_white', 'img_wdim', 'img_link1', 'img_link2']::text[]
    ) AS t(url, field)
    WHERE t.url IS NOT NULL AND TRIM(t.url::text) <> ''
    ORDER BY l.sku_id, t.field
  `);
  if (fieldFilter) {
    return res.rows.filter((r) => r.field === fieldFilter);
  }
  return res.rows;
}

async function runPool(items, concurrency, worker) {
  let idx = 0;
  const results = [];
  async function runOne() {
    while (true) {
      const i = idx++;
      if (i >= items.length) break;
      results[i] = await worker(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runOne());
  await Promise.all(workers);
  return results;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.applyDb && process.env.LISTING_IMAGE_MIGRATION_ALLOW_DB !== "1") {
    console.error(
      "Refusing --apply-db: set LISTING_IMAGE_MIGRATION_ALLOW_DB=1 in env to allow database writes."
    );
    process.exit(1);
  }

  const supabaseBase = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  if (!args.dryRun && !isListingStorageConfigured()) {
    console.error(
      "Zap Storage not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or use --dry-run."
    );
    process.exit(1);
  }

  fs.mkdirSync(LOGS_DIR, { recursive: true });
  const jsonlPath = path.join(LOGS_DIR, `listing-image-migrate-${args.runId}.jsonl`);
  const jsonlStream = fs.createWriteStream(jsonlPath, { flags: "a" });

  function logEntry(entry) {
    jsonlStream.write(`${JSON.stringify(entry)}\n`);
  }

  const checkpoint = args.resume ? loadCheckpointKeys() : new Set();
  const pool = new pg.Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes("supabase") ? { rejectUnauthorized: false } : undefined,
  });

  let client;
  try {
    client = await pool.connect();
    let items = await fetchWorkItems(client, args.field);
    items = items.filter((row) => {
      if (!isExternalImageUrl(row.source_url, supabaseBase)) return false;
      if (args.resume && checkpoint.has(`${row.sku_id}\0${row.field}`)) return false;
      if (args.resume && isZapStoragePublicUrl(row.source_url, supabaseBase)) return false;
      return true;
    });
    if (args.limit != null && Number.isFinite(args.limit)) {
      items = items.slice(0, args.limit);
    }

    console.log(
      `Run ${args.runId}: ${items.length} items | dry-run=${args.dryRun} apply-db=${args.applyDb} concurrency=${args.concurrency}`
    );
    console.log(`Log: ${jsonlPath}`);

    const summary = { ok: 0, fail: 0, skip: 0, dry_probe: 0, bytes: 0 };

    await runPool(items, args.concurrency, async (row, index) => {
      const started = Date.now();
      const base = {
        ts: new Date().toISOString(),
        run_id: args.runId,
        sku_id: row.sku_id,
        field: row.field,
        source_url: row.source_url,
        index: index + 1,
        total: items.length,
      };

      try {
        if (args.dryRun) {
          const head = await downloadImage(row.source_url, { timeoutMs: 15_000, retries: 1 });
          const duration_ms = Date.now() - started;
          summary.dry_probe++;
          summary.bytes += head.bytes;
          const entry = {
            ...base,
            status: "dry_probe",
            http_status: head.httpStatus,
            bytes: head.bytes,
            duration_ms,
            storage_path: null,
            public_url: null,
            error: null,
          };
          logEntry(entry);
          console.log(
            `[${index + 1}/${items.length}] DRY_PROBE ${row.sku_id} ${row.field} ${head.bytes}B ${duration_ms}ms`
          );
          return entry;
        }

        const mirrored = await mirrorListingImage({
          skuId: row.sku_id,
          field: row.field,
          sourceUrl: row.source_url,
        });
        const duration_ms = Date.now() - started;
        summary.ok++;
        summary.bytes += mirrored.bytes;

        if (args.applyDb) {
          await client.query(
            `UPDATE listings SET ${row.field} = $1, updated_at = NOW() WHERE sku_id = $2`,
            [mirrored.publicUrl, row.sku_id]
          );
        }

        const entry = {
          ...base,
          status: "ok",
          http_status: mirrored.httpStatus,
          bytes: mirrored.bytes,
          duration_ms,
          storage_path: mirrored.storagePath,
          public_url: mirrored.publicUrl,
          error: null,
        };
        logEntry(entry);
        appendCheckpoint({ sku_id: row.sku_id, field: row.field, status: "ok", public_url: mirrored.publicUrl });
        console.log(
          `[${index + 1}/${items.length}] OK ${row.sku_id} ${row.field} ${mirrored.bytes}B ${duration_ms}ms`
        );
        return entry;
      } catch (e) {
        const duration_ms = Date.now() - started;
        summary.fail++;
        const msg = e instanceof Error ? e.message : String(e);
        const entry = {
          ...base,
          status: "fail",
          http_status: null,
          bytes: 0,
          duration_ms,
          storage_path: null,
          public_url: null,
          error: msg,
        };
        logEntry(entry);
        console.error(`[${index + 1}/${items.length}] FAIL ${row.sku_id} ${row.field}: ${msg}`);
        return entry;
      }
    });

    jsonlStream.end();
    const summaryPath = path.join(LOGS_DIR, `listing-image-migrate-${args.runId}-summary.json`);
    fs.writeFileSync(
      summaryPath,
      JSON.stringify(
        {
          run_id: args.runId,
          finished_at: new Date().toISOString(),
          total: items.length,
          ...summary,
        },
        null,
        2
      )
    );
    console.log(`Summary: ${summaryPath}`);
    console.log(summary);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
