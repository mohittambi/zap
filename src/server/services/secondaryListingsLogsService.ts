// @ts-nocheck
import { query } from "@/server/db";

export type LogOperation =
  | "CREATE_ASSOCIATION"
  | "UPDATE_CODE"
  | "UPDATE_LABELS"
  | "DELETE_ASSOCIATION";

export interface InsertLogEntry {
  secondary_sku: string;
  company_id?: number | null;
  operation: LogOperation;
  field_name?: string | null;
  old_value?: unknown;
  new_value?: unknown;
  created_by: string;
  raw?: unknown;
}

export async function insertLog(entry: InsertLogEntry): Promise<void> {
  await query(
    `INSERT INTO secondary_listings_logs
       (secondary_sku, company_id, operation, field_name, old_value, new_value, created_by, raw)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      entry.secondary_sku,
      entry.company_id ?? null,
      entry.operation,
      entry.field_name ?? null,
      entry.old_value != null ? JSON.stringify(entry.old_value) : null,
      entry.new_value != null ? JSON.stringify(entry.new_value) : null,
      entry.created_by,
      entry.raw != null ? JSON.stringify(entry.raw) : null,
    ]
  );
}

export async function getLogsForSku(
  secondary_sku: string,
  limit = 50
): Promise<object[]> {
  const r = await query(
    `SELECT id, secondary_sku, company_id, operation, field_name,
            old_value, new_value, created_by, created_at, raw
     FROM secondary_listings_logs
     WHERE secondary_sku = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [secondary_sku, limit]
  );
  return r.rows;
}
