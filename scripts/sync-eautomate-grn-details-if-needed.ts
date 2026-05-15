/**
 * Conditionally ingest GRN detail from eAutomate (same 8 GETs as the web app / sync:grn:details):
 *   /purchase_orders/grn/{id}, /purchase_orders/{poId}, /vendors/{vendorId},
 *   invoice_files, debit_credit_notes, logs, addedItems/withListing/withPendency, grn/items/withListing
 *
 * Use when you want a loop over many GRNs but only call upstream when a snapshot is missing or old.
 *
 * Env: DATABASE_URL, EAUTOMATE_COOKIE or EAUTOMATE_BEARER_TOKEN, optional EAUTOMATE_BASE_URL
 *
 * Examples:
 *   npx tsx scripts/sync-eautomate-grn-details-if-needed.ts --grn 3156
 *   npx tsx scripts/sync-eautomate-grn-details-if-needed.ts --grns 3156,3157,3158
 *   npx tsx scripts/sync-eautomate-grn-details-if-needed.ts --all-positive --missing-only
 *   npx tsx scripts/sync-eautomate-grn-details-if-needed.ts --all-positive --stale-hours 48
 */
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { query } from "../src/server/db";
import { ingestGrnDetailsByGrnId } from "../src/server/services/eautomateGrnDetailsIngestService";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

type Opts = {
  grnIds: number[];
  allPositive: boolean;
  missingOnly: boolean;
  staleHours: number | null;
  continueOnError: boolean;
};

function parseArgs(argv: string[]): Opts {
  const grnIds: number[] = [];
  let allPositive = false;
  let missingOnly = false;
  let staleHours: number | null = null;
  let continueOnError = false;

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--grn" && argv[i + 1]) {
      const n = Number(argv[i + 1]);
      if (Number.isFinite(n) && n !== 0) grnIds.push(n);
      i += 1;
    } else if (a === "--grns" && argv[i + 1]) {
      for (const part of argv[i + 1].split(",")) {
        const n = Number(part.trim());
        if (Number.isFinite(n) && n !== 0) grnIds.push(n);
      }
      i += 1;
    } else if (a === "--all-positive") {
      allPositive = true;
    } else if (a === "--missing-only") {
      missingOnly = true;
    } else if (a === "--stale-hours" && argv[i + 1]) {
      staleHours = Number(argv[i + 1]);
      i += 1;
    } else if (a === "--continue-on-error") {
      continueOnError = true;
    }
  }

  return {
    grnIds: [...new Set(grnIds)].sort((x, y) => x - y),
    allPositive,
    missingOnly,
    staleHours:
      staleHours != null && Number.isFinite(staleHours) && staleHours >= 0
        ? staleHours
        : null,
    continueOnError,
  };
}

async function loadAllPositiveGrnIds(): Promise<number[]> {
  const r = await query(
    `SELECT grn_id FROM inbound_grns WHERE grn_id > 0 ORDER BY grn_id ASC`
  );
  return r.rows.map((row: { grn_id: string | number }) => Number(row.grn_id));
}

async function shouldIngest(
  grnId: number,
  missingOnly: boolean,
  staleHours: number | null
): Promise<{ needed: boolean; reason: string }> {
  const r = await query(
    `SELECT synced_at FROM inbound_grn_detail_snapshot WHERE grn_id = $1`,
    [grnId]
  );
  if (r.rows.length === 0) {
    return { needed: true, reason: "no snapshot" };
  }
  if (missingOnly) {
    return { needed: false, reason: "snapshot exists (--missing-only)" };
  }
  if (staleHours != null) {
    const syncedAt = r.rows[0].synced_at as Date | string | null;
    if (syncedAt == null) return { needed: true, reason: "synced_at null" };
    const t =
      typeof syncedAt === "string"
        ? new Date(syncedAt).getTime()
        : syncedAt.getTime();
    const threshold = Date.now() - staleHours * 3600 * 1000;
    if (t < threshold) {
      return { needed: true, reason: `older than ${staleHours}h` };
    }
    return { needed: false, reason: `fresh (within ${staleHours}h)` };
  }
  return { needed: true, reason: "explicit sync" };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  let candidates: number[] = [];
  if (opts.allPositive) {
    if (opts.grnIds.length > 0) {
      console.error("Do not combine --all-positive with --grn/--grns");
      process.exit(1);
    }
    if (!opts.missingOnly && opts.staleHours == null) {
      console.error(
        "With --all-positive, pass --missing-only and/or --stale-hours <hours> to avoid syncing every GRN."
      );
      process.exit(1);
    }
    candidates = await loadAllPositiveGrnIds();
    if (candidates.length === 0) {
      console.error("No positive grn_id rows in inbound_grns.");
      process.exit(1);
    }
    console.log(`Candidates from DB: ${candidates.length} GRN(s)`);
  } else if (opts.grnIds.length > 0) {
    candidates = opts.grnIds;
  } else {
    console.error(
      "Usage:\n" +
        "  npx tsx scripts/sync-eautomate-grn-details-if-needed.ts --grn <id> [--missing-only] [--stale-hours N]\n" +
        "  npx tsx scripts/sync-eautomate-grn-details-if-needed.ts --grns id1,id2 [--missing-only] [--stale-hours N]\n" +
        "  npx tsx scripts/sync-eautomate-grn-details-if-needed.ts --all-positive --missing-only\n" +
        "  npx tsx scripts/sync-eautomate-grn-details-if-needed.ts --all-positive --stale-hours 48\n" +
        "\n" +
        "  --missing-only     only GRNs with no inbound_grn_detail_snapshot row\n" +
        "  --stale-hours N    only missing or snapshot.synced_at older than N hours\n" +
        "  (explicit --grn/--grns without filters: always ingest those ids)\n"
    );
    process.exit(1);
  }

  const useFilter =
    opts.allPositive || opts.missingOnly || opts.staleHours != null;

  const toRun: { id: number; reason: string }[] = [];
  for (const id of candidates) {
    if (!Number.isFinite(id) || id < 1) {
      console.warn(`Skip invalid id: ${id}`);
      continue;
    }
    if (!useFilter && !opts.allPositive) {
      toRun.push({ id, reason: "explicit" });
      continue;
    }
    const { needed, reason } = await shouldIngest(
      id,
      opts.missingOnly,
      opts.staleHours
    );
    if (needed) toRun.push({ id, reason });
    else console.log(`Skip GRN ${id} (${reason})`);
  }

  if (toRun.length === 0) {
    console.log("Nothing to sync.");
    return;
  }

  console.log(`Ingesting ${toRun.length} GRN(s)...`);
  let ok = 0;
  let fail = 0;
  for (const { id, reason } of toRun) {
    process.stdout.write(`GRN ${id} (${reason})... `);
    try {
      await ingestGrnDetailsByGrnId(id);
      console.log("ok");
      ok += 1;
    } catch (e) {
      console.log("failed");
      console.error(e instanceof Error ? e.message : e);
      fail += 1;
      if (!opts.continueOnError) process.exit(1);
    }
  }
  console.log(`Done. ${ok} ok, ${fail} failed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
