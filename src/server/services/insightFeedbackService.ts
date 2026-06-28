import { query } from "@/server/db";
import type {
  InsightFeedbackAction,
  SuppressedFeedback,
} from "@/lib/insightTypes";

export async function getActiveFeedback(): Promise<SuppressedFeedback[]> {
  const r = await query(
    `SELECT DISTINCT ON (insight_key)
       insight_key, action, snooze_until::text AS snooze_until
     FROM insight_feedback
     ORDER BY insight_key, created_at DESC`
  );
  return r.rows.map((row) => ({
    insight_key: String(row.insight_key),
    action: row.action as InsightFeedbackAction,
    snooze_until: row.snooze_until == null ? null : String(row.snooze_until),
  }));
}

export async function addInsightFeedback(opts: {
  insight_key: string;
  action: InsightFeedbackAction;
  snooze_until?: string | null;
  note?: string | null;
  created_by: string;
}): Promise<void> {
  await query(
    `INSERT INTO insight_feedback (insight_key, action, snooze_until, note, created_by)
     VALUES ($1, $2, $3::date, $4, $5)`,
    [
      opts.insight_key.slice(0, 120),
      opts.action,
      opts.snooze_until ?? null,
      opts.note?.slice(0, 2000) ?? null,
      opts.created_by.slice(0, 255),
    ]
  );
}
