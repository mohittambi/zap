import { buildInsightKey } from "./insightKey";
import type {
  Insight,
  InsightConfig,
  InsightDraft,
  InsightSeverity,
  SuppressedFeedback,
} from "./insightTypes";

const SEVERITY_WEIGHT: Record<InsightSeverity, keyof InsightConfig> = {
  CRITICAL: "severity_weight_critical",
  WARNING: "severity_weight_warning",
  INFO: "severity_weight_info",
};

export function severityWeight(
  severity: InsightSeverity,
  config: InsightConfig
): number {
  const key = SEVERITY_WEIGHT[severity];
  return Number(config[key]) || 1;
}

export function computeInsightPriority(
  draft: InsightDraft,
  config: InsightConfig,
  maxImpact: number
): number {
  const sw = severityWeight(draft.severity, config);
  const normalizedImpact =
    maxImpact > 0 ? Math.min(1, Math.max(0, draft.impact_value / maxImpact)) : 0;
  const urgency = draft.urgency ?? 1;
  return sw * (0.5 + normalizedImpact * 0.5) * urgency;
}

export function isInsightSuppressed(
  insightKey: string,
  feedback: SuppressedFeedback[],
  todayIso: string
): boolean {
  for (const row of feedback) {
    if (row.insight_key !== insightKey) continue;
    if (row.action === "DISMISSED" || row.action === "ACTED") return true;
    if (row.action === "SNOOZED" && row.snooze_until) {
      if (row.snooze_until >= todayIso) return true;
    }
  }
  return false;
}

export function rankInsights(
  drafts: InsightDraft[],
  config: InsightConfig,
  feedback: SuppressedFeedback[] = [],
  todayIso = new Date().toISOString().slice(0, 10)
): Insight[] {
  const maxImpact = Math.max(1, ...drafts.map((d) => d.impact_value));
  const seen = new Set<string>();
  const ranked: Insight[] = [];

  for (const draft of drafts) {
    const insight_key = buildInsightKey(draft);
    if (seen.has(insight_key)) continue;
    if (isInsightSuppressed(insight_key, feedback, todayIso)) continue;
    seen.add(insight_key);
    ranked.push({
      ...draft,
      insight_key,
      priority: computeInsightPriority(draft, config, maxImpact),
    });
  }

  ranked.sort((a, b) => b.priority - a.priority);
  return ranked;
}
