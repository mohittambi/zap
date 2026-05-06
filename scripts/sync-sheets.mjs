#!/usr/bin/env node
/**
 * Sync inventory snapshot → Google Sheets (CLI version).
 *
 * Usage:
 *   npm run sync:sheets
 *   node scripts/sync-sheets.mjs
 *
 * Required env (set in .env.local or export before running):
 *   DATABASE_URL
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
 *   GOOGLE_SHEETS_SPREADSHEET_ID
 *   GOOGLE_SHEETS_TAB_NAME            (optional, default "Inventory")
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { createSign } from 'node:crypto';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Bootstrap env ─────────────────────────────────────────────────────────────

const dotenv = await import('dotenv');
const webRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(webRoot, '.env.local') });
dotenv.config({ path: path.join(webRoot, '.env') });

// ── Config ────────────────────────────────────────────────────────────────────

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const BATCH_SIZE = 500;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

const SHEET_HEADERS = [
  'SKU ID', 'Description', 'Current Qty', 'Expected Qty',
  'Available Qty', 'Min Reorder Qty', 'Reorder Alert', 'Bin-wise Qty', 'Last Synced (UTC)',
];

// ── DB pool ───────────────────────────────────────────────────────────────────

function makePool() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[sync-sheets] DATABASE_URL is not set');
    process.exit(1);
  }
  return new pg.Pool({ connectionString: url, max: 3 });
}

// ── Google Auth ───────────────────────────────────────────────────────────────

let cachedToken = null;

function buildJwt(email, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: email, scope: SHEETS_SCOPE, aud: TOKEN_URL,
    iat: now, exp: now + 3600,
  })).toString('base64url');
  const toSign = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(toSign);
  const sig = signer.sign(privateKey, 'base64url');
  return `${toSign}.${sig}`;
}

async function getAccessToken() {
  const nowMs = Date.now();
  if (cachedToken && cachedToken.expiresAt > nowMs + 60_000) {
    return cachedToken.accessToken;
  }
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
  }
  const privateKey = rawKey.replace(/\\n/g, '\n');
  const assertion = buildJwt(email, privateKey);

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Token exchange failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  cachedToken = { accessToken: json.access_token, expiresAt: nowMs + json.expires_in * 1000 };
  return cachedToken.accessToken;
}

// ── Retry ─────────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function withRetry(label, fn) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err.status ?? 0;
      const retryable = status === 0 || RETRYABLE_STATUSES.has(status);
      if (!retryable || attempt === MAX_RETRIES) { break; }
      const delayMs = RETRY_BASE_MS * Math.pow(2, attempt);
      console.warn(`  [${label}] attempt ${attempt + 1} failed, retrying in ${delayMs}ms: ${err.message}`);
      await sleep(delayMs);
    }
  }
  throw lastErr;
}

// ── Sheets API ────────────────────────────────────────────────────────────────

async function sheetsRequest(token, method, urlPath, body) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${urlPath}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`Sheets API ${method} ${urlPath}: HTTP ${res.status} — ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function clearSheet(token, spreadsheetId, tabName) {
  await sheetsRequest(token, 'POST', `${spreadsheetId}/values/${encodeURIComponent(tabName)}:clear`);
}

async function writeBatch(token, spreadsheetId, tabName, startRow, matrix) {
  const endRow = startRow + matrix.length - 1;
  const range = `${tabName}!A${startRow}:I${endRow}`;
  await sheetsRequest(token, 'PUT', `${spreadsheetId}/values/${encodeURIComponent(range)}`, {
    range, majorDimension: 'ROWS', values: matrix,
    valueInputOption: 'RAW',
  });
  return matrix.length;
}

// ── DB query ──────────────────────────────────────────────────────────────────

async function fetchSnapshot(pool) {
  const r = await pool.query(`
    WITH
    sales_30d AS (
      SELECT sku_id, SUM(quantity)::int AS sold_30d
      FROM   warehouse_inventory_dump
      WHERE  inventory_operation_type = 'REMOVE'
        AND  (movement_type IS NULL OR movement_type = 'SALE')
        AND  created_at >= NOW() - INTERVAL '30 days'
      GROUP  BY sku_id
    ),
    current_stock AS (
      SELECT sku_id,
             SUM(available_quantity)::int AS current_qty,
             STRING_AGG(bin_id || ': ' || available_quantity::text, ' | ' ORDER BY bin_id) AS bin_wise_qty
      FROM bins WHERE is_deleted = false
      GROUP BY sku_id
    ),
    expected_inbound AS (
      SELECT sku_id, SUM(quantity)::int AS expected_qty
      FROM incoming_quantity GROUP BY sku_id
    )
    SELECT
      l.sku_id,
      l.description,
      COALESCE(cs.current_qty,  0) AS current_qty,
      COALESCE(ei.expected_qty, 0) AS expected_qty,
      COALESCE(cs.current_qty,  0) + COALESCE(ei.expected_qty, 0) AS available_qty,
      CASE WHEN COALESCE(rc.use_advanced, false) THEN
        GREATEST(0, ROUND((COALESCE(s.sold_30d, 0)::numeric / 30.0) * COALESCE(rc.lead_time_days, 7)))::int
        ELSE COALESCE(s.sold_30d, 0)
      END AS min_reorder_qty,
      (COALESCE(cs.current_qty, 0) + COALESCE(ei.expected_qty, 0)) < CASE
        WHEN COALESCE(rc.use_advanced, false) THEN
          GREATEST(0, ROUND((COALESCE(s.sold_30d, 0)::numeric / 30.0) * COALESCE(rc.lead_time_days, 7)))::int
        ELSE COALESCE(s.sold_30d, 0)
      END AS is_below_reorder,
      COALESCE(cs.bin_wise_qty, '') AS bin_wise_qty
    FROM listings l
    LEFT JOIN sales_30d          s  ON s.sku_id  = l.sku_id
    LEFT JOIN current_stock      cs ON cs.sku_id = l.sku_id
    LEFT JOIN expected_inbound   ei ON ei.sku_id = l.sku_id
    LEFT JOIN sku_reorder_config rc ON rc.sku_id = l.sku_id
    ORDER BY l.sku_id`);
  return r.rows;
}

function buildMatrix(rows) {
  const syncedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
  return [
    SHEET_HEADERS,
    ...rows.map(r => [
      r.sku_id,
      r.description ?? '',
      Number(r.current_qty),
      Number(r.expected_qty),
      Number(r.available_qty),
      Number(r.min_reorder_qty),
      r.is_below_reorder ? 'YES' : 'OK',
      r.bin_wise_qty ?? '',
      syncedAt,
    ]),
  ];
}

// ── Sync log ──────────────────────────────────────────────────────────────────

async function insertLog(pool) {
  const r = await pool.query(
    `INSERT INTO sheets_sync_log (status, started_at) VALUES ('RUNNING', NOW()) RETURNING id`
  );
  return Number(r.rows[0].id);
}

async function updateLog(pool, id, status, written, failed, errorDetail) {
  await pool.query(
    `UPDATE sheets_sync_log SET status=$1, rows_written=$2, rows_failed=$3, error_detail=$4, finished_at=NOW() WHERE id=$5`,
    [status, written, failed, errorDetail ?? null, id]
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const tabName = process.env.GOOGLE_SHEETS_TAB_NAME ?? 'Inventory';
  if (!spreadsheetId) {
    console.error('[sync-sheets] GOOGLE_SHEETS_SPREADSHEET_ID is not set');
    process.exit(1);
  }

  const pool = makePool();
  const startMs = Date.now();
  const logId = await insertLog(pool);
  let rowsWritten = 0;
  let rowsFailed = 0;
  const errors = [];

  try {
    console.log('[sync-sheets] fetching snapshot…');
    const [token, rows] = await Promise.all([
      withRetry('get-token', () => getAccessToken()),
      fetchSnapshot(pool),
    ]);
    console.log(`[sync-sheets] ${rows.length} SKUs fetched`);

    await withRetry('clear-sheet', () => clearSheet(token, spreadsheetId, tabName));
    console.log('[sync-sheets] sheet cleared');

    const matrix = buildMatrix(rows);

    let sheetRow = 1;
    for (let i = 0; i < matrix.length; i += BATCH_SIZE) {
      const chunk = matrix.slice(i, i + BATCH_SIZE);
      const dataRows = i === 0 ? chunk.length - 1 : chunk.length;
      try {
        await withRetry(`write-batch-${sheetRow}`, () => writeBatch(token, spreadsheetId, tabName, sheetRow, chunk));
        rowsWritten += dataRows;
        console.log(`  batch @row ${sheetRow}: wrote ${dataRows} rows`);
      } catch (err) {
        rowsFailed += dataRows;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`batch @row ${sheetRow}: ${msg}`);
        console.error(`  batch @row ${sheetRow}: FAILED — ${msg}`);
      }
      sheetRow += chunk.length;
    }

    const status = rowsFailed === 0 ? 'SUCCESS' : rowsWritten > 0 ? 'PARTIAL' : 'FAILED';
    await updateLog(pool, logId, status, rowsWritten, rowsFailed, errors.join('; ') || null);
    console.log(`[sync-sheets] ${status} — ${rowsWritten} written, ${rowsFailed} failed (${Date.now() - startMs}ms)`);
    process.exitCode = status === 'FAILED' ? 1 : 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sync-sheets] fatal error:', msg);
    await updateLog(pool, logId, 'FAILED', rowsWritten, rowsFailed, msg).catch(() => {});
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
