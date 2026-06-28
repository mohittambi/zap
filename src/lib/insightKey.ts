import type { InsightDraft } from "./insightTypes";

/** Stable key for dedup and feedback suppression. */
export function buildInsightKey(draft: Pick<InsightDraft, "rule" | "entity">): string {
  const entityPart = draft.entity
    ? `${draft.entity.type}:${draft.entity.id}`
    : "global";
  return `${draft.rule}|${entityPart}`;
}
