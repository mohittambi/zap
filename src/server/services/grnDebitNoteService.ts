import getPool, { query } from "@/server/db";
import { AppError } from "@/server/errors";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DebitNoteLine = {
  id: number;
  debit_note_id: number;
  grn_id: number;
  line_index: number;
  sku_id: string | null;
  sku_description: string | null;
  quantity: number;
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
  status: "DRAFT" | "ISSUED" | "EXPORTED";
  generated_by: string | null;
  generated_at: string;
  exported_at: string | null;
  notes: string | null;
  lines: DebitNoteLine[];
};

export type AuditLine = {
  line_index: number;
  sku_id: string | null;
  sku_description: string | null;
  quantity: number;
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

const SKU_KEYS = [
  "sku_id", "skuId", "sku", "sku_code",
  "listing_id", "listingId", "product_id",
];

const DESCRIPTION_KEYS = [
  "title", "name", "description", "sku_name",
  "listing_title", "product_name", "display_name",
];

type JsonRecord = Record<string, unknown>;

function pickNum(raw: JsonRecord, keys: string[]): number {
  for (const k of keys) {
    const v = raw[k];
    if (v != null && v !== "") {
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return 0;
}

function pickStr(raw: JsonRecord, keys: string[]): string {
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

async function fetchNoteById(noteId: number): Promise<DebitNote> {
  const [noteRes, lineRes] = await Promise.all([
    query(
      `SELECT id, grn_id, note_reference, vendor_id, vendor_name, po_id,
              total_debit_amount, line_count, status, generated_by,
              generated_at, exported_at, notes
       FROM inbound_zap_debit_notes WHERE id = $1`,
      [noteId]
    ),
    query(
      `SELECT id, debit_note_id, grn_id, line_index, sku_id, sku_description,
              quantity, vendor_price, audit_price, price_diff, debit_amount
       FROM inbound_zap_debit_note_lines WHERE debit_note_id = $1
       ORDER BY line_index`,
      [noteId]
    ),
  ]);
  if (noteRes.rows.length === 0) throw new AppError("Debit note not found", 404);
  const note = noteRes.rows[0];
  return {
    id: toNum(note.id),
    grn_id: toNum(note.grn_id),
    note_reference: String(note.note_reference ?? ""),
    vendor_id: note.vendor_id == null ? null : toNum(note.vendor_id),
    vendor_name: note.vendor_name ?? null,
    po_id: note.po_id == null ? null : toNum(note.po_id),
    total_debit_amount: toNum(note.total_debit_amount),
    line_count: toNum(note.line_count),
    status: (note.status as DebitNote["status"]) ?? "DRAFT",
    generated_by: note.generated_by ?? null,
    generated_at: String(note.generated_at ?? ""),
    exported_at: note.exported_at ? String(note.exported_at) : null,
    notes: note.notes ?? null,
    lines: lineRes.rows.map((l) => ({
      id: toNum(l.id),
      debit_note_id: toNum(l.debit_note_id),
      grn_id: toNum(l.grn_id),
      line_index: toNum(l.line_index),
      sku_id: l.sku_id ?? null,
      sku_description: l.sku_description ?? null,
      quantity: toNum(l.quantity),
      vendor_price: toNum(l.vendor_price),
      audit_price: toNum(l.audit_price),
      price_diff: toNum(l.price_diff),
      debit_amount: toNum(l.debit_amount),
    })),
  };
}

// ── Audit preview (read-only) ─────────────────────────────────────────────────

export async function getAuditPreview(grnIdRaw: unknown): Promise<AuditLine[]> {
  const grnId = Number(grnIdRaw);
  if (!Number.isFinite(grnId)) throw new AppError("Invalid grn_id", 400);

  const res = await query(
    `SELECT line_index, sku_id, raw FROM inbound_grn_items WHERE grn_id = $1 ORDER BY line_index`,
    [grnId]
  );

  return res.rows.map((item) => {
    const raw: JsonRecord = (item.raw as JsonRecord) ?? {};
    const vendorPrice = pickNum(raw, RECEIVED_PRICE_KEYS);
    const auditPrice = pickNum(raw, AUDIT_PRICE_KEYS);
    const quantity = pickNum(raw, ACCEPTED_QTY_KEYS);
    const diff = vendorPrice - auditPrice;
    return {
      line_index: toNum(item.line_index),
      sku_id: (item.sku_id as string | null) ?? (pickStr(raw, SKU_KEYS) || null),
      sku_description: pickStr(raw, DESCRIPTION_KEYS) || null,
      quantity,
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
  generatedBy: string
): Promise<DebitNote> {
  const grnId = Number(grnIdRaw);
  if (!Number.isFinite(grnId)) throw new AppError("Invalid grn_id", 400);

  const headerRes = await query(
    `SELECT grn_id, vendor_id, vendor_name, po_id FROM inbound_grns WHERE grn_id = $1`,
    [grnId]
  );
  if (headerRes.rows.length === 0) throw new AppError(`GRN ${grnId} not found`, 404);
  const header = headerRes.rows[0];

  const itemRes = await query(
    `SELECT line_index, sku_id, raw FROM inbound_grn_items WHERE grn_id = $1 ORDER BY line_index`,
    [grnId]
  );

  if (itemRes.rows.length === 0) {
    throw new AppError(
      `GRN ${grnId} has no line items — refresh details from eAutomate first`,
      400
    );
  }

  const candidateLines = itemRes.rows
    .map((item) => {
      const raw: JsonRecord = (item.raw as JsonRecord) ?? {};
      const vendorPrice = pickNum(raw, RECEIVED_PRICE_KEYS);
      const auditPrice = pickNum(raw, AUDIT_PRICE_KEYS);
      const quantity = pickNum(raw, ACCEPTED_QTY_KEYS);
      const diff = vendorPrice - auditPrice;
      return {
        line_index: toNum(item.line_index),
        sku_id: (item.sku_id as string | null) ?? (pickStr(raw, SKU_KEYS) || null),
        sku_description: pickStr(raw, DESCRIPTION_KEYS) || null,
        quantity,
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
            quantity, vendor_price, audit_price, price_diff, debit_amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          noteId, grnId, l.line_index, l.sku_id, l.sku_description,
          l.quantity.toFixed(4), l.vendor_price.toFixed(4),
          l.audit_price.toFixed(4), l.price_diff.toFixed(4),
          l.debit_amount.toFixed(4),
        ]
      );
    }

    await client.query("COMMIT");
    return fetchNoteById(noteId);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
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

// ── Tally CSV export ──────────────────────────────────────────────────────────

function csvRow(cells: (string | number)[]): string {
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
      "StockItem", "Quantity", "VendorRate", "AuditRate",
      "RateDiff", "Amount(Debit)", "Narration",
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
        Number(l.vendor_price),
        Number(l.audit_price),
        Number(l.price_diff),
        Number(l.debit_amount),
        `Price diff on GRN ${note.grn_id} — PO ${note.po_id ?? "N/A"}`,
      ])
    );
  }

  lines.push(
    csvRow(["", "", "", "", "TOTAL", "", "", "", "", Number(note.total_debit_amount), ""])
  );

  const csv = lines.join("\r\n");

  await query(
    `UPDATE inbound_zap_debit_notes SET status='EXPORTED', exported_at=NOW() WHERE grn_id=$1`,
    [Number(grnIdRaw)]
  );

  return { csv, filename: `${note.note_reference}.csv` };
}
