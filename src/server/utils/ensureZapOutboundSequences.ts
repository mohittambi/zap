import { query } from "@/server/db";

let ensured = false;

/** Idempotent: creates Zap ID sequences if migration 067 has not been applied yet. */
export async function ensureZapOutboundSequences(): Promise<void> {
  if (ensured) return;
  await query(
    `CREATE SEQUENCE IF NOT EXISTS outbound_consignments_zap_id_seq START 9000000000000`
  );
  await query(
    `CREATE SEQUENCE IF NOT EXISTS outbound_po_logs_zap_id_seq START 9000000000000`
  );
  ensured = true;
}
