/**
 * Backfill zap-source GRNs that were created before the doctrine fixes:
 *   1. set inbound_grns.source = 'zap' for any GRN whose grn_id is in the
 *      zap sequence range (≥ 10000000001) or is negative (legacy draft);
 *   2. populate po_sku_count + po_total_quantity from vendor_purchase_orders
 *      where they are still 0 and the parent PO has values;
 *   3. seed a "GRN draft created in zap" entry in inbound_grn_logs for any
 *      zap GRN that has no log entries yet.
 *
 * Usage:
 *   npm run fix:zap-grns               # all zap GRNs
 *   npm run fix:zap-grns -- 10000000001 # specific grn_ids
 *
 * Idempotent.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const dotenv = require("dotenv");
const { Client } = require("pg");

dotenv.config({ path: ".env.local" });
dotenv.config();

function parseIds(argv) {
  const out = [];
  for (const arg of argv.slice(2)) {
    const n = Number.parseInt(arg, 10);
    if (!Number.isFinite(n) || n === 0) {
      console.error(`Skipping non-numeric or zero id: ${arg}`);
      continue;
    }
    out.push(n);
  }
  return [...new Set(out)];
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set (check .env.local)");
    process.exit(2);
  }

  const explicit = parseIds(process.argv);
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  let sourceFlipped = 0;
  let totalsBackfilled = 0;
  let logsSeeded = 0;

  try {
    await client.query("BEGIN");

    /** Step 1 — flip source for sequence-allocated or negative-id GRNs. */
    const flipR = explicit.length > 0
      ? await client.query(
          `UPDATE inbound_grns SET source = 'zap'
            WHERE grn_id = ANY($1::bigint[]) AND source <> 'zap'`,
          [explicit]
        )
      : await client.query(
          `UPDATE inbound_grns SET source = 'zap'
            WHERE source <> 'zap' AND (grn_id < 0 OR grn_id >= 10000000001)`
        );
    sourceFlipped = flipR.rowCount ?? 0;

    /** Step 2 — backfill po_sku_count + po_total_quantity from PO. */
    const totalsR = explicit.length > 0
      ? await client.query(
          `UPDATE inbound_grns g
              SET po_sku_count = po.sku_count,
                  po_total_quantity = po.total_quantity,
                  updated_at = NOW()
             FROM vendor_purchase_orders po
            WHERE g.po_id = po.po_id
              AND g.grn_id = ANY($1::bigint[])
              AND g.source = 'zap'
              AND (g.po_sku_count = 0 OR g.po_total_quantity = 0)
              AND (po.sku_count > 0 OR po.total_quantity > 0)`,
          [explicit]
        )
      : await client.query(
          `UPDATE inbound_grns g
              SET po_sku_count = po.sku_count,
                  po_total_quantity = po.total_quantity,
                  updated_at = NOW()
             FROM vendor_purchase_orders po
            WHERE g.po_id = po.po_id
              AND g.source = 'zap'
              AND (g.po_sku_count = 0 OR g.po_total_quantity = 0)
              AND (po.sku_count > 0 OR po.total_quantity > 0)`
        );
    totalsBackfilled = totalsR.rowCount ?? 0;

    /** Step 3a — seed inbound_grn_items from vendor_purchase_order_lines for any
     * zap GRN that has no items. The seeder mirrors the runtime path used by
     * createDraftGrnForPo so newly-created drafts always have their SKU rows. */
    const itemsR = explicit.length > 0
      ? await client.query(
          `INSERT INTO inbound_grn_items (grn_id, line_index, sku_id, raw)
           SELECT g.grn_id,
                  (row_number() OVER (PARTITION BY g.grn_id ORDER BY l.id) - 1)::int,
                  l.sku_id,
                  jsonb_build_object(
                    'sku_id', l.sku_id,
                    'quantity', l.quantity,
                    'accepted_quantity', l.quantity
                  )
             FROM inbound_grns g
             JOIN vendor_purchase_order_lines l ON l.po_id = g.po_id
            WHERE g.grn_id = ANY($1::bigint[])
              AND g.source = 'zap'
              AND NOT EXISTS (
                SELECT 1 FROM inbound_grn_items i WHERE i.grn_id = g.grn_id
              )`,
          [explicit]
        )
      : await client.query(
          `INSERT INTO inbound_grn_items (grn_id, line_index, sku_id, raw)
           SELECT g.grn_id,
                  (row_number() OVER (PARTITION BY g.grn_id ORDER BY l.id) - 1)::int,
                  l.sku_id,
                  jsonb_build_object(
                    'sku_id', l.sku_id,
                    'quantity', l.quantity,
                    'accepted_quantity', l.quantity
                  )
             FROM inbound_grns g
             JOIN vendor_purchase_order_lines l ON l.po_id = g.po_id
            WHERE g.source = 'zap'
              AND NOT EXISTS (
                SELECT 1 FROM inbound_grn_items i WHERE i.grn_id = g.grn_id
              )`
        );
    const itemsSeeded = itemsR.rowCount ?? 0;

    /** Step 3 — seed creation log for zap GRNs with no logs. */
    const logsR = explicit.length > 0
      ? await client.query(
          `INSERT INTO inbound_grn_logs (
             grn_id, log_id, line_index, log_type, operation_performed,
             po_id, vendor_id, created_by, created_at, updated_at, raw
           )
           SELECT g.grn_id, nextval('inbound_grn_logs_log_id_seq'), 0,
                  'STATUS', 'GRN draft created in zap (backfilled)',
                  g.po_id, g.vendor_id,
                  COALESCE(g.created_by, 'system'),
                  g.created_at, g.created_at,
                  jsonb_build_object('source', 'zap', 'backfilled', true)
             FROM inbound_grns g
            WHERE g.grn_id = ANY($1::bigint[])
              AND g.source = 'zap'
              AND NOT EXISTS (
                SELECT 1 FROM inbound_grn_logs l WHERE l.grn_id = g.grn_id
              )`,
          [explicit]
        )
      : await client.query(
          `INSERT INTO inbound_grn_logs (
             grn_id, log_id, line_index, log_type, operation_performed,
             po_id, vendor_id, created_by, created_at, updated_at, raw
           )
           SELECT g.grn_id, nextval('inbound_grn_logs_log_id_seq'), 0,
                  'STATUS', 'GRN draft created in zap (backfilled)',
                  g.po_id, g.vendor_id,
                  COALESCE(g.created_by, 'system'),
                  g.created_at, g.created_at,
                  jsonb_build_object('source', 'zap', 'backfilled', true)
             FROM inbound_grns g
            WHERE g.source = 'zap'
              AND NOT EXISTS (
                SELECT 1 FROM inbound_grn_logs l WHERE l.grn_id = g.grn_id
              )`
        );
    logsSeeded = logsR.rowCount ?? 0;

    await client.query("COMMIT");
    console.log(
      `Done. source flipped: ${sourceFlipped}, po totals backfilled: ${totalsBackfilled}, line items seeded: ${itemsSeeded}, creation logs seeded: ${logsSeeded}.`
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
