import * as XLSX from "xlsx";
import getPool, { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { appendInboundGrnLogSafe } from "@/server/services/inboundGrnLogService";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DebitNoteLine = {
  id: number;
  debit_note_id: number;
  grn_id: number;
  line_index: number;
  sku_id: string | null;
  sku_description: string | null;
  quantity: number;
  rejected_quantity: number;
  short_quantity: number;
  vendor_price: number;
  audit_price: number;
  price_diff: number;
  debit_amount: number;
};

export type DebitNote = {
  id: number;
  grn_id: number;
  note_reference: string;
  vendor_id: number | null;
  vendor_name: string | null;
  po_id: number | null;
  total_debit_amount: number;
  line_count: number;
  status: "DRAFT" | "ISSUED" | "EXPORTED" | "CLOSED";
  generated_by: string | null;
  generated_at: string;
  exported_at: string | null;
  notes: string | null;
  dn_number: string | null;
  dn_number_assigned_by: string | null;
  dn_number_assigned_at: string | null;
  cn_copy_file_path: string | null;
  cn_copy_file_name: string | null;
  cn_copy_uploaded_at: string | null;
  cn_copy_uploaded_by: string | null;
  narration: string;
  lines: DebitNoteLine[];
};

export type AuditLine = {
  line_index: number;
  sku_id: string | null;
  sku_description: string | null;
  quantity: number;
  rejected_quantity: number;
  short_quantity: number;
  vendor_price: number;
  audit_price: number;
  price_diff: number;
  debit_amount: number;
  has_discrepancy: boolean;
};

// ── Raw JSON price extraction ──────────────────────────────────────────────────

const RECEIVED_PRICE_KEYS = [
  "received_price", "receivedPrice",
  "grn_received_price", "current_received_price",
];

const AUDIT_PRICE_KEYS = [
  "audit_price", "auditPrice",
  "audit_price_excluding_gst", "auditPriceExclGst",
  "audit_price_exclusive_gst",
];

const ACCEPTED_QTY_KEYS = [
  "accepted_quantity", "acceptedQuantity",
  "grn_accepted_quantity", "current_grn_accepted_quantity",
  "currentGrnAcceptedQuantity",
];

const REJECTED_QTY_KEYS = [
  "rejected_quantity", "rejectedQuantity",
  "grn_rejected_quantity", "current_grn_rejected_quantity",
  "currentGrnRejectedQuantity",
];

const SHORT_QTY_KEYS = [
  "shortage_quantity", "shortageQuantity",
  "grn_shortage_quantity", "current_grn_shortage_quantity",
  "currentGrnShortageQuantity",
];

/** PO snapshot lines (inbound_po_detail_lines) may use these for quantity before GRN receipt. */
const PO_LINE_QTY_FALLBACK_KEYS = [
  "required_quantity",
  "requiredQuantity",
  "quantity",
  "qty",
  "ordered_quantity",
  "orderedQuantity",
];

const SKU_KEYS = [
  "sku_id", "skuId", "sku", "sku_code",
  "listing_id", "listingId", "product_id",
];

const DESCRIPTION_KEYS = [
  "title", "name", "description", "sku_name",
  "listing_title", "product_name", "display_name",
];

type JsonRecord = Record<string, unknown>;

const TERMINAL_NOTE_STATUSES = new Set<DebitNote["status"]>(["ISSUED", "CLOSED"]);

export function pickNum(raw: JsonRecord, keys: string[]): number {
  for (const k of keys) {
    const v = raw[k];
    if (v != null && v !== "") {
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return 0;
}

export function pickStr(raw: JsonRecord, keys: string[]): string {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" || typeof v === "boolean") return String(v).trim();
  }
  return "";
}

function toNum(v: unknown): number {
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}

// ── Internal fetch helpers ────────────────────────────────────────────────────

function buildNarration(grnId: number, poId: number | null, rejectedQty: number, shortageQty: number): string {
  const parts = [`Price diff on GRN ${grnId} — PO ${poId ?? "N/A"}`];
  if (rejectedQty > 0) parts.push(`Damage: ${rejectedQty} units`);
  if (shortageQty > 0) parts.push(`Missing: ${shortageQty} units`);
  return parts.join(" | ");
}

async function fetchNoteById(noteId: number): Promise<DebitNote> {
  const [noteRes, lineRes] = await Promise.all([
    query(
      `SELECT n.id, n.grn_id, n.note_reference, n.vendor_id, n.vendor_name, n.po_id,
              n.total_debit_amount, n.line_count, n.status, n.generated_by,
              n.generated_at, n.exported_at, n.notes,
              n.dn_number, n.dn_number_assigned_by, n.dn_number_assigned_at,
              n.cn_copy_file_path, n.cn_copy_file_name, n.cn_copy_uploaded_at, n.cn_copy_uploaded_by,
              COALESCE(g.grn_rejected_quantity, 0) AS grn_rejected_quantity,
              COALESCE(g.grn_shortage_quantity, 0) AS grn_shortage_quantity
       FROM inbound_zap_debit_notes n
       LEFT JOIN inbound_grns g ON g.grn_id = n.grn_id
       WHERE n.id = $1`,
      [noteId]
    ),
    query(
      `SELECT id, debit_note_id, grn_id, line_index, sku_id, sku_description,
              quantity, rejected_quantity, short_quantity,
              vendor_price, audit_price, price_diff, debit_amount
       FROM inbound_zap_debit_note_lines WHERE debit_note_id = $1
       ORDER BY line_index`,
      [noteId]
    ),
  ]);
  if (noteRes.rows.length === 0) throw new AppError("Debit note not found", 404);
  const note = noteRes.rows[0];
  const grnId = toNum(note.grn_id);
  const poId = note.po_id == null ? null : toNum(note.po_id);
  return {
    id: toNum(note.id),
    grn_id: grnId,
    note_reference: String(note.note_reference ?? ""),
    vendor_id: note.vendor_id == null ? null : toNum(note.vendor_id),
    vendor_name: note.vendor_name ?? null,
    po_id: poId,
    total_debit_amount: toNum(note.total_debit_amount),
    line_count: toNum(note.line_count),
    status: (note.status as DebitNote["status"]) ?? "DRAFT",
    generated_by: note.generated_by ?? null,
    generated_at: String(note.generated_at ?? ""),
    exported_at: note.exported_at ? String(note.exported_at) : null,
    notes: note.notes ?? null,
    dn_number: note.dn_number ?? null,
    dn_number_assigned_by: note.dn_number_assigned_by ?? null,
    dn_number_assigned_at: note.dn_number_assigned_at ? String(note.dn_number_assigned_at) : null,
    cn_copy_file_path: note.cn_copy_file_path ?? null,
    cn_copy_file_name: note.cn_copy_file_name ?? null,
    cn_copy_uploaded_at: note.cn_copy_uploaded_at ? String(note.cn_copy_uploaded_at) : null,
    cn_copy_uploaded_by: note.cn_copy_uploaded_by ?? null,
    narration: buildNarration(grnId, poId, toNum(note.grn_rejected_quantity), toNum(note.grn_shortage_quantity)),
    lines: lineRes.rows.map((l) => ({
      id: toNum(l.id),
      debit_note_id: toNum(l.debit_note_id),
      grn_id: toNum(l.grn_id),
      line_index: toNum(l.line_index),
      sku_id: l.sku_id ?? null,
      sku_description: l.sku_description ?? null,
      quantity: toNum(l.quantity),
      rejected_quantity: toNum(l.rejected_quantity),
      short_quantity: toNum(l.short_quantity),
      vendor_price: toNum(l.vendor_price),
      audit_price: toNum(l.audit_price),
      price_diff: toNum(l.price_diff),
      debit_amount: toNum(l.debit_amount),
    })),
  };
}

/**
 * If `inbound_grn_items` is empty, copy lines from `inbound_po_detail_lines` for this GRN’s `po_id`.
 * Uses only ZAP/Postgres data (seeded or previously synced PO) — no live eAutomate call.
 * Enables debit-note and preview flows for Zap-created draft GRNs without GRN detail ingest.
 */
export async function seedGrnItemsFromPoDetailLinesIfEmpty(
  grnIdRaw: unknown
): Promise<number> {
  const grnId = Number(grnIdRaw);
  if (!Number.isFinite(grnId)) return 0;

  const cnt = await query(
    `SELECT COUNT(*)::int AS c FROM inbound_grn_items WHERE grn_id = $1`,
    [grnId]
  );
  if (Number(cnt.rows[0]?.c) > 0) return 0;

  const grn = await query(`SELECT po_id FROM inbound_grns WHERE grn_id = $1`, [grnId]);
  if (grn.rows.length === 0) return 0;
  const poId = Number(grn.rows[0].po_id);
  if (!Number.isFinite(poId) || poId < 1) return 0;

  /** Snapshot lines (inbound_po_detail_lines) for eAutomate-source POs.
   * For zap-source POs the snapshot is empty by design (doctrine #3); fall back
   * to the canonical vendor_purchase_order_lines so newly-created drafts on
   * zap POs get their SKU rows populated immediately. */
  let lines = await query(
    `SELECT line_index, sku_id, raw FROM inbound_po_detail_lines WHERE po_id = $1 ORDER BY line_index`,
    [poId]
  );
  if (lines.rows.length === 0) {
    const poSrc = await query(
      `SELECT source FROM vendor_purchase_orders WHERE po_id = $1`,
      [poId]
    );
    if (poSrc.rows[0]?.source === "zap") {
      lines = await query(
        `SELECT (row_number() OVER (ORDER BY id) - 1)::int AS line_index,
                sku_id,
                jsonb_build_object('sku_id', sku_id, 'quantity', quantity) AS raw
           FROM vendor_purchase_order_lines
          WHERE po_id = $1
          ORDER BY id`,
        [poId]
      );
    }
  }
  if (lines.rows.length === 0) return 0;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const row of lines.rows) {
      const base: JsonRecord = {
        ...(((row.raw as JsonRecord) ?? {}) as JsonRecord),
      };
      if (pickNum(base, ACCEPTED_QTY_KEYS) === 0) {
        const q = pickNum(base, PO_LINE_QTY_FALLBACK_KEYS);
        if (q > 0) base.accepted_quantity = q;
      }
      if (pickNum(base, RECEIVED_PRICE_KEYS) === 0 && pickNum(base, AUDIT_PRICE_KEYS) === 0) {
        const listing = base.listing as JsonRecord | undefined;
        if (listing && typeof listing === "object") {
          const vp = pickNum(listing, [
            "vendor_price",
            "price",
            "unit_price",
            "list_price",
            "received_price",
          ]);
          const ap = pickNum(listing, ["audit_price", "cost_price", "landing_price"]);
          if (vp > 0) base.received_price = vp;
          if (ap > 0) base.audit_price = ap;
        }
      }
      const rawJson = JSON.stringify(base, (_k, v) =>
        typeof v === "bigint" ? v.toString() : v
      );
      await client.query(
        `INSERT INTO inbound_grn_items (grn_id, line_index, sku_id, raw)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [grnId, row.line_index, row.sku_id, rawJson]
      );
    }
    await client.query("COMMIT");
    return lines.rows.length;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// ── Audit preview (read-only) ─────────────────────────────────────────────────

export async function getAuditPreview(grnIdRaw: unknown): Promise<AuditLine[]> {
  const grnId = Number(grnIdRaw);
  if (!Number.isFinite(grnId)) throw new AppError("Invalid grn_id", 400);

  await seedGrnItemsFromPoDetailLinesIfEmpty(grnId);

  const res = await query(
    `SELECT line_index, sku_id, raw FROM inbound_grn_items WHERE grn_id = $1 ORDER BY line_index`,
    [grnId]
  );

  return res.rows.map((item) => {
    const raw: JsonRecord = (item.raw as JsonRecord) ?? {};
    const vendorPrice = pickNum(raw, RECEIVED_PRICE_KEYS);
    const auditPrice = pickNum(raw, AUDIT_PRICE_KEYS);
    const quantity = pickNum(raw, ACCEPTED_QTY_KEYS);
    const rejectedQty = pickNum(raw, REJECTED_QTY_KEYS);
    const shortQty = pickNum(raw, SHORT_QTY_KEYS);
    const diff = vendorPrice - auditPrice;
    return {
      line_index: toNum(item.line_index),
      sku_id: (item.sku_id as string | null) ?? (pickStr(raw, SKU_KEYS) || null),
      sku_description: pickStr(raw, DESCRIPTION_KEYS) || null,
      quantity,
      rejected_quantity: rejectedQty,
      short_quantity: shortQty,
      vendor_price: vendorPrice,
      audit_price: auditPrice,
      price_diff: diff,
      debit_amount: quantity * diff,
      has_discrepancy: diff > 0 && quantity > 0,
    };
  });
}

// ── Generate debit note ────────────────────────────────────────────────────────

export async function generateDebitNote(
  grnIdRaw: unknown,
  generatedBy: string,
  opts?: { forceRegenerate?: boolean }
): Promise<DebitNote> {
  const grnId = Number(grnIdRaw);
  if (!Number.isFinite(grnId)) throw new AppError("Invalid grn_id", 400);

  const headerRes = await query(
    `SELECT grn_id, vendor_id, vendor_name, po_id FROM inbound_grns WHERE grn_id = $1`,
    [grnId]
  );
  if (headerRes.rows.length === 0) throw new AppError(`GRN ${grnId} not found`, 404);
  const header = headerRes.rows[0];

  await seedGrnItemsFromPoDetailLinesIfEmpty(grnId);

  const itemRes = await query(
    `SELECT line_index, sku_id, raw FROM inbound_grn_items WHERE grn_id = $1 ORDER BY line_index`,
    [grnId]
  );

  if (itemRes.rows.length === 0) {
    throw new AppError(
      `GRN ${grnId} has no line items. Ensure the purchase order has lines in ZAP (open the PO page once if PO data was seeded), or add line items to this GRN.`,
      400
    );
  }

  const existingNoteRes = await query(
    `SELECT id, status FROM inbound_zap_debit_notes WHERE grn_id = $1`,
    [grnId]
  );
  if (existingNoteRes.rows.length > 0) {
    const existingStatus = String(existingNoteRes.rows[0].status ?? "") as DebitNote["status"];
    if (TERMINAL_NOTE_STATUSES.has(existingStatus) && opts?.forceRegenerate !== true) {
      throw new AppError(
        `Cannot regenerate debit note while status is ${existingStatus}.`,
        409
      );
    }
  }

  const candidateLines = itemRes.rows
    .map((item) => {
      const raw: JsonRecord = (item.raw as JsonRecord) ?? {};
      const vendorPrice = pickNum(raw, RECEIVED_PRICE_KEYS);
      const auditPrice = pickNum(raw, AUDIT_PRICE_KEYS);
      const quantity = pickNum(raw, ACCEPTED_QTY_KEYS);
      const rejectedQty = pickNum(raw, REJECTED_QTY_KEYS);
      const shortQty = pickNum(raw, SHORT_QTY_KEYS);
      const diff = vendorPrice - auditPrice;
      return {
        line_index: toNum(item.line_index),
        sku_id: (item.sku_id as string | null) ?? (pickStr(raw, SKU_KEYS) || null),
        sku_description: pickStr(raw, DESCRIPTION_KEYS) || null,
        quantity,
        rejected_quantity: rejectedQty,
        short_quantity: shortQty,
        vendor_price: vendorPrice,
        audit_price: auditPrice,
        price_diff: diff,
        debit_amount: quantity * diff,
      };
    })
    .filter((l) => l.price_diff > 0 && l.quantity > 0);

  if (candidateLines.length === 0) {
    throw new AppError(
      "No price discrepancies found — vendor received_price does not exceed audit_price on any accepted line",
      422
    );
  }

  const totalDebit = candidateLines.reduce((s, l) => s + l.debit_amount, 0);
  const today = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const noteRef = `DN-GRN-${grnId}-${today}`;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const noteResult = await client.query(
      `INSERT INTO inbound_zap_debit_notes
         (grn_id, note_reference, vendor_id, vendor_name, po_id, total_debit_amount,
          line_count, status, generated_by, generated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'DRAFT',$8,NOW())
       ON CONFLICT (grn_id) DO UPDATE SET
         note_reference     = EXCLUDED.note_reference,
         vendor_id          = EXCLUDED.vendor_id,
         vendor_name        = EXCLUDED.vendor_name,
         po_id              = EXCLUDED.po_id,
         total_debit_amount = EXCLUDED.total_debit_amount,
         line_count         = EXCLUDED.line_count,
         status             = 'DRAFT',
         generated_by       = EXCLUDED.generated_by,
         generated_at       = NOW(),
         exported_at        = NULL
       RETURNING id`,
      [
        grnId, noteRef,
        header.vendor_id ?? null,
        header.vendor_name ?? null,
        header.po_id ?? null,
        totalDebit.toFixed(4),
        candidateLines.length,
        generatedBy,
      ]
    );
    const noteId = toNum(noteResult.rows[0].id);

    await client.query(
      `DELETE FROM inbound_zap_debit_note_lines WHERE debit_note_id = $1`,
      [noteId]
    );

    for (const l of candidateLines) {
      await client.query(
        `INSERT INTO inbound_zap_debit_note_lines
           (debit_note_id, grn_id, line_index, sku_id, sku_description,
            quantity, rejected_quantity, short_quantity,
            vendor_price, audit_price, price_diff, debit_amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          noteId, grnId, l.line_index, l.sku_id, l.sku_description,
          l.quantity.toFixed(4), l.rejected_quantity.toFixed(4), l.short_quantity.toFixed(4),
          l.vendor_price.toFixed(4), l.audit_price.toFixed(4),
          l.price_diff.toFixed(4), l.debit_amount.toFixed(4),
        ]
      );
    }

    await client.query("COMMIT");
    await appendInboundGrnLogSafe({
      grnId,
      logType: "DEBIT_NOTE",
      operationPerformed: "Debit note generated",
      remarks: `${noteRef} · ${candidateLines.length} line(s) · total ${totalDebit.toFixed(2)}`,
      poId: header.po_id != null ? Number(header.po_id) : null,
      vendorId: header.vendor_id != null ? Number(header.vendor_id) : null,
      createdBy: String(generatedBy).slice(0, 100),
      raw: {
        note_reference: noteRef,
        line_count: candidateLines.length,
        total_debit: totalDebit,
      },
    });
    return fetchNoteById(noteId);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * After GRN close: best-effort raise Zap DN (rate discrepancy) demand.
 * Does not fail the close path — no discrepancy (422), no items (400),
 * terminal note (**409**, e.g. ISSUED/CLOSED without `forceRegenerate`),
 * or unexpected errors only log here.
 */
export async function tryAutoGenerateDebitNoteAfterGrnClose(
  grnIdRaw: unknown,
  generatedBy: string
): Promise<void> {
  try {
    await generateDebitNote(grnIdRaw, generatedBy, { forceRegenerate: false });
  } catch (e) {
    if (e instanceof AppError) {
      if (e.statusCode === 400 || e.statusCode === 409 || e.statusCode === 422)
        return;
    }
    console.error("[tryAutoGenerateDebitNoteAfterGrnClose]", grnIdRaw, e);
  }
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

export async function getDebitNoteForGrn(grnIdRaw: unknown): Promise<DebitNote> {
  const grnId = Number(grnIdRaw);
  if (!Number.isFinite(grnId)) throw new AppError("Invalid grn_id", 400);

  const res = await query(
    `SELECT id FROM inbound_zap_debit_notes WHERE grn_id = $1`,
    [grnId]
  );
  if (res.rows.length === 0) throw new AppError(`No debit note found for GRN ${grnId}`, 404);
  return fetchNoteById(toNum(res.rows[0].id));
}

// ── DN number assignment ──────────────────────────────────────────────────────

export async function assignDnNumber(
  grnIdRaw: unknown,
  dnNumber: string,
  assignedBy: string
): Promise<DebitNote> {
  const grnId = Number(grnIdRaw);
  if (!Number.isFinite(grnId)) throw new AppError("Invalid grn_id", 400);
  const trimmed = dnNumber.trim();
  if (!trimmed) throw new AppError("dn_number is required", 400);

  const pre = await query(
    `SELECT status FROM inbound_zap_debit_notes WHERE grn_id = $1`,
    [grnId]
  );
  if (pre.rows.length === 0) throw new AppError(`No debit note found for GRN ${grnId}`, 404);
  if (String(pre.rows[0].status) === "CLOSED")
    throw new AppError("Cannot assign DN number to a closed debit note", 409);

  const res = await query(
    `UPDATE inbound_zap_debit_notes
     SET dn_number = $1, dn_number_assigned_by = $2, dn_number_assigned_at = NOW(),
         status = CASE WHEN status IN ('DRAFT','EXPORTED') THEN 'ISSUED' ELSE status END
     WHERE grn_id = $3
     RETURNING id`,
    [trimmed, assignedBy, grnId]
  );
  if (res.rows.length === 0) throw new AppError(`No debit note found for GRN ${grnId}`, 404);
  const note = await fetchNoteById(toNum(res.rows[0].id));
  await appendInboundGrnLogSafe({
    grnId,
    logType: "DEBIT_NOTE",
    operationPerformed: "Debit note number assigned",
    remarks: `DN number: ${trimmed}`,
    createdBy: String(assignedBy).slice(0, 100),
    raw: { dn_number: trimmed },
  });
  return note;
}

// ── CN copy upload ────────────────────────────────────────────────────────────

export async function uploadCnCopy(
  grnIdRaw: unknown,
  filePath: string,
  fileName: string,
  uploadedBy: string
): Promise<DebitNote> {
  const grnId = Number(grnIdRaw);
  if (!Number.isFinite(grnId)) throw new AppError("Invalid grn_id", 400);

  const pre = await query(
    `SELECT status, dn_number FROM inbound_zap_debit_notes WHERE grn_id = $1`,
    [grnId]
  );
  if (pre.rows.length === 0) throw new AppError(`No debit note found for GRN ${grnId}`, 404);
  if (String(pre.rows[0].status) === "CLOSED")
    throw new AppError("Debit note is already closed", 409);
  if (!pre.rows[0].dn_number)
    throw new AppError("Assign a DN number before uploading CN copy", 400);

  const res = await query(
    `UPDATE inbound_zap_debit_notes
     SET cn_copy_file_path = $1, cn_copy_file_name = $2,
         cn_copy_uploaded_at = NOW(), cn_copy_uploaded_by = $3,
         status = 'CLOSED'
     WHERE grn_id = $4
     RETURNING id`,
    [filePath, fileName, uploadedBy, grnId]
  );
  if (res.rows.length === 0) throw new AppError(`No debit note found for GRN ${grnId}`, 404);
  const note = await fetchNoteById(toNum(res.rows[0].id));
  await appendInboundGrnLogSafe({
    grnId,
    logType: "DEBIT_NOTE",
    operationPerformed: "Vendor CN copy uploaded; debit note closed",
    remarks: fileName.slice(0, 500),
    createdBy: String(uploadedBy).slice(0, 100),
    raw: { cn_copy_file_name: fileName },
  });
  return note;
}

// ── Explicit demand close ─────────────────────────────────────────────────────

export async function closeDnDemand(
  grnIdRaw: unknown,
  _closedBy: string
): Promise<DebitNote> {
  const grnId = Number(grnIdRaw);
  if (!Number.isFinite(grnId)) throw new AppError("Invalid grn_id", 400);

  const pre = await query(
    `SELECT status, dn_number FROM inbound_zap_debit_notes WHERE grn_id = $1`,
    [grnId]
  );
  if (pre.rows.length === 0) throw new AppError(`No debit note found for GRN ${grnId}`, 404);
  if (String(pre.rows[0].status) === "CLOSED")
    throw new AppError("Debit note is already closed", 409);
  if (!pre.rows[0].dn_number)
    throw new AppError("Assign a DN number before closing", 400);

  const res = await query(
    `UPDATE inbound_zap_debit_notes SET status = 'CLOSED'
     WHERE grn_id = $1
     RETURNING id`,
    [grnId]
  );
  if (res.rows.length === 0) throw new AppError(`No debit note found for GRN ${grnId}`, 404);
  const note = await fetchNoteById(toNum(res.rows[0].id));
  await appendInboundGrnLogSafe({
    grnId,
    logType: "DEBIT_NOTE",
    operationPerformed: "Debit note demand closed",
    remarks: null,
    createdBy: String(_closedBy).slice(0, 100),
    raw: {},
  });
  return note;
}

// ── Tally CSV export ──────────────────────────────────────────────────────────

export function csvRow(cells: (string | number)[]): string {
  return cells
    .map((c) => {
      const s = String(c);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replaceAll('"', '""')}"`
        : s;
    })
    .join(",");
}

export async function buildTallyCsv(
  grnIdRaw: unknown
): Promise<{ csv: string; filename: string }> {
  const note = await getDebitNoteForGrn(grnIdRaw);

  const dateStr = new Date(note.generated_at).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const lines: string[] = [
    csvRow([
      "VoucherType", "Date", "VoucherNo", "PartyName",
      "StockItem", "Quantity", "RejectedQty", "ShortQty",
      "InvoicePrice", "AuditRate", "RateDiff", "Amount(Debit)", "Narration",
    ]),
  ];

  for (const l of note.lines) {
    lines.push(
      csvRow([
        "Debit Note",
        dateStr,
        note.note_reference,
        note.vendor_name ?? "",
        l.sku_id ?? "",
        Number(l.quantity),
        Number(l.rejected_quantity),
        Number(l.short_quantity),
        Number(l.vendor_price),
        Number(l.audit_price),
        Number(l.price_diff),
        Number(l.debit_amount),
        note.narration,
      ])
    );
  }

  lines.push(
    csvRow(["", "", "", "", "TOTAL", "", "", "", "", "", "", Number(note.total_debit_amount), ""])
  );

  const csv = lines.join("\r\n");

  return { csv, filename: `${note.note_reference}.csv` };
}

export async function markDebitNoteExported(
  grnIdRaw: unknown
): Promise<DebitNote> {
  const grnId = Number(grnIdRaw);
  if (!Number.isFinite(grnId)) throw new AppError("Invalid grn_id", 400);
  const current = await query(
    `SELECT id, status FROM inbound_zap_debit_notes WHERE grn_id = $1`,
    [grnId]
  );
  if (current.rows.length === 0) throw new AppError(`No debit note found for GRN ${grnId}`, 404);
  const status = String(current.rows[0].status ?? "") as DebitNote["status"];
  if (status === "CLOSED" || status === "ISSUED") {
    return fetchNoteById(toNum(current.rows[0].id));
  }
  if (status !== "DRAFT" && status !== "EXPORTED") {
    throw new AppError(`Cannot export debit note in status ${status || "unknown"}`, 409);
  }
  await query(
    `UPDATE inbound_zap_debit_notes
     SET status = 'EXPORTED', exported_at = NOW()
     WHERE grn_id = $1`,
    [grnId]
  );
  return fetchNoteById(toNum(current.rows[0].id));
}

export async function assignDcnNumberForGrn(
  grnIdRaw: unknown,
  dcnNumber: string,
  assignedBy: string
): Promise<{ grn_id: number; note_id: number; credit_debit_note_number: string }> {
  const grnId = Number(grnIdRaw);
  if (!Number.isFinite(grnId)) throw new AppError("Invalid grn_id", 400);
  const trimmed = dcnNumber.trim();
  if (!trimmed) throw new AppError("dcn_number is required", 400);

  const noteRes = await query(
    `SELECT note_id
     FROM inbound_grn_debit_credit_notes
     WHERE grn_id = $1
     ORDER BY updated_at DESC NULLS LAST, note_id DESC
     LIMIT 1`,
    [grnId]
  );
  if (noteRes.rows.length === 0) {
    throw new AppError(`No debit/credit note row found for GRN ${grnId}`, 404);
  }
  const noteId = Number(noteRes.rows[0].note_id);
  await query(
    `UPDATE inbound_grn_debit_credit_notes
     SET credit_debit_note_number = $1,
         credit_debit_note_number_assignment_status = 'ASSIGNED',
         updated_at = NOW(),
         created_by = COALESCE(NULLIF(created_by, ''), $2)
     WHERE grn_id = $3 AND note_id = $4`,
    [trimmed, assignedBy, grnId, noteId]
  );
  return { grn_id: grnId, note_id: noteId, credit_debit_note_number: trimmed };
}

// ── Invoice Excel export ──────────────────────────────────────────────────────

export async function buildInvoiceExcel(
  grnIdRaw: unknown
): Promise<{ buffer: Buffer; filename: string }> {
  const grnId = Number(grnIdRaw);
  if (!Number.isFinite(grnId)) throw new AppError("Invalid grn_id", 400);

  const grnRes = await query(
    `SELECT g.grn_id, g.po_id, g.vendor_id, g.vendor_name,
            g.grn_invoice_collection_status, g.created_at,
            g.grn_accepted_quantity, g.grn_invoice_quantity, g.grn_rejected_quantity
     FROM inbound_grns g WHERE g.grn_id = $1`,
    [grnId]
  );
  if (grnRes.rows.length === 0) throw new AppError(`GRN ${grnId} not found`, 404);
  const grn = grnRes.rows[0];

  const noteRes = await query(
    `SELECT n.note_reference, n.dn_number, n.total_debit_amount, n.status,
            nl.sku_id, nl.sku_description, nl.quantity,
            nl.rejected_quantity, nl.short_quantity,
            nl.vendor_price, nl.audit_price, nl.price_diff, nl.debit_amount
     FROM inbound_zap_debit_notes n
     LEFT JOIN inbound_zap_debit_note_lines nl ON nl.debit_note_id = n.id
     WHERE n.grn_id = $1
     ORDER BY nl.line_index`,
    [grnId]
  );

  const itemRes = await query(
    `SELECT sku_id, raw FROM inbound_grn_items WHERE grn_id = $1 ORDER BY line_index`,
    [grnId]
  );

  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summary = [
    ["GRN ID", grnId],
    ["PO ID", grn.po_id ?? ""],
    ["Vendor", grn.vendor_name ?? ""],
    ["GRN Date", grn.created_at ? new Date(String(grn.created_at)).toLocaleDateString("en-IN") : ""],
    ["Invoice Collection Status", grn.grn_invoice_collection_status ?? ""],
    ["Invoice Qty", grn.grn_invoice_quantity ?? ""],
    ["Accepted Qty", grn.grn_accepted_quantity ?? ""],
    ["Rejected Qty", grn.grn_rejected_quantity ?? ""],
  ];
  if (noteRes.rows.length > 0) {
    const first = noteRes.rows[0];
    summary.push(
      ["DN Reference", first.note_reference ?? ""],
      ["DN Number", first.dn_number ?? ""],
      ["Total Debit Amount", first.total_debit_amount ?? ""],
      ["DN Status", first.status ?? ""]
    );
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary");

  // GRN Items sheet
  const itemHeaders = ["SKU ID", "Description", "Ordered Qty", "Accepted Qty", "Rejected Qty", "Received Price"];
  const itemRows = itemRes.rows.map((r) => {
    const raw = (r.raw as Record<string, unknown>) ?? {};
    const pick = (keys: string[]) => { for (const k of keys) { const v = raw[k]; if (v != null && v !== "") return v; } return ""; };
    return [
      r.sku_id ?? pick(["sku_id", "skuId"]),
      pick(["title", "name", "description", "sku_name"]),
      pick(["ordered_quantity", "orderedQuantity", "po_quantity", "quantity"]),
      pick(["accepted_quantity", "acceptedQuantity", "current_grn_accepted_quantity"]),
      pick(["rejected_quantity", "rejectedQuantity", "current_grn_rejected_quantity"]),
      pick(["received_price", "receivedPrice", "grn_received_price"]),
    ];
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([itemHeaders, ...itemRows]), "GRN Items");

  // Debit Note lines sheet (if present)
  if (noteRes.rows.length > 0 && noteRes.rows[0].sku_id != null) {
    const dnHeaders = ["SKU ID", "Description", "Qty", "Rejected Qty", "Short Qty", "Vendor Price", "Audit Price", "Price Diff", "Debit Amount"];
    const dnRows = noteRes.rows.map((r) => [
      r.sku_id ?? "", r.sku_description ?? "",
      r.quantity, r.rejected_quantity ?? 0, r.short_quantity ?? 0,
      r.vendor_price, r.audit_price, r.price_diff, r.debit_amount,
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([dnHeaders, ...dnRows]), "Debit Note");
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer: buf, filename: `GRN-${grnId}-invoice.xlsx` };
}
