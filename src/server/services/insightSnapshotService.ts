import { query } from "@/server/db";
import type { Insight } from "@/lib/insightTypes";

export type InsightSnapshotSummary = {
  total: number;
  by_domain: Record<string, number>;
  by_severity: Record<string, number>;
};

export async function saveInsightSnapshot(opts: {
  trigger: "SCHEDULED" | "MANUAL";
  insights: Insight[];
}): Promise<{ snapshot_id: number; summary: InsightSnapshotSummary }> {
  const summary: InsightSnapshotSummary = {
    total: opts.insights.length,
    by_domain: {},
    by_severity: {},
  };
  for (const ins of opts.insights) {
    summary.by_domain[ins.domain] = (summary.by_domain[ins.domain] ?? 0) + 1;
    summary.by_severity[ins.severity] =
      (summary.by_severity[ins.severity] ?? 0) + 1;
  }

  const snap = await query(
    `INSERT INTO insight_snapshots (trigger, summary)
     VALUES ($1, $2::jsonb)
     RETURNING id`,
    [opts.trigger, summary as object]
  );
  const snapshotId = Number(snap.rows[0].id);

  for (const ins of opts.insights) {
    await query(
      `INSERT INTO insight_snapshot_items (
         snapshot_id, insight_key, domain, severity, entity_type, entity_id,
         title, rationale, recommended_action, impact_value, priority, raw
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
      [
        snapshotId,
        ins.insight_key,
        ins.domain,
        ins.severity,
        ins.entity?.type ?? null,
        ins.entity?.id ?? null,
        ins.title,
        ins.rationale,
        ins.recommended_action,
        ins.impact_value,
        ins.priority,
        ins.raw ?? {},
      ]
    );
  }

  return { snapshot_id: snapshotId, summary };
}

export async function listInsightSnapshots(opts: {
  page: number;
  limit: number;
}) {
  const offset = (opts.page - 1) * opts.limit;
  const countR = await query(`SELECT COUNT(*)::int AS total FROM insight_snapshots`);
  const total = Number(countR.rows[0].total);
  const listR = await query(
    `SELECT id, generated_at, trigger, summary, created_at
     FROM insight_snapshots
     ORDER BY generated_at DESC
     LIMIT $1 OFFSET $2`,
    [opts.limit, offset]
  );
  return {
    total,
    page: opts.page,
    per_page_count: opts.limit,
    content: listR.rows,
  };
}

export async function getInsightSnapshot(id: number) {
  const head = await query(
    `SELECT id, generated_at, trigger, summary, created_at
     FROM insight_snapshots WHERE id = $1`,
    [id]
  );
  if (head.rows.length === 0) return null;
  const items = await query(
    `SELECT * FROM insight_snapshot_items WHERE snapshot_id = $1 ORDER BY priority DESC`,
    [id]
  );
  return { ...head.rows[0], items: items.rows };
}
