/**
 * Mark known zap-created POs as source='zap' and purge any phantom
 * inbound_po_detail_* rows that previous sync:po:details* runs may have
 * deposited under their colliding ids (the GRN-3157-under-zap-PO-16719 bug).
 *
 * Usage:
 *   npm run fix:zap-pos -- 16719
 *   npm run fix:zap-pos -- 16719 16720 16721
 *
 * Safe to re-run; UPDATE is idempotent and DELETEs are no-ops on already-clean rows.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const dotenv = require("dotenv");
const { Client } = require("pg");

dotenv.config({ path: ".env.local" });
dotenv.config();

function parseIds(argv) {
  const ids = [];
  for (const arg of argv.slice(2)) {
    const n = Number.parseInt(arg, 10);
    if (!Number.isFinite(n) || n === 0) {
      console.error(`Skipping non-numeric or zero id: ${arg}`);
      continue;
    }
    ids.push(n);
  }
  return [...new Set(ids)];
}

async function main() {
  const ids = parseIds(process.argv);
  if (ids.length === 0) {
    console.error("Usage: npm run fix:zap-pos -- <po_id> [<po_id> ...]");
    process.exit(2);
  }

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set (check .env.local)");
    process.exit(2);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  let flipped = 0;
  let snapDel = 0;
  let linesDel = 0;
  let grnsDel = 0;

  try {
    await client.query("BEGIN");
    for (const poId of ids) {
      const exists = await client.query(
        `SELECT po_id, source FROM vendor_purchase_orders WHERE po_id = $1`,
        [poId]
      );
      if (exists.rows.length === 0) {
        console.warn(`po_id=${poId}: not found in vendor_purchase_orders, skipping`);
        continue;
      }

      const r = await client.query(
        `UPDATE vendor_purchase_orders SET source = 'zap'
          WHERE po_id = $1 AND source <> 'zap'`,
        [poId]
      );
      flipped += r.rowCount ?? 0;

      const g = await client.query(
        `DELETE FROM inbound_po_detail_grns WHERE po_id = $1`,
        [poId]
      );
      grnsDel += g.rowCount ?? 0;

      const l = await client.query(
        `DELETE FROM inbound_po_detail_lines WHERE po_id = $1`,
        [poId]
      );
      linesDel += l.rowCount ?? 0;

      const s = await client.query(
        `DELETE FROM inbound_po_detail_snapshot WHERE po_id = $1`,
        [poId]
      );
      snapDel += s.rowCount ?? 0;

      console.log(
        `po_id=${poId}: source-flipped=${r.rowCount ?? 0} grns_deleted=${g.rowCount ?? 0} lines_deleted=${l.rowCount ?? 0} snapshot_deleted=${s.rowCount ?? 0}`
      );
    }
    await client.query("COMMIT");
    console.log(
      `\nDone. POs flipped to source=zap: ${flipped}. Phantom rows purged: grns=${grnsDel}, lines=${linesDel}, snapshot=${snapDel}.`
    );
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Rolled back:", e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

void main();
