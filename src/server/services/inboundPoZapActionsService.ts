import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";

/**
 * Ensures a PO snapshot row exists. Snapshot is keyed by `po_id`; `vendor_id` in the URL
 * may differ from `inbound_po_detail_snapshot.vendor_id` (canonical vendor from eAutomate PO).
 */
export async function assertVendorPoSnapshot(
  _pathVendorId: number,
  poId: number
) {
  const r = await query(
    `SELECT vendor_id, po_raw FROM inbound_po_detail_snapshot WHERE po_id = $1`,
    [poId]
  );
  if (r.rows.length === 0) {
    throw new AppError("PO snapshot not found", 404);
  }
  return {
    po_raw: r.rows[0].po_raw as Record<string, unknown>,
    canonicalVendorId: Number(r.rows[0].vendor_id),
  };
}

export async function mergeInboundPoRaw(
  vendorId: number,
  poId: number,
  patch: Record<string, unknown>
): Promise<void> {
  await assertVendorPoSnapshot(vendorId, poId);
  const json = JSON.stringify(patch);
  const r = await query(
    `UPDATE inbound_po_detail_snapshot
     SET po_raw = po_raw || $1::jsonb,
         synced_at = NOW()
     WHERE po_id = $2
     RETURNING po_id`,
    [json, poId]
  );
  if (r.rows.length === 0) {
    throw new AppError("Could not update PO", 500);
  }
}

export async function buildInboundPoPdfBytes(
  vendorId: number,
  poId: number
): Promise<{ bytes: Uint8Array; filename: string }> {
  await assertVendorPoSnapshot(vendorId, poId);

  const snap = await query(
    `SELECT po_raw, vendor_id FROM inbound_po_detail_snapshot WHERE po_id = $1`,
    [poId]
  );
  const poRaw = (snap.rows[0]?.po_raw ?? {}) as Record<string, unknown>;
  const displayVendorId = Number(snap.rows[0]?.vendor_id ?? vendorId);

  const linesR = await query(
    `SELECT line_index, sku_id, raw FROM inbound_po_detail_lines
     WHERE po_id = $1 ORDER BY line_index ASC`,
    [poId]
  );

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595.28, 841.89]);
  const { height } = page.getSize();
  const margin = 50;
  let y = height - margin;
  const lineHeight = 14;

  function drawLine(text: string, bold = false, size = 11) {
    const f = bold ? fontBold : font;
    page.drawText(text.slice(0, 500), {
      x: margin,
      y,
      size,
      font: f,
      color: rgb(0, 0, 0),
    });
    y -= lineHeight;
    if (y < margin + 40) {
      page = pdf.addPage([595.28, 841.89]);
      y = height - margin;
    }
  }

  drawLine("Purchase order", true, 16);
  drawLine(`PO ID: ${poId}`);
  drawLine(`Vendor ID: ${displayVendorId}`);
  const poNum =
    poRaw.po_number ?? poRaw.po_id ?? poRaw.id ?? poRaw.purchase_order_id;
  if (poNum != null) drawLine(`PO number: ${String(poNum)}`);
  const status = poRaw.status ?? poRaw.po_status ?? poRaw.zap_status;
  if (status != null) drawLine(`Status: ${String(status)}`);
  if (poRaw.zap_notes != null) {
    const n = String(poRaw.zap_notes).slice(0, 500);
    drawLine(`Zap notes: ${n}`);
  }
  if (poRaw.zap_cancelled_at != null) {
    drawLine(`Cancelled at: ${String(poRaw.zap_cancelled_at)}`);
  }
  y -= 8;
  drawLine("Line items", true, 13);
  for (const row of linesR.rows) {
    const raw = (row.raw ?? {}) as Record<string, unknown>;
    const sku = row.sku_id != null ? String(row.sku_id) : "—";
    const qty =
      raw.required_quantity ??
      raw.quantity ??
      raw.qty ??
      raw.required_qty ??
      "";
    drawLine(
      `Line ${Number(row.line_index) + 1}: SKU ${sku} qty ${String(qty)}`
    );
  }

  const bytes = await pdf.save();
  return {
    bytes,
    filename: `po-${poId}-document.pdf`,
  };
}

export async function buildGrnReportCsv(
  vendorId: number,
  poId: number
): Promise<{ csv: string; filename: string }> {
  await assertVendorPoSnapshot(vendorId, poId);

  const r = await query(
    `SELECT g.sort_index, g.grn_id, g.raw AS link_raw,
            ig.grn_status, ig.vendor_invoice_number, ig.created_at,
            ig.grn_accepted_quantity, ig.grn_rejected_quantity
     FROM inbound_po_detail_grns g
     LEFT JOIN inbound_grns ig ON ig.grn_id = g.grn_id
     WHERE g.po_id = $1
     ORDER BY g.sort_index ASC`,
    [poId]
  );

  const headers = [
    "sort_index",
    "grn_id",
    "grn_status",
    "vendor_invoice_number",
    "created_at",
    "accepted_qty",
    "rejected_qty",
    "link_raw_json",
  ];

  function esc(v: unknown): string {
    const s = v == null ? "" : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  const rows: string[] = [headers.join(",")];
  for (const row of r.rows) {
    const linkRaw =
      typeof row.link_raw === "object"
        ? JSON.stringify(row.link_raw)
        : String(row.link_raw ?? "");
    rows.push(
      [
        esc(row.sort_index),
        esc(row.grn_id),
        esc(row.grn_status),
        esc(row.vendor_invoice_number),
        esc(row.created_at),
        esc(row.grn_accepted_quantity),
        esc(row.grn_rejected_quantity),
        esc(linkRaw),
      ].join(",")
    );
  }

  const csv = rows.join("\n") + "\n";
  return { csv, filename: `po-${poId}-grn-report.csv` };
}
