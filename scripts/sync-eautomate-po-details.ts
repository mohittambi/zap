/**
 * Ingest PO detail snapshot from eautomate (6 GETs per PO).
 *
 * Usage:
 *   npm run sync:po:details -- --vendor <id> --po <id>
 *   npm run sync:po:details:from-db
 *
 * Env: DATABASE_URL, EAUTOMATE_COOKIE or EAUTOMATE_BEARER_TOKEN
 */
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { query } from "../src/server/db";
import { ingestPoDetailsByVendorAndPo } from "../src/server/services/eautomatePoDetailsIngestService";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

function parseArgs(argv: string[]) {
  let vendor: number | null = null;
  let po: number | null = null;
  let fromDb = false;
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
    }
  }
  return { vendor, po, fromDb };
}

async function main() {
  const { vendor, po, fromDb } = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const pairs: { vendor_id: number; po_id: number }[] = [];
  if (fromDb) {
    const r = await query(
      `SELECT vendor_id, po_id FROM vendor_purchase_orders ORDER BY po_id ASC`
    );
    for (const row of r.rows as { vendor_id: string | number; po_id: string | number }[]) {
      pairs.push({
        vendor_id: Number(row.vendor_id),
        po_id: Number(row.po_id),
      });
    }
    if (pairs.length === 0) {
      console.error("No rows in vendor_purchase_orders. Sync vendor POs first.");
      process.exit(1);
    }
    console.log(`Ingesting PO details for ${pairs.length} PO(s)...`);
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
        "   or: npm run sync:po:details:from-db"
    );
    process.exit(1);
  }

  let ok = 0;
  let fail = 0;
  for (const { vendor_id, po_id } of pairs) {
    try {
      process.stdout.write(`PO ${po_id} (vendor ${vendor_id})... `);
      await ingestPoDetailsByVendorAndPo(vendor_id, po_id);
      console.log("ok");
      ok += 1;
    } catch (e) {
      console.log("failed");
      console.error(e instanceof Error ? e.message : e);
      fail += 1;
    }
  }
  console.log(`Done. ${ok} ok, ${fail} failed.`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
