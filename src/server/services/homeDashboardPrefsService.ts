import { query } from "@/server/db";
import {
  DASHBOARD_CARD_IDS,
  DEFAULT_LAYOUT_V2,
  migrateLayout,
  type DashboardCardId,
  type DashboardLayout,
  type DashboardLayoutV2,
} from "@/lib/dashboard-card-ids";

export { DASHBOARD_CARD_IDS, DEFAULT_LAYOUT_V2 };
export type { DashboardCardId, DashboardLayout, DashboardLayoutV2 };

async function tableExists(): Promise<boolean> {
  try {
    await query(`SELECT 1 FROM user_dashboard_prefs LIMIT 1`);
    return true;
  } catch {
    return false;
  }
}

/** Always returns a v2 layout; persisted v1 rows migrate transparently. */
export async function getDashboardPrefs(userId: number): Promise<DashboardLayoutV2> {
  if (!(await tableExists())) return DEFAULT_LAYOUT_V2;
  const r = await query(
    `SELECT layout FROM user_dashboard_prefs WHERE user_id = $1`,
    [userId]
  );
  if (r.rows.length === 0) return DEFAULT_LAYOUT_V2;
  return migrateLayout(r.rows[0].layout);
}

/** Accepts v1 or v2 on the wire; persists v2. */
export async function setDashboardPrefs(
  userId: number,
  layout: unknown
): Promise<DashboardLayoutV2> {
  const clean = migrateLayout(layout);
  if (!(await tableExists())) {
    console.warn(
      "user_dashboard_prefs table missing; layout PUT is a no-op until migrate runs."
    );
    return clean;
  }
  await query(
    `INSERT INTO user_dashboard_prefs (user_id, layout, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (user_id) DO UPDATE
       SET layout = EXCLUDED.layout, updated_at = NOW()`,
    [userId, JSON.stringify(clean)]
  );
  return clean;
}
