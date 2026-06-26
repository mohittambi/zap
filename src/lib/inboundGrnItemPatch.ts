import { grnLineQuantitySumErrorMessage } from "@/lib/grnLineQuantityValidation";
import {
  ACCEPTED_QTY_KEYS,
  INVOICE_QTY_KEYS,
  REJECTED_QTY_KEYS,
  SHORT_QTY_KEYS,
  pickQtyFromRaw,
  type JsonRecord,
} from "@/lib/inboundGrnQuantities";

const RECEIVED_PRICE_KEYS = [
  "received_price",
  "receivedPrice",
  "grn_received_price",
  "current_received_price",
] as const;

const TAX_RATE_KEYS = [
  "tax_rate",
  "taxRate",
  "gst_rate",
  "gstRate",
  "current_grn_tax_rate",
] as const;

const PATCHABLE_BODY_KEYS = [
  "invoice_quantity",
  "accepted_quantity",
  "rejected_quantity",
  "shortage_quantity",
  "received_price",
  "tax_rate",
  "audit_price",
] as const;

export class GrnItemPatchError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "GrnItemPatchError";
    this.statusCode = statusCode;
  }
}

function asRecord(v: unknown): JsonRecord {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as JsonRecord;
  }
  return {};
}

function hasRecognizedPatchKey(body: JsonRecord): boolean {
  return PATCHABLE_BODY_KEYS.some((k) =>
    Object.prototype.hasOwnProperty.call(body, k)
  );
}

function parseProvidedNonNeg(v: unknown, fieldLabel: string): number {
  if (v === undefined) {
    throw new GrnItemPatchError(`${fieldLabel} is required`, 400);
  }
  if (v === null || v === "") {
    throw new GrnItemPatchError(`${fieldLabel} is required`, 400);
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) {
    throw new GrnItemPatchError(
      `${fieldLabel} must be a non-negative number`,
      400
    );
  }
  return n;
}

function mergeNumericField(
  body: JsonRecord,
  bodyKey: string,
  existing: JsonRecord,
  rawKeys: readonly string[],
  fieldLabel: string
): number {
  if (!Object.prototype.hasOwnProperty.call(body, bodyKey)) {
    return pickQtyFromRaw(existing, rawKeys);
  }
  return parseProvidedNonNeg(body[bodyKey], fieldLabel);
}

function parseAuditPrice(body: JsonRecord): number | null | undefined {
  if (!Object.prototype.hasOwnProperty.call(body, "audit_price")) {
    return undefined;
  }
  if (body.audit_price === null || body.audit_price === "") {
    return null;
  }
  const a = Number(body.audit_price);
  if (!Number.isFinite(a) || a < 0) {
    throw new GrnItemPatchError(
      "audit_price must be a non-negative number or empty",
      400
    );
  }
  return a;
}

/**
 * Merge a partial PATCH body into an existing inbound_grn_items.raw row.
 * Omitted qty/price fields keep their stored values; audit_price optional.
 */
export function mergeGrnItemPatchIntoRaw(
  existingRaw: unknown,
  body: unknown
): JsonRecord {
  const existing = asRecord(existingRaw);
  const patch = asRecord(body);

  if (!hasRecognizedPatchKey(patch)) {
    throw new GrnItemPatchError("No fields to update", 400);
  }

  const merged: JsonRecord = { ...existing };

  const invoice_quantity = mergeNumericField(
    patch,
    "invoice_quantity",
    existing,
    INVOICE_QTY_KEYS,
    "invoice_quantity"
  );
  const accepted_quantity = mergeNumericField(
    patch,
    "accepted_quantity",
    existing,
    ACCEPTED_QTY_KEYS,
    "accepted_quantity"
  );
  const rejected_quantity = mergeNumericField(
    patch,
    "rejected_quantity",
    existing,
    REJECTED_QTY_KEYS,
    "rejected_quantity"
  );
  const shortage_quantity = mergeNumericField(
    patch,
    "shortage_quantity",
    existing,
    SHORT_QTY_KEYS,
    "shortage_quantity"
  );
  const received_price = mergeNumericField(
    patch,
    "received_price",
    existing,
    RECEIVED_PRICE_KEYS,
    "received_price"
  );
  const tax_rate = mergeNumericField(
    patch,
    "tax_rate",
    existing,
    TAX_RATE_KEYS,
    "tax_rate"
  );

  const qtyTouched = ["invoice_quantity", "accepted_quantity", "rejected_quantity", "shortage_quantity"].some(
    (k) => Object.prototype.hasOwnProperty.call(patch, k)
  );
  if (qtyTouched) {
    const qtySumMsg = grnLineQuantitySumErrorMessage({
      invoice_quantity,
      accepted_quantity,
      rejected_quantity,
      shortage_quantity,
    });
    if (qtySumMsg) {
      throw new GrnItemPatchError(qtySumMsg, 400);
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(patch, "invoice_quantity") ||
    Object.prototype.hasOwnProperty.call(patch, "accepted_quantity") ||
    Object.prototype.hasOwnProperty.call(patch, "rejected_quantity") ||
    Object.prototype.hasOwnProperty.call(patch, "shortage_quantity") ||
    Object.prototype.hasOwnProperty.call(patch, "received_price") ||
    Object.prototype.hasOwnProperty.call(patch, "tax_rate")
  ) {
    merged.invoice_quantity = invoice_quantity;
    merged.accepted_quantity = accepted_quantity;
    merged.rejected_quantity = rejected_quantity;
    merged.shortage_quantity = shortage_quantity;
    merged.received_price = received_price;
    merged.tax_rate = tax_rate;
  }

  const auditPriceOut = parseAuditPrice(patch);
  if (auditPriceOut === null) {
    delete merged.audit_price;
    delete merged.auditPrice;
    delete merged.audit_price_excl_gst;
    delete merged.audit_price_exclusive_gst;
  } else if (auditPriceOut !== undefined) {
    merged.audit_price = auditPriceOut;
  }

  return merged;
}
