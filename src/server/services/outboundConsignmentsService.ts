import * as XLSX from "xlsx";
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import {
  batchGetZapEanByCompany,
  resolveZapEanDisplay,
} from "@/server/services/eanMappingsService";

export type OutboundConsignmentRow = {
  id: number;
  company_id: number | null;
  company_name: string | null;
  location: string | null;
  sold_via: string | null;
  po_number: string | null;
  po_type: string | null;
  consignment_status: string | null;
  invoice_number_status: string | null;
  invoice_number: string | null;
  invoice_upload_status: string | null;
  invoice_file_path: string | null;
  invoice_file_name: string | null;
  invoice_uploaded_at: string | null;
  invoice_uploaded_by: string | null;
  boxes_count: number | null;
  sku_count: number | null;
  total_quantity: number | null;
  transporter_name: string | null;
  vehicle_number: string | null;
  docket_number: string | null;
  created_at: string | null;
  marked_rtd_at: string | null;
  marked_rtd_by: string | null;
  raw: Record<string, unknown>;
  synced_at: string | null;
};

const SORT_COLUMNS = new Set([
  "id",
  "company_name",
  "location",
  "po_number",
  "invoice_number",
  "consignment_status",
  "invoice_number_status",
  "invoice_upload_status",
  "boxes_count",
  "sku_count",
  "total_quantity",
  "transporter_name",
  "vehicle_number",
  "docket_number",
  "created_at",
  "marked_rtd_at",
  "marked_rtd_by",
  "sold_via",
  "po_type",
]);

function pickFirst(
  obj: Record<string, unknown>,
  keys: string[]
): unknown {
  for (const k of keys) {
    if (k in obj && obj[k] != null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

function pickStr(obj: Record<string, unknown>, keys: string[], maxLen?: number): string | null {
  const v = pickFirst(obj, keys);
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return maxLen != null ? s.slice(0, maxLen) : s;
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
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}):(\d{2}))?/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const hh = m[4] != null ? Number(m[4]) : 0;
    const mi = m[5] != null ? Number(m[5]) : 0;
    const ss = m[6] != null ? Number(m[6]) : 0;
    return new Date(Date.UTC(y, mo - 1, d, hh, mi, ss));
  }
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

function pickDate(obj: Record<string, unknown>, keys: string[]): Date | null {
  const v = pickFirst(obj, keys);
  return parseTs(v);
}

/** If API wraps the row (e.g. `{ consignment: { ... } }`), merge inner object so flat picks work. */
function unwrapConsignmentPayload(raw: Record<string, unknown>): Record<string, unknown> {
  const wrapperKeys = [
    "consignment",
    "consignmentDto",
    "consignment_dto",
    "dto",
    "payload",
    "details",
  ];
  for (const k of wrapperKeys) {
    const v = raw[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const inner = v as Record<string, unknown>;
      return { ...raw, ...inner };
    }
  }
  const idTop = pickInt(raw, ["id", "consignment_id", "consignmentId", "consignmentID"]);
  const dataVal = raw.data;
  if (
    idTop == null &&
    dataVal &&
    typeof dataVal === "object" &&
    !Array.isArray(dataVal)
  ) {
    return { ...raw, ...(dataVal as Record<string, unknown>) };
  }
  return raw;
}

/** Read string from nested objects (e.g. `company.name`). */
function pickStrNested(
  obj: Record<string, unknown>,
  paths: string[][],
  maxLen?: number
): string | null {
  for (const path of paths) {
    let cur: unknown = obj;
    for (const seg of path) {
      if (cur == null || typeof cur !== "object" || Array.isArray(cur)) {
        cur = undefined;
        break;
      }
      cur = (cur as Record<string, unknown>)[seg];
    }
    if (cur == null || cur === "") continue;
    const s = String(cur).trim();
    if (!s) continue;
    return maxLen != null ? s.slice(0, maxLen) : s;
  }
  return null;
}

/** Map one eAutomate consignment row → DB columns + full raw (all keys preserved in raw). */
export function normalizeConsignmentPayload(raw: Record<string, unknown>): {
  id: number;
  company_id: number | null;
  company_name: string | null;
  location: string | null;
  sold_via: string | null;
  po_number: string | null;
  po_type: string | null;
  consignment_status: string | null;
  invoice_number_status: string | null;
  invoice_number: string | null;
  invoice_upload_status: string | null;
  boxes_count: number | null;
  sku_count: number | null;
  total_quantity: number | null;
  transporter_name: string | null;
  vehicle_number: string | null;
  docket_number: string | null;
  created_at: Date | null;
  marked_rtd_at: Date | null;
  marked_rtd_by: string | null;
  rawJson: string;
} | null {
  const r = unwrapConsignmentPayload(raw);

  const id = pickInt(r, [
    "id",
    "consignment_id",
    "consignmentId",
    "consignmentID",
  ]);
  if (id == null || id < 1) return null;

  let company_id = pickInt(r, [
    "company_id",
    "companyId",
    "buyer_company_id",
    "buyerCompanyId",
    "buyerCompanyID",
  ]);
  if (company_id != null && company_id < 1) company_id = null;

  const vehicle_number = pickStr(r, [
    "vehicle_number",
    "vehicleNumber",
    "vehicle_no",
    "vehicleNo",
  ], 160);
  const docket_number = pickStr(r, [
    "docket_number",
    "docketNumber",
    "docket_no",
    "docketNo",
  ], 160);

  const combinedVd = pickStr(
    r,
    [
      "vehicle_docket_number",
      "vehicleDocketNumber",
      "vehicle_number_docket_number",
      "vehicle_or_docket",
    ],
    200
  );

  let vn = vehicle_number;
  let dn = docket_number;
  if (!vn && !dn && combinedVd) {
    vn = combinedVd.slice(0, 160);
  }

  const company_name =
    pickStr(
      r,
      [
        "company_name",
        "companyName",
        "buyer_company_name",
        "buyerCompanyName",
        "buyer_name",
        "buyerName",
        "customer_name",
        "customerName",
      ],
      220
    ) ??
    pickStrNested(
      r,
      [
        ["company", "name"],
        ["company", "companyName"],
        ["buyerCompany", "name"],
        ["buyer_company", "name"],
        ["buyer", "name"],
        ["customer", "name"],
      ],
      220
    );

  const location =
    pickStr(
      r,
      [
        "location",
        "delivery_location",
        "deliveryLocation",
        "delivery_city",
        "deliveryCity",
        "location_name",
        "locationName",
        "warehouse_location",
        "warehouseLocation",
        "delivery_address",
        "deliveryAddress",
      ],
      200
    ) ??
    pickStrNested(
      r,
      [
        ["deliveryLocation", "name"],
        ["delivery_location", "name"],
        ["warehouse", "name"],
        ["location", "name"],
      ],
      200
    );

  return {
    id,
    company_id,
    company_name,
    location,
    sold_via: pickStr(r, ["sold_via", "soldVia", "channel", "soldThrough"], 80),
    po_number: pickStr(r, [
      "po_number",
      "poNumber",
      "purchase_order_number",
      "purchaseOrderNumber",
      "po_no",
      "poNo",
    ], 80),
    po_type: pickStr(r, ["po_type", "poType", "purchase_order_type", "purchaseOrderType"], 80),
    consignment_status: pickStr(
      r,
      [
        "consignment_status",
        "consignmentStatus",
        "status",
        "consignment_state",
        "consignmentState",
      ],
      80
    ),
    invoice_number_status: pickStr(
      r,
      [
        "invoice_number_status",
        "invoiceNumberStatus",
        "invoice_status",
        "invoiceStatus",
      ],
      80
    ),
    invoice_number: pickStr(
      r,
      ["invoice_number", "invoiceNumber", "invoice_no", "invoiceNo"],
      120
    ),
    invoice_upload_status: pickStr(
      r,
      [
        "invoice_upload_status",
        "invoiceUploadStatus",
        "invoice_file_status",
        "invoiceFileStatus",
      ],
      80
    ),
    boxes_count: pickInt(r, [
      "boxes_count",
      "boxesCount",
      "box_count",
      "boxCount",
      "total_boxes",
      "totalBoxes",
    ]),
    sku_count: pickInt(r, [
      "sku_count",
      "skuCount",
      "skus_count",
      "total_sku",
      "totalSku",
      "skuCountTotal",
    ]),
    total_quantity: pickInt(r, [
      "total_quantity",
      "totalQuantity",
      "quantity",
      "total_qty",
      "totalQty",
      "item_count",
      "itemCount",
    ]),
    transporter_name: pickStr(
      r,
      [
        "transporter_name",
        "transporterName",
        "transporter",
        "carrier_name",
        "carrierName",
        "logistics_partner",
        "logisticsPartner",
      ],
      220
    ),
    vehicle_number: vn,
    docket_number: dn,
    created_at: pickDate(r, [
      "consignment_created_at",
      "consignmentCreatedAt",
      "created_at",
      "createdAt",
      "consignmentCreatedDate",
    ]),
    marked_rtd_at: pickDate(r, [
      "consignment_marked_rtd_at",
      "consignmentMarkedRtdAt",
      "marked_rtd_at",
      "markedRtdAt",
      "rtd_at",
      "rtdAt",
    ]),
    marked_rtd_by: pickStr(
      r,
      [
        "marked_rtd_by",
        "markedRtdBy",
        "consignment_marked_rtd_by",
        "rtd_marked_by",
        "rtdMarkedBy",
      ],
      120
    ),
    rawJson: JSON.stringify(raw),
  };
}

export async function upsertOutboundConsignmentFromEautomate(
  raw: Record<string, unknown>
): Promise<{ ok: boolean; reason?: string }> {
  const n = normalizeConsignmentPayload(raw);
  if (!n) return { ok: false, reason: "missing consignment id" };

  let company_id = n.company_id;
  if (company_id != null) {
    const chk = await query(`SELECT 1 FROM companies WHERE id = $1 LIMIT 1`, [company_id]);
    if (chk.rows.length === 0) company_id = null;
  }

  let company_name = n.company_name;
  if (company_id != null && (company_name == null || company_name === "")) {
    const nameR = await query(`SELECT name FROM companies WHERE id = $1 LIMIT 1`, [
      company_id,
    ]);
    const nm = nameR.rows[0]?.name;
    if (nm != null && String(nm).trim()) company_name = String(nm).trim().slice(0, 220);
  }

  await query(
    `INSERT INTO outbound_consignments (
      id, company_id, company_name, location, sold_via, po_number, po_type,
      consignment_status, invoice_number_status, invoice_number, invoice_upload_status,
      boxes_count, sku_count, total_quantity, transporter_name, vehicle_number, docket_number,
      created_at, marked_rtd_at, marked_rtd_by, raw, synced_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb,NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      company_id = EXCLUDED.company_id,
      company_name = EXCLUDED.company_name,
      location = EXCLUDED.location,
      sold_via = EXCLUDED.sold_via,
      po_number = EXCLUDED.po_number,
      po_type = EXCLUDED.po_type,
      consignment_status = EXCLUDED.consignment_status,
      invoice_number_status = EXCLUDED.invoice_number_status,
      invoice_number = EXCLUDED.invoice_number,
      invoice_upload_status = EXCLUDED.invoice_upload_status,
      boxes_count = EXCLUDED.boxes_count,
      sku_count = EXCLUDED.sku_count,
      total_quantity = EXCLUDED.total_quantity,
      transporter_name = EXCLUDED.transporter_name,
      vehicle_number = EXCLUDED.vehicle_number,
      docket_number = EXCLUDED.docket_number,
      created_at = EXCLUDED.created_at,
      marked_rtd_at = EXCLUDED.marked_rtd_at,
      marked_rtd_by = EXCLUDED.marked_rtd_by,
      raw = EXCLUDED.raw,
      synced_at = NOW()`,
    [
      n.id,
      company_id,
      company_name,
      n.location,
      n.sold_via,
      n.po_number,
      n.po_type,
      n.consignment_status,
      n.invoice_number_status,
      n.invoice_number,
      n.invoice_upload_status,
      n.boxes_count,
      n.sku_count,
      n.total_quantity,
      n.transporter_name,
      n.vehicle_number,
      n.docket_number,
      n.created_at,
      n.marked_rtd_at,
      n.marked_rtd_by,
      n.rawJson,
    ]
  );
  return { ok: true };
}

function rowToApi(r: Record<string, unknown>): OutboundConsignmentRow {
  const raw = r.raw;
  return {
    id: Number(r.id),
    company_id: r.company_id != null ? Number(r.company_id) : null,
    company_name: r.company_name as string | null,
    location: r.location as string | null,
    sold_via: r.sold_via as string | null,
    po_number: r.po_number as string | null,
    po_type: r.po_type as string | null,
    consignment_status: r.consignment_status as string | null,
    invoice_number_status: r.invoice_number_status as string | null,
    invoice_number: r.invoice_number as string | null,
    invoice_upload_status: r.invoice_upload_status as string | null,
    invoice_file_path: r.invoice_file_path as string | null,
    invoice_file_name: r.invoice_file_name as string | null,
    invoice_uploaded_at: r.invoice_uploaded_at ? new Date(r.invoice_uploaded_at as string).toISOString() : null,
    invoice_uploaded_by: r.invoice_uploaded_by as string | null,
    boxes_count: r.boxes_count != null ? Number(r.boxes_count) : null,
    sku_count: r.sku_count != null ? Number(r.sku_count) : null,
    total_quantity: r.total_quantity != null ? Number(r.total_quantity) : null,
    transporter_name: r.transporter_name as string | null,
    vehicle_number: r.vehicle_number as string | null,
    docket_number: r.docket_number as string | null,
    created_at: r.created_at ? new Date(r.created_at as string).toISOString() : null,
    marked_rtd_at: r.marked_rtd_at
      ? new Date(r.marked_rtd_at as string).toISOString()
      : null,
    marked_rtd_by: r.marked_rtd_by as string | null,
    raw:
      typeof raw === "object" && raw !== null && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {},
    synced_at: r.synced_at ? new Date(r.synced_at as string).toISOString() : null,
  };
}

export async function getOutboundConsignmentById(
  id: number
): Promise<OutboundConsignmentRow | null> {
  if (!Number.isFinite(id) || id < 1) return null;
  const r = await query(
    `SELECT id, company_id, company_name, location, sold_via, po_number, po_type,
            consignment_status, invoice_number_status, invoice_number, invoice_upload_status,
            invoice_file_path, invoice_file_name, invoice_uploaded_at, invoice_uploaded_by,
            boxes_count, sku_count, total_quantity, transporter_name, vehicle_number, docket_number,
            created_at, marked_rtd_at, marked_rtd_by, raw, synced_at
     FROM outbound_consignments WHERE id = $1`,
    [id]
  );
  if (r.rows.length === 0) return null;
  return rowToApi(r.rows[0] as Record<string, unknown>);
}

export async function listOutboundConsignments(opts: {
  page: number;
  limit: number;
  /** When set, only consignments for this PO number (matches `outbound_purchase_orders.po_number`). */
  poNumber?: string | null;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  /**
   * When true, only rows that still need invoice capture (no invoice number and/or status contains “pending”).
   * Powers Outbound → Pending Invoices (web + mobile).
   */
  invoicePending?: boolean;
}) {
  const { page, limit, search } = opts;
  const sortBy = SORT_COLUMNS.has(opts.sortBy ?? "") ? opts.sortBy! : "created_at";
  const sortDir = opts.sortDir === "asc" ? "ASC" : "DESC";
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let p = 1;

  const poNum = opts.poNumber != null ? String(opts.poNumber).trim() : "";
  if (poNum.length > 0) {
    conditions.push(`TRIM(COALESCE(po_number, '')) = $${p}`);
    params.push(poNum);
    p += 1;
  }

  if (search && search.trim()) {
    const q = `%${search.trim().toLowerCase()}%`;
    conditions.push(
      `(LOWER(COALESCE(po_number,'')) LIKE $${p}
        OR LOWER(COALESCE(company_name,'')) LIKE $${p}
        OR LOWER(COALESCE(location,'')) LIKE $${p}
        OR LOWER(COALESCE(invoice_number,'')) LIKE $${p}
        OR LOWER(COALESCE(transporter_name,'')) LIKE $${p}
        OR LOWER(COALESCE(consignment_status,'')) LIKE $${p})`
    );
    params.push(q);
    p += 1;
  }

  if (opts.invoicePending) {
    conditions.push(`(
      (invoice_number IS NULL OR TRIM(COALESCE(invoice_number, '')) = '')
      OR COALESCE(LOWER(invoice_upload_status), '') LIKE '%pending%'
      OR COALESCE(LOWER(invoice_number_status), '') LIKE '%pending%'
    )`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const countR = await query(
    `SELECT COUNT(*)::int AS total FROM outbound_consignments ${where}`,
    params
  );
  const total = countR.rows[0].total as number;

  const listR = await query(
    `SELECT id, company_id, company_name, location, sold_via, po_number, po_type,
            consignment_status, invoice_number_status, invoice_number, invoice_upload_status,
            invoice_file_path, invoice_file_name, invoice_uploaded_at, invoice_uploaded_by,
            boxes_count, sku_count, total_quantity, transporter_name, vehicle_number, docket_number,
            created_at, marked_rtd_at, marked_rtd_by, raw, synced_at
     FROM outbound_consignments
     ${where}
     ORDER BY ${sortBy} ${sortDir} NULLS LAST, id DESC
     LIMIT $${p} OFFSET $${p + 1}`,
    [...params, limit, offset]
  );

  return {
    total,
    current_page: page,
    per_page_count: limit,
    curr_page_count: listR.rows.length,
    content: listR.rows.map((row) => rowToApi(row as Record<string, unknown>)),
  };
}

export type DeliveryLocationOption = { id: number; name: string };

export async function listOutboundConsignmentDeliveryLocations(): Promise<
  DeliveryLocationOption[]
> {
  const r = await query(
    `SELECT id, name FROM outbound_consignment_delivery_locations ORDER BY sort_order ASC, name ASC`
  );
  return r.rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
  }));
}

function locationRowToNameAndRaw(row: unknown): { name: string; raw: string } | null {
  if (row == null) return null;
  if (typeof row === "string") {
    const name = row.trim();
    if (!name) return null;
    return { name: name.slice(0, 300), raw: JSON.stringify({ value: row }) };
  }
  if (typeof row === "object" && !Array.isArray(row)) {
    const o = row as Record<string, unknown>;
    const name = pickStr(
      o,
      [
        "name",
        "location",
        "delivery_location",
        "deliveryLocation",
        "label",
        "title",
        "value",
      ],
      300
    );
    if (!name) return null;
    return { name, raw: JSON.stringify(o) };
  }
  return null;
}

export async function upsertOutboundConsignmentDeliveryLocationsFromApi(
  rows: unknown[]
): Promise<number> {
  let n = 0;
  let order = 0;
  for (const row of rows) {
    const parsed = locationRowToNameAndRaw(row);
    if (!parsed) continue;
    order += 1;
    await query(
      `INSERT INTO outbound_consignment_delivery_locations (name, sort_order, raw, synced_at)
       VALUES ($1, $2, $3::jsonb, NOW())
       ON CONFLICT (name) DO UPDATE SET
         raw = EXCLUDED.raw,
         sort_order = EXCLUDED.sort_order,
         synced_at = NOW()`,
      [parsed.name, order, parsed.raw]
    );
    n += 1;
  }
  return n;
}

export async function attachConsignmentInvoice(
  consignmentId: number,
  filePath: string,
  fileName: string,
  uploadedBy: string
): Promise<void> {
  const existing = await query(
    `SELECT invoice_number_status FROM outbound_consignments WHERE id = $1`,
    [consignmentId]
  );
  if (existing.rows.length === 0) throw new AppError("Consignment not found", 404);
  const invoiceStatus = existing.rows[0].invoice_number_status;
  if (!invoiceStatus) {
    throw new AppError("Invoice number must be assigned before uploading invoice file", 409);
  }

  await query(
    `UPDATE outbound_consignments
     SET invoice_file_path = $1, invoice_file_name = $2,
         invoice_uploaded_at = NOW(), invoice_uploaded_by = $3,
         invoice_upload_status = 'DONE'
     WHERE id = $4`,
    [filePath, fileName, uploadedBy, consignmentId]
  );
}

/**
 * Manually assign (or clear) an invoice number on a consignment.
 * Sets invoice_number_status to 'ASSIGNED' when a number is provided, NULL otherwise.
 */
export async function patchOutboundConsignmentInvoiceNumber(
  consignmentId: number,
  invoiceNumber: string | null
): Promise<void> {
  if (consignmentId < 1 || !Number.isFinite(consignmentId)) {
    throw new AppError("Invalid consignment id", 400);
  }
  const existing = await query(
    `SELECT id FROM outbound_consignments WHERE id = $1`,
    [consignmentId]
  );
  if (existing.rows.length === 0) throw new AppError("Consignment not found", 404);

  const num = invoiceNumber == null ? null : String(invoiceNumber).trim().slice(0, 200) || null;
  const status = num ? "ASSIGNED" : null;

  await query(
    `UPDATE outbound_consignments
     SET invoice_number = $1,
         invoice_number_status = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [num, status, consignmentId]
  );
}

/** Build an Excel workbook summarising a consignment and its SKU items. */
export async function buildOutboundConsignmentInvoiceExcel(
  consignmentId: number
): Promise<{ buffer: Buffer; filename: string }> {
  if (!Number.isFinite(consignmentId) || consignmentId < 1) {
    throw new AppError("Invalid consignment id", 400);
  }

  const consR = await query(
    `SELECT id, company_id, company_name, location, sold_via, po_number, po_type,
            consignment_status, invoice_number_status, invoice_number,
            invoice_upload_status, boxes_count, sku_count, total_quantity,
            transporter_name, vehicle_number, docket_number,
            created_at, marked_rtd_at
     FROM outbound_consignments WHERE id = $1`,
    [consignmentId]
  );
  if (consR.rows.length === 0) throw new AppError("Consignment not found", 404);
  const c = consR.rows[0];

  const itemsR = await query(
    `SELECT po_secondary_sku,
            MAX(company_code_primary) AS company_code_primary,
            MAX(company_code_secondary) AS company_code_secondary,
            MAX(NULLIF(TRIM(raw->>'master_sku'), '')) AS master_sku,
            SUM(COALESCE(box_quantity, 0))::integer AS box_quantity,
            MAX(original_demand)::integer AS original_demand,
            SUM(COALESCE(dispatched_quantity, 0))::integer AS dispatched_quantity,
            SUM(COALESCE(consignment_quantity, 0))::integer AS consignment_quantity,
            MAX(overall_fill_rate) AS overall_fill_rate
     FROM outbound_consignment_items
     WHERE consignment_id = $1
       AND po_secondary_sku IS NOT NULL
       AND TRIM(po_secondary_sku) <> ''
     GROUP BY po_secondary_sku
     ORDER BY po_secondary_sku ASC`,
    [consignmentId]
  );

  const wb = XLSX.utils.book_new();

  const toDate = (v: unknown) => {
    if (v == null) return "";
    const d = new Date(v instanceof Date ? v : (v as string));
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN");
  };

  const summary: unknown[][] = [
    ["Consignment ID", c.id],
    ["PO Number", c.po_number ?? ""],
    ["Company", c.company_name ?? ""],
    ["Location", c.location ?? ""],
    ["Sold Via", c.sold_via ?? ""],
    ["PO Type", c.po_type ?? ""],
    ["Status", c.consignment_status ?? ""],
    ["Invoice Number", c.invoice_number ?? ""],
    ["Invoice Status", c.invoice_number_status ?? ""],
    ["Invoice Upload", c.invoice_upload_status ?? ""],
    ["Boxes", c.boxes_count ?? ""],
    ["SKU Count", c.sku_count ?? ""],
    ["Total Qty", c.total_quantity ?? ""],
    ["Transporter", c.transporter_name ?? ""],
    ["Vehicle No.", c.vehicle_number ?? ""],
    ["Docket No.", c.docket_number ?? ""],
    ["Created At", toDate(c.created_at)],
    ["Marked RTD At", toDate(c.marked_rtd_at)],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary");

  const companyId =
    c.company_id != null ? Number(c.company_id) : null;
  const mappingSkus = itemsR.rows
    .map((r) => (r.master_sku != null ? String(r.master_sku).trim() : ""))
    .filter(Boolean);
  const zapLookup = await batchGetZapEanByCompany({
    company_id: companyId,
    sku_codes: mappingSkus,
  });

  const itemHeaders = [
    "SKU",
    "Company Code (Primary)",
    "Company Code (Secondary)",
    "Zap EAN",
    "Universal EAN",
    "Box Qty",
    "Original Demand",
    "Dispatched Qty",
    "Consignment Qty",
    "Fill Rate",
  ];
  const itemRows = itemsR.rows.map((r) => {
    const sku = r.po_secondary_sku != null ? String(r.po_secondary_sku) : "";
    const masterSku = r.master_sku != null ? String(r.master_sku).trim() : "";
    const zap = masterSku ? zapLookup.get(masterSku) : undefined;
    const companyPrimary = r.company_code_primary != null ? String(r.company_code_primary) : "";
    return [
      sku,
      companyPrimary,
      r.company_code_secondary ?? "",
      resolveZapEanDisplay(companyPrimary, zap),
      zap?.universal_ean ?? "",
      r.box_quantity ?? 0,
      r.original_demand ?? "",
      r.dispatched_quantity ?? 0,
      r.consignment_quantity ?? 0,
      r.overall_fill_rate == null ? "" : Number(r.overall_fill_rate),
    ];
  });
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([itemHeaders, ...itemRows]),
    "Items"
  );

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer: buf, filename: `Consignment-${consignmentId}-invoice.xlsx` };
}
