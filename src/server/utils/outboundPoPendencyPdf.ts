import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type PendencyRow = {
  po_secondary_sku: string | null;
  company_code_primary: string | null;
  warehouse_quantity: number | null;
  mrp: number | null;
  pending: number;
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function buildPendencyRowsFromListings(
  rows: Record<string, unknown>[]
): PendencyRow[] {
  return rows.map((row) => {
    const demand = num(row.demand) ?? 0;
    const packed = num(row.packed) ?? 0;
    const dispatched = num(row.dispatched) ?? 0;
    const explicitPending = num(row.pending);
    return {
      po_secondary_sku:
        row.po_secondary_sku != null ? String(row.po_secondary_sku) : null,
      company_code_primary:
        row.company_code_primary != null ? String(row.company_code_primary) : null,
      warehouse_quantity: num(row.warehouse_quantity),
      mrp: num(row.mrp),
      pending:
        explicitPending != null ? explicitPending : demand - (packed + dispatched),
    };
  });
}

export async function createOutboundPoPendencyPdf(opts: {
  companyName: string | null;
  poNumber: string;
  deliveryLocation: string | null;
  rows: PendencyRow[];
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const margin = 32;
  let y = height - margin;

  const title = `${opts.companyName ?? "Blinkit"} Pendency`;
  page.drawText(title, { x: margin, y, size: 16, font: bold });
  y -= 22;
  page.drawText(
    `PO: ${opts.poNumber}   Delivery: ${opts.deliveryLocation ?? "-"}`,
    { x: margin, y, size: 10, font }
  );
  y -= 20;

  const headers = [
    "#",
    "PO SKU",
    "Company Code Primary",
    "Warehouse Inventory",
    "M.R.P",
    "Pending",
  ];
  const colW = [28, 150, 170, 130, 90, 80];
  let x = margin;
  headers.forEach((h, i) => {
    page.drawText(h, { x, y, size: 9, font: bold, color: rgb(0, 0, 0) });
    x += colW[i];
  });
  y -= 12;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 12;

  for (let i = 0; i < opts.rows.length; i += 1) {
    if (y < margin + 18) {
      break;
    }
    const r = opts.rows[i];
    const vals = [
      String(i + 1),
      r.po_secondary_sku ?? "",
      r.company_code_primary ?? "",
      r.warehouse_quantity != null ? String(r.warehouse_quantity) : "",
      r.mrp != null ? String(r.mrp) : "",
      String(r.pending),
    ];
    x = margin;
    vals.forEach((v, idx) => {
      page.drawText(v, { x, y, size: 9, font });
      x += colW[idx];
    });
    y -= 14;
  }

  return pdf.save();
}
