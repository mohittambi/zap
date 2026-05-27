import { query } from "@/server/db";
import { ensureZapOutboundSequences } from "@/server/utils/ensureZapOutboundSequences";

export type OutboundPoLogRow = {
  id: number;
  outbound_po_id: number;
  po_number: string | null;
  consignment_id: number | null;
  foreign_key: number | null;
  operation: string | null;
  remarks: string | null;
  created_by: string | null;
  created_at: string | null;
  synced_at: string | null;
};

function pickFirst(
  obj: Record<string, unknown>,
  keys: string[]
): unknown {
  for (const k of keys) {
    if (k in obj && obj[k] != null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

function pickStr(obj: Record<string, unknown>, keys: string[], max: number): string | null {
  const v = pickFirst(obj, keys);
  if (v == null) return null;
  return String(v).trim().slice(0, max) || null;
}

function pickInt(obj: Record<string, unknown>, keys: string[]): number | null {
  const v = pickFirst(obj, keys);
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function parseTs(v: unknown): Date | null {
  if (v == null || v === "") return null;
  const d = new Date(String(v).trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Normalize one API log row → DB columns + raw JSON string. */
export function normalizePoLogRow(raw: Record<string, unknown>): {
  id: number;
  po_number: string | null;
  consignment_id: number | null;
  foreign_key: number | null;
  operation: string | null;
  remarks: string | null;
  created_by: string | null;
  created_at: Date | null;
  rawJson: string;
} | null {
  const id =
    pickInt(raw, ["id", "log_id", "logId"]) ??
    pickInt(raw, ["incoming_purchase_order_log_id"]);
  if (id == null || id < 1) return null;

  return {
    id,
    po_number: pickStr(raw, ["po_number", "poNumber"], 80),
    consignment_id: pickInt(raw, ["consignment_id", "consignmentId"]),
    foreign_key: pickInt(raw, ["foreign_key", "foreignKey", "fk_id", "fkId"]),
    operation: pickStr(
      raw,
      ["operation_performed", "operationPerformed", "operation", "action"],
      160
    ),
    remarks: pickStr(raw, ["remarks", "remark", "message", "description"], 8000),
    created_by: pickStr(raw, ["created_by", "createdBy", "performed_by"], 160),
    created_at: parseTs(pickFirst(raw, ["created_at", "createdAt", "created_date"])),
    rawJson: JSON.stringify(raw),
  };
}

export async function upsertOutboundPoLogsFromEautomate(
  outboundPoId: number,
  rows: Record<string, unknown>[]
): Promise<number> {
  if (!Number.isFinite(outboundPoId) || outboundPoId < 1) return 0;
  let n = 0;
  for (const row of rows) {
    const raw =
      row && typeof row === "object" && !Array.isArray(row)
        ? (row as Record<string, unknown>)
        : null;
    if (!raw) continue;
    const m = normalizePoLogRow(raw);
    if (!m) continue;
    await query(
      `INSERT INTO outbound_po_logs (
        id, outbound_po_id, po_number, consignment_id, foreign_key, operation, remarks,
        created_by, created_at, raw, synced_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,NOW())
      ON CONFLICT (id) DO UPDATE SET
        outbound_po_id = EXCLUDED.outbound_po_id,
        po_number = EXCLUDED.po_number,
        consignment_id = EXCLUDED.consignment_id,
        foreign_key = EXCLUDED.foreign_key,
        operation = EXCLUDED.operation,
        remarks = EXCLUDED.remarks,
        created_by = EXCLUDED.created_by,
        created_at = EXCLUDED.created_at,
        raw = EXCLUDED.raw,
        synced_at = NOW()`,
      [
        m.id,
        outboundPoId,
        m.po_number,
        m.consignment_id,
        m.foreign_key,
        m.operation,
        m.remarks,
        m.created_by,
        m.created_at,
        m.rawJson,
      ]
    );
    n += 1;
  }
  return n;
}

function rowToApi(r: Record<string, unknown>): OutboundPoLogRow {
  return {
    id: Number(r.id),
    outbound_po_id: Number(r.outbound_po_id),
    po_number: r.po_number != null ? String(r.po_number) : null,
    consignment_id:
      r.consignment_id != null ? Number(r.consignment_id) : null,
    foreign_key: r.foreign_key != null ? Number(r.foreign_key) : null,
    operation: r.operation != null ? String(r.operation) : null,
    remarks: r.remarks != null ? String(r.remarks) : null,
    created_by: r.created_by != null ? String(r.created_by) : null,
    created_at: r.created_at
      ? new Date(r.created_at as string).toISOString()
      : null,
    synced_at: r.synced_at
      ? new Date(r.synced_at as string).toISOString()
      : null,
  };
}

export async function listOutboundPoLogs(
  outboundPoId: number
): Promise<OutboundPoLogRow[]> {
  if (!Number.isFinite(outboundPoId) || outboundPoId < 1) return [];
  const r = await query(
    `SELECT id, outbound_po_id, po_number, consignment_id, foreign_key, operation,
            remarks, created_by, created_at, synced_at
     FROM outbound_po_logs
     WHERE outbound_po_id = $1
     ORDER BY created_at DESC NULLS LAST, id DESC`,
    [outboundPoId]
  );
  return r.rows.map((row) => rowToApi(row as Record<string, unknown>));
}

/** Logs whose `consignment_id` matches (for mobile consignment detail / logs). */
export async function listOutboundPoLogsByConsignmentId(
  consignmentId: number
): Promise<OutboundPoLogRow[]> {
  if (!Number.isFinite(consignmentId) || consignmentId < 1) return [];
  const r = await query(
    `SELECT id, outbound_po_id, po_number, consignment_id, foreign_key, operation,
            remarks, created_by, created_at, synced_at
     FROM outbound_po_logs
     WHERE consignment_id = $1
     ORDER BY created_at DESC NULLS LAST, id DESC`,
    [consignmentId]
  );
  return r.rows.map((row) => rowToApi(row as Record<string, unknown>));
}

/** Insert a PO activity log row created in Zap (not from eAutomate sync). */
export async function insertOutboundPoLogFromZap(opts: {
  outboundPoId: number;
  poNumber: string | null;
  consignmentId: number | null;
  operation: string;
  remarks?: string | null;
  createdBy: string | null;
}): Promise<number> {
  await ensureZapOutboundSequences();
  const idR = await query(`SELECT nextval('outbound_po_logs_zap_id_seq')::bigint AS id`);
  const logId = Number(idR.rows[0]?.id);
  if (!Number.isFinite(logId) || logId < 1) {
    throw new Error("Failed to allocate Zap PO log id");
  }
  const raw = JSON.stringify({
    source: "zap",
    operation: opts.operation,
    consignment_id: opts.consignmentId,
  });
  await query(
    `INSERT INTO outbound_po_logs (
      id, outbound_po_id, po_number, consignment_id, foreign_key, operation, remarks,
      created_by, created_at, raw, synced_at
    ) VALUES ($1,$2,$3,$4,NULL,$5,$6,$7,NOW(),$8::jsonb,NOW())`,
    [
      logId,
      opts.outboundPoId,
      opts.poNumber != null ? String(opts.poNumber).slice(0, 80) : null,
      opts.consignmentId,
      opts.operation.slice(0, 160),
      opts.remarks != null ? String(opts.remarks).slice(0, 8000) : null,
      opts.createdBy != null ? String(opts.createdBy).slice(0, 160) : null,
      raw,
    ]
  );
  return logId;
}

/** Write a Zap-side activity log for a consignment (non-fatal if PO link is missing). */
export async function logConsignmentActivityFromZap(opts: {
  consignmentId: number;
  operation: string;
  remarks?: string | null;
  createdBy?: string | null;
}): Promise<void> {
  try {
    const cR = await query(
      `SELECT c.po_number, o.id AS outbound_po_id
         FROM outbound_consignments c
         LEFT JOIN outbound_purchase_orders o
           ON TRIM(COALESCE(o.po_number, '')) = TRIM(COALESCE(c.po_number, ''))
        WHERE c.id = $1
        LIMIT 1`,
      [opts.consignmentId]
    );
    if (cR.rows.length === 0) return;
    const row = cR.rows[0] as { po_number?: string | null; outbound_po_id?: unknown };
    const outboundPoId =
      row.outbound_po_id != null && Number.isFinite(Number(row.outbound_po_id))
        ? Number(row.outbound_po_id)
        : null;
    if (!outboundPoId) return;

    await insertOutboundPoLogFromZap({
      outboundPoId,
      poNumber: row.po_number != null ? String(row.po_number) : null,
      consignmentId: opts.consignmentId,
      operation: opts.operation,
      remarks: opts.remarks,
      createdBy: opts.createdBy ?? null,
    });
  } catch {
    /* Activity logging must not fail the primary operation. */
  }
}
