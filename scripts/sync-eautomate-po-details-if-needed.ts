/**
 * Conditionally ingest inbound PO detail (6 GETs per PO) when snapshot/lines are missing.
 * Vital for PO detail SKU lines, listings, and GRN snapshot on eAutomate-source POs.
 *
 * Examples:
 *   npm run sync:po:details:if-needed -- --po 16826
 *   npm run sync:po:details:if-needed -- --vendor 12333 --po 16826
 *   npm run sync:po:details:if-needed -- --vendor 12333
 *   npm run sync:po:details:if-needed -- --all-missing
 */
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import {
  checkPoDetailsIngestNeeded,
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
  let allMissing = false;
  let continueOnError = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--vendor" && argv[i + 1]) {
      vendor = Number(argv[i + 1]);
      i += 1;
    } else if (a === "--po" && argv[i + 1]) {
      po = Number(argv[i + 1]);
      i += 1;
    } else if (a === "--all-missing") {
      allMissing = true;
    } else if (a === "--continue-on-error") {
      continueOnError = true;
    }
  }
  return { vendor, po, allMissing, continueOnError };
}

async function main() {
  const { vendor, po, allMissing, continueOnError } = parseArgs(
    process.argv.slice(2)
  );
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  if (po != null && Number.isFinite(po) && po >= 1 && !allMissing) {
    const check = await checkPoDetailsIngestNeeded(po);
    if (!check.needed) {
      console.log(`PO ${po}: skip (${check.reason})`);
      return;
    }
    const vid =
      vendor != null && Number.isFinite(vendor) && vendor >= 1
        ? vendor
        : check.vendor_id;
    if (vid == null || !Number.isFinite(vid)) {
      console.error(`PO ${po}: cannot resolve vendor_id`);
      process.exit(1);
    }
    process.stdout.write(`PO ${po} (vendor ${vid}) [${check.reason}]... `);
    await ingestPoDetailsByVendorAndPo(vid, po);
    console.log("ok");
    return;
  }

  if (allMissing || vendor != null) {
    const pairs = await listPoIdsNeedingDetailIngest({
      vendorId: vendor ?? undefined,
      poId: po ?? undefined,
    });
    if (pairs.length === 0) {
      console.log("No POs need detail ingest.");
      return;
    }
    console.log(`Ingesting ${pairs.length} PO(s) missing snapshot/lines...`);
    let ok = 0;
    let fail = 0;
    for (const row of pairs) {
      try {
        process.stdout.write(
          `PO ${row.po_id} (vendor ${row.vendor_id}) [${row.reason}]... `
        );
        await ingestPoDetailsByVendorAndPo(row.vendor_id, row.po_id);
        console.log("ok");
        ok += 1;
      } catch (e) {
        console.log("failed");
        console.error(e instanceof Error ? e.message : e);
        fail += 1;
        if (!continueOnError) process.exit(1);
      }
    }
    console.log(`Done. ${ok} ok, ${fail} failed.`);
    if (fail > 0) process.exit(1);
    return;
  }

  console.error(
    "Usage:\n" +
      "  npm run sync:po:details:if-needed -- --po <id>\n" +
      "  npm run sync:po:details:if-needed -- --vendor <id> [--po <id>]\n" +
      "  npm run sync:po:details:if-needed -- --all-missing"
  );
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
