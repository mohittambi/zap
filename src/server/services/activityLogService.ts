import { query } from "@/server/db";
import {
  clientIpFromRequest,
  inferResourceFromPath,
  userAgentFromRequest,
} from "@/lib/requestMeta";

export interface LogActivityOpts {
  userId: number;
  sessionId?: string | null;
  action: string;
  resource?: string | null;
  resourceId?: string | null;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  path?: string | null;
  method?: string | null;
  statusCode?: number | null;
  durationMs?: number | null;
}

/** Common request metadata for activity rows. */
export function buildActivityContext(request: Request, userId: number) {
  const path = new URL(request.url).pathname;
  return {
    userId,
    ipAddress: clientIpFromRequest(request),
    userAgent: userAgentFromRequest(request),
    path,
    method: request.method,
    resource: inferResourceFromPath(path),
  };
}

export interface ActivityLogFilters {
  userEmail?: string;
  action?: string;
  resource?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export type ActivityLogRow = {
  id: number;
  user_id: number;
  user_email: string | null;
  session_id: string | null;
  action: string;
  resource: string | null;
  resource_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  path: string | null;
  method: string | null;
  status_code: number | null;
  duration_ms: number | null;
  created_at: string;
};

/** Fire-and-forget activity insert; never throws to callers. */
export async function logActivity(opts: LogActivityOpts): Promise<void> {
  try {
    await query(
      `INSERT INTO activity_log (
         user_id, session_id, action, resource, resource_id, details,
         ip_address, user_agent, path, method, status_code, duration_ms, created_at
       ) VALUES (
         $1, $2::uuid, $3, $4, $5, $6::jsonb, $7::inet, $8, $9, $10, $11, $12, NOW()
       )`,
      [
        opts.userId,
        opts.sessionId ?? null,
        opts.action.slice(0, 100),
        opts.resource?.slice(0, 100) ?? null,
        opts.resourceId?.slice(0, 200) ?? null,
        JSON.stringify(opts.details ?? {}),
        opts.ipAddress ?? null,
        opts.userAgent ?? null,
        opts.path ?? null,
        opts.method?.slice(0, 10) ?? null,
        opts.statusCode ?? null,
        opts.durationMs ?? null,
      ]
    );
  } catch (err) {
    console.error("activity_log insert failed:", err);
  }
}

export async function queryActivityLog(filters: ActivityLogFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: unknown[] = [];
  const emailFilter = filters.userEmail?.trim().toLowerCase();
  const joinUsers = Boolean(emailFilter);

  if (emailFilter) {
    params.push(`%${emailFilter}%`);
    conditions.push(`u.email ILIKE $${params.length}`);
  }
  if (filters.action?.trim()) {
    params.push(filters.action.trim());
    conditions.push(`a.action = $${params.length}`);
  }
  if (filters.resource?.trim()) {
    params.push(filters.resource.trim());
    conditions.push(`a.resource = $${params.length}`);
  }
  if (filters.from?.trim()) {
    params.push(filters.from.trim());
    conditions.push(`a.created_at >= $${params.length}::timestamptz`);
  }
  if (filters.to?.trim()) {
    params.push(filters.to.trim());
    conditions.push(`a.created_at < $${params.length}::timestamptz`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const fromClause = joinUsers
    ? `FROM activity_log a LEFT JOIN users u ON u.id = a.user_id`
    : `FROM activity_log a`;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total ${fromClause} ${where}`,
    params
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  const listParams = [...params, limit, offset];
  const listResult = await query(
    `SELECT a.id, a.user_id, u.email AS user_email, a.session_id::text,
            a.action, a.resource, a.resource_id, a.details,
            a.ip_address::text, a.user_agent, a.path, a.method,
            a.status_code, a.duration_ms, a.created_at
     FROM activity_log a
     LEFT JOIN users u ON u.id = a.user_id
     ${where}
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );

  const items: ActivityLogRow[] = listResult.rows.map((r) => ({
    id: Number(r.id),
    user_id: Number(r.user_id),
    user_email: r.user_email ?? null,
    session_id: r.session_id ?? null,
    action: String(r.action),
    resource: r.resource ?? null,
    resource_id: r.resource_id ?? null,
    details: (r.details as Record<string, unknown>) ?? {},
    ip_address: r.ip_address ?? null,
    user_agent: r.user_agent ?? null,
    path: r.path ?? null,
    method: r.method ?? null,
    status_code: r.status_code != null ? Number(r.status_code) : null,
    duration_ms: r.duration_ms != null ? Number(r.duration_ms) : null,
    created_at:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at),
  }));

  return { total, page, limit, items };
}

export async function listDistinctActivityActions(): Promise<string[]> {
  const r = await query(
    `SELECT DISTINCT action FROM activity_log ORDER BY action ASC LIMIT 200`
  );
  return r.rows.map((row) => String(row.action));
}

export async function listDistinctActivityResources(): Promise<string[]> {
  const r = await query(
    `SELECT DISTINCT resource FROM activity_log
     WHERE resource IS NOT NULL AND TRIM(resource) <> ''
     ORDER BY resource ASC LIMIT 200`
  );
  return r.rows.map((row) => String(row.resource));
}

/** Prune rows older than retentionDays (default 90). */
export async function pruneActivityLog(retentionDays = 90): Promise<number> {
  const r = await query(
    `DELETE FROM activity_log WHERE created_at < NOW() - ($1::int || ' days')::interval`,
    [retentionDays]
  );
  return r.rowCount ?? 0;
}
