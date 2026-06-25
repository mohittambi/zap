import { query } from "@/server/db";

export async function logAdminAction(
  adminUserId: number,
  action: string,
  targetUserId?: number | null,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await query(
      `INSERT INTO admin_audit_log (admin_user_id, action, target_user_id, details, created_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW())`,
      [
        adminUserId,
        action.slice(0, 100),
        targetUserId ?? null,
        JSON.stringify(details ?? {}),
      ]
    );
  } catch (err) {
    console.error("admin_audit_log insert failed:", err);
  }
}
