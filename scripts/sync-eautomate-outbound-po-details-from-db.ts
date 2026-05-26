/**
 * Pull full outbound PO detail + listings_snapshot from eAutomate for open POs in DB.
 *
 *   npm run sync:outbound-po-details:from-db
 *   npm run sync:outbound-po-details:from-db -- --continue-on-error
 *   npm run sync:outbound-po-details:from-db -- --missing-only
 *
 * Env: DATABASE_URL, EAUTOMATE_COOKIE or EAUTOMATE_BEARER_TOKEN
 */
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { query } from "../src/server/db";
import { syncOutboundPurchaseOrderDetailFromEautomate } from "../src/server/services/eautomateOutboundPoDetailSyncService";
import { OPEN_OUTBOUND_PO_SQL } from "../src/server/services/opsSkuPoControlService";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

function parseArgs(argv: string[]) {
  let continueOnError = false;
  let missingOnly = false;
  for (const a of argv) {
    if (a === "--continue-on-error") continueOnError = true;
    if (a === "--missing-only") missingOnly = true;
  }
  return { continueOnError, missingOnly };
}

async function main() {
  const { continueOnError, missingOnly } = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const missingSql = missingOnly
    ? `AND (
         o.listings_snapshot IS NULL
         OR o.listings_snapshot = '{}'::jsonb
         OR COALESCE(jsonb_array_length(
           CASE WHEN jsonb_typeof(o.listings_snapshot->'content') = 'array'
             THEN o.listings_snapshot->'content'
             WHEN jsonb_typeof(o.listings_snapshot->'data') = 'array'
             THEN o.listings_snapshot->'data'
             ELSE '[]'::jsonb END
         ), 0) = 0
       )`
    : "";

  const r = await query(
    `SELECT o.po_number
     FROM outbound_purchase_orders o
     WHERE ${OPEN_OUTBOUND_PO_SQL}
     ${missingSql}
     ORDER BY o.id ASC`,
    []
  );
  const poNumbers = (r.rows as { po_number: string }[])
    .map((row) => String(row.po_number ?? "").trim())
    .filter(Boolean);

  if (poNumbers.length === 0) {
    console.log("[outbound-po-details:from-db] No POs to sync.");
    return;
  }

  console.log(`[outbound-po-details:from-db] Syncing ${poNumbers.length} open PO(s)…`);

  let ok = 0;
  let fail = 0;
  for (const po of poNumbers) {
    process.stdout.write(`${po}… `);
    try {
      const result = await syncOutboundPurchaseOrderDetailFromEautomate(po);
      if (!result.ok) {
        fail += 1;
        console.log("failed", result.message ?? "");
        if (!continueOnError) process.exit(1);
        continue;
      }
      ok += 1;
      console.log("ok", result.message ? `(${result.message})` : "");
    } catch (e) {
      fail += 1;
      console.log("failed", e instanceof Error ? e.message : e);
      if (!continueOnError) process.exit(1);
    }
  }

  console.log(`[outbound-po-details:from-db] Done. ${ok} ok, ${fail} failed.`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
