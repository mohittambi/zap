import { query } from "@/server/db";
import {
  DEFAULT_INSIGHT_CONFIG,
  type InsightConfig,
} from "@/lib/insightTypes";

function mapConfig(row: Record<string, unknown>): InsightConfig {
  return {
    severity_weight_critical: Number(row.severity_weight_critical),
    severity_weight_warning: Number(row.severity_weight_warning),
    severity_weight_info: Number(row.severity_weight_info),
    stockout_cover_days: Number(row.stockout_cover_days),
    dead_stock_days: Number(row.dead_stock_days),
    ordering_cost_default: Number(row.ordering_cost_default),
    holding_cost_pct_default: Number(row.holding_cost_pct_default),
    digest_enabled: Boolean(row.digest_enabled),
  };
}

export async function getInsightConfig(): Promise<InsightConfig> {
  const r = await query(`SELECT * FROM insight_config WHERE id = 1`);
  if (r.rows.length === 0) return DEFAULT_INSIGHT_CONFIG;
  return mapConfig(r.rows[0] as Record<string, unknown>);
}

const PATCHABLE = [
  "severity_weight_critical",
  "severity_weight_warning",
  "severity_weight_info",
  "stockout_cover_days",
  "dead_stock_days",
  "ordering_cost_default",
  "holding_cost_pct_default",
  "digest_enabled",
] as const;

export async function patchInsightConfig(
  fields: Partial<InsightConfig>
): Promise<InsightConfig> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  for (const key of PATCHABLE) {
    if (key in fields) {
      sets.push(`${key} = $${i++}`);
      params.push(fields[key]);
    }
  }
  if (sets.length === 0) return getInsightConfig();
  sets.push(`updated_at = NOW()`);
  await query(
    `UPDATE insight_config SET ${sets.join(", ")} WHERE id = 1`,
    params
  );
  return getInsightConfig();
}
