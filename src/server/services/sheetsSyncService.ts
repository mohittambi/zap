/**
 * Google Sheets sync service — inventory snapshot.
 *
 * DB is the source of truth. The sheet is a read-only mirror.
 * Sync direction: DB → Sheet (never the other way).
 *
 * Sheet columns (A–I):
 *   A  SKU ID       B  Description    C  Current Qty
 *   D  Expected Qty E  Available Qty  F  Min Reorder Qty
 *   G  Reorder Alert H  Bin-wise Qty  I  Last Synced (UTC)
 *
 * Required env vars:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
 *   GOOGLE_SHEETS_SPREADSHEET_ID
 *   GOOGLE_SHEETS_TAB_NAME  (default: "Inventory")
 */

import { query } from '@/server/db';
import { getAccessToken } from '@/server/lib/googleAuth';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SyncResult = {
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  rows_written: number;
  rows_failed: number;
  error_detail?: string;
  duration_ms: number;
};

type InventoryRow = {
  sku_id: string;
  description: string | null;
  current_qty: number;
  expected_qty: number;
  available_qty: number;
  min_reorder_qty: number;
  is_below_reorder: boolean;
  bin_wise_qty: string;
};

class SheetsApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'SheetsApiError';
  }
}

// ── Config ────────────────────────────────────────────────────────────────────

const SHEET_HEADERS = [
  'SKU ID', 'Description', 'Current Qty', 'Expected Qty',
  'Available Qty', 'Min Reorder Qty', 'Reorder Alert', 'Bin-wise Qty', 'Last Synced (UTC)',
];

const BATCH_SIZE = 500;    // rows per Sheets API write call
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

// Retry only on transient failures; config errors (4xx except 429) should fail fast
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

function getSheetConfig(): { spreadsheetId: string; tabName: string } {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID is not set');
  }
  return { spreadsheetId, tabName: process.env.GOOGLE_SHEETS_TAB_NAME ?? 'Inventory' };
}

// ── DB snapshot query ─────────────────────────────────────────────────────────

async function fetchInventorySnapshot(): Promise<InventoryRow[]> {
  const result = await query(
    `WITH
     sales_30d AS (
       SELECT sku_id, SUM(quantity)::int AS sold_30d
       FROM   warehouse_inventory_dump
       WHERE  inventory_operation_type = 'REMOVE'
         AND  (movement_type IS NULL OR movement_type = 'SALE')
         AND  created_at >= NOW() - INTERVAL '30 days'
       GROUP  BY sku_id
     ),
     current_stock AS (
       SELECT
         sku_id,
         SUM(available_quantity)::int AS current_qty,
         STRING_AGG(
           bin_id || ': ' || available_quantity::text,
           ' | ' ORDER BY bin_id
         ) AS bin_wise_qty
       FROM bins
       WHERE is_deleted = false
       GROUP BY sku_id
     ),
     expected_inbound AS (
       SELECT sku_id, SUM(quantity)::int AS expected_qty
       FROM   incoming_quantity
       GROUP  BY sku_id
     )
     SELECT
       l.sku_id,
       l.description,
       COALESCE(cs.current_qty,  0)   AS current_qty,
       COALESCE(ei.expected_qty, 0)   AS expected_qty,
       COALESCE(cs.current_qty,  0) + COALESCE(ei.expected_qty, 0) AS available_qty,
       CASE
         WHEN COALESCE(rc.use_advanced, false) THEN
           GREATEST(0, ROUND(
             (COALESCE(s.sold_30d, 0)::numeric / 30.0) * COALESCE(rc.lead_time_days, 7)
           ))::int
         ELSE COALESCE(s.sold_30d, 0)
       END AS min_reorder_qty,
       (
         COALESCE(cs.current_qty, 0) + COALESCE(ei.expected_qty, 0)
       ) < CASE
         WHEN COALESCE(rc.use_advanced, false) THEN
           GREATEST(0, ROUND(
             (COALESCE(s.sold_30d, 0)::numeric / 30.0) * COALESCE(rc.lead_time_days, 7)
           ))::int
         ELSE COALESCE(s.sold_30d, 0)
       END AS is_below_reorder,
       COALESCE(cs.bin_wise_qty, '')  AS bin_wise_qty
     FROM listings l
     LEFT JOIN sales_30d          s  ON s.sku_id  = l.sku_id
     LEFT JOIN current_stock      cs ON cs.sku_id = l.sku_id
     LEFT JOIN expected_inbound   ei ON ei.sku_id = l.sku_id
     LEFT JOIN sku_reorder_config rc ON rc.sku_id = l.sku_id
     ORDER BY l.sku_id`,
    []
  );

  return result.rows.map(r => ({
    sku_id:          String(r.sku_id),
    description:     r.description != null ? String(r.description) : null,
    current_qty:     Number(r.current_qty),
    expected_qty:    Number(r.expected_qty),
    available_qty:   Number(r.available_qty),
    min_reorder_qty: Number(r.min_reorder_qty),
    is_below_reorder: Boolean(r.is_below_reorder),
    bin_wise_qty:    String(r.bin_wise_qty),
  }));
}

// ── Row formatters ────────────────────────────────────────────────────────────

function formatRow(row: InventoryRow, syncedAt: string): (string | number)[] {
  return [
    row.sku_id,
    row.description ?? '',
    row.current_qty,
    row.expected_qty,
    row.available_qty,
    row.min_reorder_qty,
    row.is_below_reorder ? 'YES' : 'OK',
    row.bin_wise_qty,
    syncedAt,
  ];
}

function buildSheetMatrix(rows: InventoryRow[]): (string | number)[][] {
  const syncedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
  return [SHEET_HEADERS, ...rows.map(r => formatRow(r, syncedAt))];
}

// ── Retry wrapper ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isRetryable =
        !(err instanceof SheetsApiError) ||
        RETRYABLE_STATUSES.has(err.status);

      if (!isRetryable || attempt === MAX_RETRIES) { break; }

      const delayMs = RETRY_BASE_MS * Math.pow(2, attempt);
      console.warn(`[sheets-sync] ${label}: attempt ${attempt + 1} failed, retrying in ${delayMs}ms —`, err instanceof Error ? err.message : err);
      await sleep(delayMs);
    }
  }
  throw lastErr;
}

// ── Sheets API calls ──────────────────────────────────────────────────────────

async function sheetsRequest(
  token: string,
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new SheetsApiError(res.status, `Sheets API ${method} ${path}: HTTP ${res.status} — ${text.slice(0, 300)}`);
  }

  return res.json();
}

async function clearSheet(token: string, spreadsheetId: string, tabName: string): Promise<void> {
  await sheetsRequest(
    token, 'POST',
    `${spreadsheetId}/values/${encodeURIComponent(tabName)}:clear`
  );
}

async function writeBatch(
  token: string,
  spreadsheetId: string,
  tabName: string,
  startRow: number,
  matrix: (string | number)[][]
): Promise<number> {
  const endRow = startRow + matrix.length - 1;
  const range = `${tabName}!A${startRow}:I${endRow}`;
  await sheetsRequest(token, 'PUT', `${spreadsheetId}/values/${encodeURIComponent(range)}`, {
    range,
    majorDimension: 'ROWS',
    values: matrix,
    valueInputOption: 'RAW',
  });
  return matrix.length;
}

// ── Sync log helpers ──────────────────────────────────────────────────────────

async function insertSyncLog(status: 'RUNNING'): Promise<number> {
  const r = await query(
    `INSERT INTO sheets_sync_log (status, started_at) VALUES ($1, NOW()) RETURNING id`,
    [status]
  );
  return Number(r.rows[0].id);
}

async function updateSyncLog(
  id: number,
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED',
  rowsWritten: number,
  rowsFailed: number,
  errorDetail?: string
): Promise<void> {
  await query(
    `UPDATE sheets_sync_log
     SET status = $1, rows_written = $2, rows_failed = $3,
         error_detail = $4, finished_at = NOW()
     WHERE id = $5`,
    [status, rowsWritten, rowsFailed, errorDetail ?? null, id]
  );
}

// ── Main sync orchestrator ────────────────────────────────────────────────────

export async function runSync(): Promise<SyncResult> {
  const startMs = Date.now();
  const logId = await insertSyncLog('RUNNING');
  let rowsWritten = 0;
  let rowsFailed = 0;
  const failedBatchErrors: string[] = [];

  try {
    const { spreadsheetId, tabName } = getSheetConfig();

    const [token, rows] = await Promise.all([
      withRetry('get-token', () => getAccessToken()),
      fetchInventorySnapshot(),
    ]);

    // Clear existing data first
    await withRetry('clear-sheet', () => clearSheet(token, spreadsheetId, tabName));

    // Build the full matrix (header row + data)
    const matrix = buildSheetMatrix(rows);

    // Write in BATCH_SIZE chunks — header always goes in the first batch
    let sheetRow = 1; // 1-indexed
    for (let i = 0; i < matrix.length; i += BATCH_SIZE) {
      const chunk = matrix.slice(i, i + BATCH_SIZE);
      const isHeaderBatch = i === 0;
      const dataRowsInBatch = isHeaderBatch ? chunk.length - 1 : chunk.length;

      try {
        await withRetry(`write-batch-${sheetRow}`, () =>
          writeBatch(token, spreadsheetId, tabName, sheetRow, chunk)
        );
        rowsWritten += dataRowsInBatch;
      } catch (err) {
        rowsFailed += dataRowsInBatch;
        const msg = err instanceof Error ? err.message : String(err);
        failedBatchErrors.push(`batch @row ${sheetRow}: ${msg}`);
        console.error(`[sheets-sync] batch @row ${sheetRow} permanently failed:`, msg);
      }

      sheetRow += chunk.length;
    }

    const status = rowsFailed === 0 ? 'SUCCESS' : rowsWritten > 0 ? 'PARTIAL' : 'FAILED';
    const errorDetail = failedBatchErrors.length > 0 ? failedBatchErrors.join('; ') : undefined;

    await updateSyncLog(logId, status, rowsWritten, rowsFailed, errorDetail);

    return {
      status,
      rows_written: rowsWritten,
      rows_failed:  rowsFailed,
      error_detail: errorDetail,
      duration_ms:  Date.now() - startMs,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateSyncLog(logId, 'FAILED', rowsWritten, rowsFailed, msg).catch(() => {});
    return {
      status:       'FAILED',
      rows_written: rowsWritten,
      rows_failed:  rowsFailed,
      error_detail: msg,
      duration_ms:  Date.now() - startMs,
    };
  }
}

// ── Last sync status ──────────────────────────────────────────────────────────

export async function getLastSyncLog(): Promise<{
  status: string;
  rows_written: number;
  rows_failed: number;
  started_at: string;
  finished_at: string | null;
  error_detail: string | null;
} | null> {
  const r = await query(
    `SELECT status, rows_written, rows_failed, started_at, finished_at, error_detail
     FROM sheets_sync_log
     ORDER BY started_at DESC
     LIMIT 1`,
    []
  );
  if (r.rows.length === 0) { return null; }
  const row = r.rows[0];
  return {
    status:       String(row.status),
    rows_written: Number(row.rows_written),
    rows_failed:  Number(row.rows_failed),
    started_at:   String(row.started_at),
    finished_at:  row.finished_at != null ? String(row.finished_at) : null,
    error_detail: row.error_detail ?? null,
  };
}
