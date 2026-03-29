/**
 * Pull one outbound PO from eAutomate (header + files) into Zap DB.
 *
 * Usage: npx tsx scripts/sync-eautomate-outbound-po-detail.ts 5ONX4CBH
 *    or: npm run sync:outbound-po-detail -- 5ONX4CBH
 *
 * Env: DATABASE_URL, EAUTOMATE_COOKIE or EAUTOMATE_BEARER_TOKEN
 */
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { syncOutboundPurchaseOrderDetailFromEautomate } from "../src/server/services/eautomateOutboundPoDetailSyncService";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

async function main() {
  const po = process.argv[2]?.trim();
  if (!po) {
    console.error("Usage: npx tsx scripts/sync-eautomate-outbound-po-detail.ts <po_number>");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const r = await syncOutboundPurchaseOrderDetailFromEautomate(po);
  console.log(r.ok ? "OK" : "Failed", r.message ?? "");
  if (!r.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
