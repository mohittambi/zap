/**
 * Verify outbound company directory rollups using the same server code as
 * `GET /api/outbound/companies` — no HTTP / no Next.js required.
 *
 * Use after `sync:outbound-companies` (+ outbound PO data) so `outbound_purchase_orders`
 * join metrics are populated. Master sync runs this as Phase 4d.
 *
 * Env: DATABASE_URL (required)
 *
 * Usage:
 *   npm run verify:outbound-companies
 *   npx tsx scripts/verify-outbound-companies-directory.ts --limit 3
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { listOutboundCompaniesPaginated } from "../src/server/services/outboundPurchaseOrdersService";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

function parseLimit(argv: string[]): number {
  let limit = 5;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--limit" && argv[i + 1]) {
      const n = Number.parseInt(argv[i + 1], 10);
      if (Number.isFinite(n)) {
        limit = Math.min(50, Math.max(1, n));
      }
      i++;
    }
  }
  return limit;
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[verify-outbound-companies] DATABASE_URL is required.");
    process.exit(1);
  }

  const limit = parseLimit(process.argv.slice(2));
  const t0 = Date.now();
  const page1 = await listOutboundCompaniesPaginated({
    page: 1,
    limit,
    search: undefined,
  });

  console.log(
    `[verify-outbound-companies] OK in ${Date.now() - t0}ms — total companies: ${page1.total}, page rows: ${page1.curr_page_count}`
  );
  if (page1.summary) {
    console.log("[verify-outbound-companies] summary:");
    console.log(JSON.stringify(page1.summary, null, 2));
  } else {
    console.warn("[verify-outbound-companies] warning: no summary on payload (unexpected).");
  }
  if (page1.content.length > 0) {
    const r = page1.content[0];
    console.log(
      `[verify-outbound-companies] sample: id=${r.id} name=${JSON.stringify(r.name)} open=${r.open_pos} ack=${r.ack_pending}`
    );
  }
}

main().catch((e) => {
  console.error("[verify-outbound-companies]", e);
  process.exit(1);
});
