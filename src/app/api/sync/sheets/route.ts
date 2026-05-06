/**
 * POST /api/sync/sheets   — trigger an inventory → Google Sheets sync
 * GET  /api/sync/sheets   — return the last sync log entry (status, counts, errors)
 *
 * Secured by one of two mechanisms (in priority order):
 *   1. CRON_SECRET header  — for Vercel Cron Jobs
 *      Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically.
 *   2. requireAuth + bins:read permission — for manual triggers by logged-in users
 *
 * The POST is idempotent: calling it while another sync is RUNNING will still
 * proceed. Callers should check the last sync log first if they need to avoid overlap.
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth';
import { assertPermission } from '@/server/rbac';
import { handleApiError } from '@/server/errors';
import { runSync, getLastSyncLog } from '@/server/services/sheetsSyncService';

function isCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) { return false; }
  const auth = request.headers.get('authorization') ?? '';
  return auth === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  try {
    if (!isCronRequest(request)) {
      const user = await requireAuth(request);
      assertPermission(user, 'bins', 'read');
    }
    const log = await getLastSyncLog();
    return NextResponse.json({ last_sync: log });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    if (!isCronRequest(request)) {
      const user = await requireAuth(request);
      assertPermission(user, 'bins', 'read');
    }

    const result = await runSync();

    const httpStatus = result.status === 'FAILED' ? 500 : 200;
    return NextResponse.json(result, { status: httpStatus });
  } catch (err) {
    return handleApiError(err);
  }
}
