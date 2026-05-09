import { query } from "@/server/db";
import {
  DASHBOARD_CARD_IDS,
  type DashboardCardId,
  type DashboardLayout,
} from "@/lib/dashboard-card-ids";

export { DASHBOARD_CARD_IDS };
export type { DashboardCardId, DashboardLayout };

export const DEFAULT_LAYOUT: DashboardLayout = {
  visible_cards: [...DASHBOARD_CARD_IDS],
  default_company_id: null,
};

function sanitizeLayout(raw: unknown): DashboardLayout {
  const allowed = new Set<string>(DASHBOARD_CARD_IDS);
  if (typeof raw !== "object" || raw == null) return DEFAULT_LAYOUT;
  const obj = raw as { visible_cards?: unknown; default_company_id?: unknown };
  const visible = Array.isArray(obj.visible_cards)
    ? (obj.visible_cards.filter(
        (v): v is DashboardCardId => typeof v === "string" && allowed.has(v)
      ) as DashboardCardId[])
    : [...DASHBOARD_CARD_IDS];
  const dcRaw = obj.default_company_id;
  const default_company_id =
    typeof dcRaw === "number" && Number.isFinite(dcRaw) ? dcRaw : null;
  return { visible_cards: visible, default_company_id };
}

async function tableExists(): Promise<boolean> {
  try {
    await query(`SELECT 1 FROM user_dashboard_prefs LIMIT 1`);
    return true;
  } catch {
    return false;
  }
}

export async function getDashboardPrefs(userId: number): Promise<DashboardLayout> {
  if (!(await tableExists())) return DEFAULT_LAYOUT;
  const r = await query(
    `SELECT layout FROM user_dashboard_prefs WHERE user_id = $1`,
    [userId]
  );
  if (r.rows.length === 0) return DEFAULT_LAYOUT;
  return sanitizeLayout(r.rows[0].layout);
}

export async function setDashboardPrefs(
  userId: number,
  layout: DashboardLayout
): Promise<DashboardLayout> {
  if (!(await tableExists())) {
    // Migration not applied — accept the request silently so the UI works,
    // but warn so a deployment misstep is visible in logs.
    console.warn(
      "user_dashboard_prefs table missing; layout PUT is a no-op until migrate runs."
    );
    return sanitizeLayout(layout);
  }
  const clean = sanitizeLayout(layout);
  await query(
    `INSERT INTO user_dashboard_prefs (user_id, layout, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (user_id) DO UPDATE
       SET layout = EXCLUDED.layout, updated_at = NOW()`,
    [userId, JSON.stringify(clean)]
  );
  return clean;
}
