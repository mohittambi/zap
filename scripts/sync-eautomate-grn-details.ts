/**
 * Ingest GRN detail snapshot + invoice files + debit/credit notes + line items from eautomate
 * (8 GETs per GRN: live GRN header, PO, vendor, invoice files, debit/credit notes, GRN logs,
 * PO added items, GRN items).
 *
 * Env: DATABASE_URL (required)
 *      EAUTOMATE_COOKIE or EAUTOMATE_BEARER_TOKEN
 *      EAUTOMATE_BASE_URL (optional)
 *
 * Usage:
 *   npm run sync:grn:details -- --grn <id>
 *   npm run sync:grn:details:all
 *   npm run sync:grn:details:all -- --continue-on-error
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

function parseArgs(argv: string[]) {
  let grn: number | null = null;
  let allKnown = false;
  let continueOnError = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--grn" && argv[i + 1]) {
      grn = Number(argv[i + 1]);
      i += 1;
    } else if (a === "--all-known-grns") {
      allKnown = true;
    } else if (a === "--continue-on-error") {
      continueOnError = true;
    }
  }
  return { grn, allKnown, continueOnError };
}

async function main() {
  const { grn, allKnown, continueOnError } = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  let ids: number[] = [];
  if (allKnown) {
    const r = await query(
      `SELECT grn_id FROM inbound_grns ORDER BY grn_id ASC`
    );
    ids = r.rows.map((row: { grn_id: string | number }) => Number(row.grn_id));
    if (ids.length === 0) {
      console.error("No GRNs in inbound_grns. Run npm run sync:grns:all first.");
      process.exit(1);
    }
    console.log(`Ingesting details for ${ids.length} GRN(s)...`);
  } else if (grn != null && Number.isFinite(grn) && grn >= 1) {
    ids = [grn];
  } else {
    console.error(
      "Usage: npm run sync:grn:details -- --grn <id> | npm run sync:grn:details:all"
    );
    process.exit(1);
  }

  let ok = 0;
  let fail = 0;
  for (const id of ids) {
    try {
      process.stdout.write(`GRN ${id}... `);
      await ingestGrnDetailsByGrnId(id);
      console.log("ok");
      ok += 1;
    } catch (e) {
      console.log("failed");
      console.error(e instanceof Error ? e.message : e);
      fail += 1;
    }
  }
  console.log(`Done. ${ok} ok, ${fail} failed.`);
  if (fail > 0 && !continueOnError) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
