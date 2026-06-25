/** Pure rules for when an inbound PO may be cancelled (business guard). */

export type PoCancelGrnRow = {
  grn_id?: number | null;
  grn_status?: string | null;
  grn_audit_status?: string | null;
  grn_invoice_collection_status?: string | null;
  accounts_status?: string | null;
  grn_sku_count?: number | null;
  grn_accepted_quantity?: number | null;
  grn_invoice_quantity?: number | null;
  /** From mergePoGrnSources raw when header fields live in JSONB */
  raw?: Record<string, unknown>;
};

const TERMINAL_AUDIT = new Set(["CLOSED", "AUDITED", "DONE", "COMPLETED"]);
const TERMINAL_ACCOUNTS = new Set(["APPROVED", "REJECTED"]);

function norm(v: string | null | undefined): string {
  return String(v ?? "").trim().toUpperCase();
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function field(
  row: PoCancelGrnRow,
  headerKey: keyof PoCancelGrnRow,
  rawKeys: string[]
): string {
  const direct = row[headerKey];
  if (direct != null && String(direct).trim() !== "") {
    return norm(String(direct));
  }
  const raw = row.raw;
  if (!raw) return "";
  for (const k of rawKeys) {
    const v = raw[k];
    if (v != null && String(v).trim() !== "") return norm(String(v));
  }
  return "";
}

function qty(row: PoCancelGrnRow, headerKey: keyof PoCancelGrnRow, rawKeys: string[]): number {
  const direct = row[headerKey];
  if (direct != null && direct !== "") return num(direct);
  const raw = row.raw;
  if (!raw) return 0;
  for (const k of rawKeys) {
    const v = raw[k];
    if (v != null && v !== "") return num(v);
  }
  return 0;
}

export type PoCancelBlockReason = {
  grn_id: number | null;
  reason: string;
};

/**
 * Returns null when cancel is allowed, or a block reason when any linked GRN
 * has receipt activity or terminal workflow state.
 */
export function poCancelBlockReason(
  grns: ReadonlyArray<PoCancelGrnRow>
): PoCancelBlockReason | null {
  for (const row of grns) {
    const gid = row.grn_id != null && Number.isFinite(Number(row.grn_id))
      ? Number(row.grn_id)
      : null;
    const status = field(row, "grn_status", ["grn_status", "status"]);
    const audit = field(row, "grn_audit_status", ["grn_audit_status", "audit_status"]);
    const invoice = field(row, "grn_invoice_collection_status", [
      "grn_invoice_collection_status",
      "invoice_collection_status",
    ]);
    const accounts = field(row, "accounts_status", ["accounts_status"]);

    if (status === "OPEN" || status === "CLOSED") {
      return {
        grn_id: gid,
        reason: `GRN ${gid ?? "—"} is ${status.toLowerCase()}; cancel the PO only before goods receipt starts.`,
      };
    }
    if (TERMINAL_AUDIT.has(audit)) {
      return {
        grn_id: gid,
        reason: `GRN ${gid ?? "—"} audit is ${audit.toLowerCase()}; the PO cannot be cancelled.`,
      };
    }
    if (invoice === "COLLECTED") {
      return {
        grn_id: gid,
        reason: `GRN ${gid ?? "—"} invoice is collected; the PO cannot be cancelled.`,
      };
    }
    if (TERMINAL_ACCOUNTS.has(accounts)) {
      return {
        grn_id: gid,
        reason: `GRN ${gid ?? "—"} accounts status is ${accounts.toLowerCase()}; the PO cannot be cancelled.`,
      };
    }

    const skuCount = qty(row, "grn_sku_count", ["grn_sku_count", "sku_count"]);
    const accepted = qty(row, "grn_accepted_quantity", [
      "grn_accepted_quantity",
      "accepted_quantity",
    ]);
    const invoiced = qty(row, "grn_invoice_quantity", [
      "grn_invoice_quantity",
      "invoice_quantity",
    ]);

    if (skuCount > 0 || accepted > 0 || invoiced > 0) {
      return {
        grn_id: gid,
        reason: `GRN ${gid ?? "—"} has receipt quantities recorded; the PO cannot be cancelled.`,
      };
    }
  }
  return null;
}

export function canCancelPo(
  grns: ReadonlyArray<PoCancelGrnRow>,
  zapCancelled: boolean
): boolean {
  if (zapCancelled) return false;
  return poCancelBlockReason(grns) === null;
}
