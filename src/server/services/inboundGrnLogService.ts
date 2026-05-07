import { query } from "@/server/db";

export type AppendInboundGrnLogInput = {
  grnId: number;
  logType: string;
  operationPerformed: string;
  remarks?: string | null;
  poId?: number | null;
  vendorId?: number | null;
  foreignKey?: number | null;
  skuId?: string | null;
  invoiceQuantity?: number | null;
  acceptedQuantity?: number | null;
  rejectedQuantity?: number | null;
  receivedPrice?: number | null;
  /** App user identifier (e.g. email). */
  createdBy: string;
  /** Optional extra JSON for audit; avoid secrets. */
  raw?: Record<string, unknown>;
};

/**
 * Append one activity row for a GRN. Logs are owned by Zap; ingest does not replace them.
 */
export async function appendInboundGrnLog(input: AppendInboundGrnLogInput): Promise<void> {
  const grnId = Number(input.grnId);
  if (!Number.isFinite(grnId) || grnId === 0) return;

  const now = new Date();
  const rawPayload = {
    source: "zap",
    ...(input.raw ?? {}),
  };
  await query(
    `INSERT INTO inbound_grn_logs (
      grn_id, log_id, line_index, log_type, operation_performed, po_id, vendor_id, foreign_key,
      sku_id, invoice_quantity, accepted_quantity, rejected_quantity, received_price,
      remarks, created_by, created_at, updated_at, raw
    ) VALUES (
      $1,
      nextval('inbound_grn_logs_log_id_seq'),
      0,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10,
      $11,
      $12,
      $13,
      $14::timestamptz,
      $15::timestamptz,
      $16::jsonb
    )`,
    [
      grnId,
      input.logType.slice(0, 80),
      input.operationPerformed,
      input.poId ?? null,
      input.vendorId ?? null,
      input.foreignKey ?? null,
      input.skuId ?? null,
      input.invoiceQuantity ?? null,
      input.acceptedQuantity ?? null,
      input.rejectedQuantity ?? null,
      input.receivedPrice ?? null,
      input.remarks ?? null,
      input.createdBy.slice(0, 100),
      now,
      now,
      rawPayload as object,
    ]
  );
}

/** Same as {@link appendInboundGrnLog} but never throws (logging must not break main flows). */
export async function appendInboundGrnLogSafe(
  input: AppendInboundGrnLogInput
): Promise<void> {
  try {
    await appendInboundGrnLog(input);
  } catch (err) {
    console.error("[appendInboundGrnLog]", err);
  }
}
