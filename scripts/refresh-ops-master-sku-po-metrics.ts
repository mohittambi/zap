/**
 * Recompute ops_master_sku_po_metrics from existing Postgres tables (no eAutomate calls).
 *
 *   npm run refresh:ops-sku-po-metrics
 */
import { config } from "dotenv";
import { resolve } from "node:path";

const root = resolve(process.cwd());
config({ path: resolve(root, ".env") });
config({ path: resolve(root, ".env.local"), override: true });

async function main() {
  const { refreshOpsMasterSkuPoMetricsCache } = await import(
    "../src/server/services/opsSkuPoControlService"
  );
  const result = await refreshOpsMasterSkuPoMetricsCache();
  console.log(
    `[refresh:ops-sku-po-metrics] upserted ${result.row_count} rows at ${result.computed_at}`
  );
  console.log(
    `[refresh:ops-sku-po-metrics] open outbound POs=${result.meta.open_outbound_po_count} inbound=${result.meta.open_inbound_po_count} missing_snapshot=${result.meta.pos_without_snapshot}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
