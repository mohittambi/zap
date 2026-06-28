export type InsightDomain = "INVENTORY" | "PROCUREMENT" | "SALES";
export type InsightSeverity = "CRITICAL" | "WARNING" | "INFO";
export type InsightEntityType = "SKU" | "VENDOR" | "PO" | "QUEUE";
export type InsightFeedbackAction = "DISMISSED" | "SNOOZED" | "ACTED";

export type InsightEntity = {
  type: InsightEntityType;
  id: string;
};

export type InsightDraft = {
  rule: string;
  domain: InsightDomain;
  severity: InsightSeverity;
  title: string;
  rationale: string;
  recommended_action: string;
  impact_value: number;
  entity?: InsightEntity;
  urgency?: number;
  raw?: Record<string, unknown>;
};

export type Insight = InsightDraft & {
  insight_key: string;
  priority: number;
};

export type InsightConfig = {
  severity_weight_critical: number;
  severity_weight_warning: number;
  severity_weight_info: number;
  stockout_cover_days: number;
  dead_stock_days: number;
  ordering_cost_default: number;
  holding_cost_pct_default: number;
  digest_enabled: boolean;
};

export const DEFAULT_INSIGHT_CONFIG: InsightConfig = {
  severity_weight_critical: 3,
  severity_weight_warning: 2,
  severity_weight_info: 1,
  stockout_cover_days: 14,
  dead_stock_days: 60,
  ordering_cost_default: 500,
  holding_cost_pct_default: 0.2,
  digest_enabled: true,
};

export type SuppressedFeedback = {
  insight_key: string;
  action: InsightFeedbackAction;
  snooze_until: string | null;
};
