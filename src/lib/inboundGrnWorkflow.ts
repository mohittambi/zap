/**
 * Pure transitions for the inbound-GRN pending queues. The service layer
 * issues the SQL; this module just maps {trigger or status patch} → which
 * queues to enqueue/dequeue. Doctrine #10: zap owns workflow ownership for
 * any GRN that exists in zap DB, regardless of source.
 */

export type PendingQueue =
  | "audit"
  | "invoice_collection"
  | "accounts_approval";

export type GrnQueueDelta = {
  enqueue: PendingQueue[];
  dequeue: PendingQueue[];
};

const EMPTY_DELTA: GrnQueueDelta = { enqueue: [], dequeue: [] };

function norm(value: string | null | undefined): string {
  return String(value ?? "").trim().toUpperCase();
}

/** closeGrn flips status OPEN→CLOSED → enters Pending Audit. */
export function grnQueueTransitionsForClose(): GrnQueueDelta {
  return { enqueue: ["audit"], dequeue: [] };
}

/**
 * Field-patch transitions. The trigger is the *new* value of each status
 * field after the PATCH; we don't compare to old values here because the
 * service has already gated "is this a real change". Idempotent inserts /
 * deletes downstream make a no-op patch safe.
 */
export function grnQueueTransitionsForFieldUpdate(fields: {
  grn_audit_status?: string | null;
  grn_invoice_collection_status?: string | null;
  accounts_status?: string | null;
}): GrnQueueDelta {
  const enqueue: PendingQueue[] = [];
  const dequeue: PendingQueue[] = [];

  const audit = norm(fields.grn_audit_status);
  if (audit === "CLOSED" || audit === "AUDITED" || audit === "DONE" || audit === "COMPLETED") {
    dequeue.push("audit");
    enqueue.push("invoice_collection");
  }

  const invoice = norm(fields.grn_invoice_collection_status);
  if (invoice === "COLLECTED") {
    dequeue.push("invoice_collection");
    enqueue.push("accounts_approval");
  }

  const accounts = norm(fields.accounts_status);
  if (accounts === "APPROVED" || accounts === "REJECTED") {
    dequeue.push("accounts_approval");
  }

  if (enqueue.length === 0 && dequeue.length === 0) {
    return EMPTY_DELTA;
  }
  return { enqueue, dequeue };
}
