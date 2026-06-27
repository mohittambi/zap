#!/usr/bin/env bash
# One-off owned orchestrator: finish PO details safely (idempotent), then ops metrics, then verify.
# Safe: each PO is an atomic transaction; --missing-only re-selects only incomplete POs.
set -uo pipefail

export DATABASE_URL="postgresql://postgres.bxgmcddxmlsgrflnbywv:V0Cqy5RbsB1DggT5@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres"
export PG_POOL_MAX=6

cd "$(dirname "$0")/.."

missing_count() {
  node -e 'const {Client}=require("pg");(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();const r=await c.query("select count(*)::int n from vendor_purchase_orders po where po.source=\x27eautomate\x27 and (not exists(select 1 from inbound_po_detail_snapshot s where s.po_id=po.po_id) or (po.sku_count>0 and not exists(select 1 from inbound_po_detail_lines l where l.po_id=po.po_id)))");process.stdout.write(String(r.rows[0].n));await c.end();})().catch(e=>{process.stderr.write(e.message);process.exit(1)})'
}

echo "=== PO DETAILS FINISH (owned) — start $(date -u +%FT%TZ) ==="
START_MISSING=$(missing_count)
echo "missing at start: $START_MISSING"

MAX_PASSES=5
for pass in $(seq 1 $MAX_PASSES); do
  REMAIN=$(missing_count)
  echo "--- pass $pass: $REMAIN PO(s) remaining ---"
  if [ "$REMAIN" -eq 0 ]; then
    echo "all PO details present; no more passes needed"
    break
  fi
  npm run sync:po:details:missing -- --concurrency 4 --continue-on-error
  sleep 5
done

FINAL_MISSING=$(missing_count)
echo "=== missing after passes: $FINAL_MISSING ==="
if [ "$FINAL_MISSING" -ne 0 ]; then
  echo "!! PO details NOT complete ($FINAL_MISSING remaining) — NOT running ops metrics. Investigate logs."
  exit 1
fi

echo "=== PO details complete — refreshing ops SKU PO metrics ==="
npm run refresh:ops-sku-po-metrics
sleep 3

echo "=== FINAL VERIFICATION ==="
node -e 'const {Client}=require("pg");(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();
const q=async(s)=>Number((await c.query(s)).rows[0].n);
const out={
  eautomate_pos: await q("select count(*)::int n from vendor_purchase_orders where source=\x27eautomate\x27"),
  snapshots: await q("select count(*)::int n from inbound_po_detail_snapshot"),
  lines: await q("select count(*)::int n from inbound_po_detail_lines"),
  grns: await q("select count(*)::int n from inbound_po_detail_grns"),
  missing_to_ingest: await q("select count(*)::int n from vendor_purchase_orders po where po.source=\x27eautomate\x27 and (not exists(select 1 from inbound_po_detail_snapshot s where s.po_id=po.po_id) or (po.sku_count>0 and not exists(select 1 from inbound_po_detail_lines l where l.po_id=po.po_id)))"),
  snapshot_without_lines: await q("select count(*)::int n from vendor_purchase_orders po where po.source=\x27eautomate\x27 and po.sku_count>0 and exists(select 1 from inbound_po_detail_snapshot s where s.po_id=po.po_id) and not exists(select 1 from inbound_po_detail_lines l where l.po_id=po.po_id)"),
  ops_master_sku_po_metrics: await q("select count(*)::int n from ops_master_sku_po_metrics"),
};
console.log(JSON.stringify(out,null,2));
await c.end();})().catch(e=>{console.error(e.message);process.exit(1)})'

echo "=== DONE $(date -u +%FT%TZ) ==="
