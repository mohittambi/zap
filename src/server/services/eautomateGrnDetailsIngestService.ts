import type { PoolClient } from "pg";
import getPool, { query } from "@/server/db";
import { AppError } from "@/server/errors";
import {
  eautomateConfigured,
  eautomateProxyHeaders,
  getEautomateBaseUrl,
} from "@/server/eautomate-proxy";
import * as inboundGrnsService from "@/server/services/inboundGrnsService";

function num(v: unknown, fallback: number | null = null): number | null {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function parseDateOnly(value: unknown): string | null {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function parseTimestamptz(value: unknown): Date | null {
  if (value == null || value === "") return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  if (y < 1 || y > 9999) return null;
  return d;
}

function pick(obj: Record<string, unknown> | null | undefined, keys: string[]): unknown {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (v != null && v !== "") return v;
  }
  return undefined;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return null;
}

function extractArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const o = asRecord(data);
  if (!o) return [];
  for (const k of ["content", "data", "items", "files", "invoice_files", "logs"]) {
    const a = o[k];
    if (Array.isArray(a)) return a;
  }
  return [];
}

function unwrapEntity(raw: unknown): Record<string, unknown> | null {
  const o = asRecord(raw);
  if (!o) return null;
  const inner = pick(o, ["data", "purchase_order", "po", "vendor", "result"]);
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    return { ...o, ...(inner as Record<string, unknown>) };
  }
  return o;
}

async function fetchEautomateJson(pathSuffix: string): Promise<unknown> {
  if (!eautomateConfigured()) {
    throw new AppError(
      "eautomate is not configured: set EAUTOMATE_COOKIE (or EAUTOMATE_BEARER_TOKEN) in .env.local.",
      503
    );
  }
  const base = getEautomateBaseUrl();
  const u = `${base}/public/api${pathSuffix.startsWith("/") ? pathSuffix : `/${pathSuffix}`}`;
  const res = await fetch(u, {
    headers: eautomateProxyHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(120_000),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = `eautomate HTTP ${res.status}`;
    try {
      const j = JSON.parse(text) as { message?: string };
      if (j?.message) msg = j.message;
    } catch {
      /* ignore */
    }
    throw new AppError(msg, res.status >= 500 ? 502 : res.status);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AppError("Invalid JSON from eautomate", 502);
  }
}

function skuFromLine(line: Record<string, unknown>): string | null {
  const listing = asRecord(pick(line, ["listing", "Listing"]));
  const fromListing = listing
    ? str(pick(listing, ["sku_id", "skuId", "SKU_ID"]))
    : null;
  return (
    fromListing ??
    str(pick(line, ["sku_id", "skuId", "SKU_ID", "secondary_sku_id", "inventory_sku_id"]))
  );
}

/** Apply GET /purchase_orders/grn/{id} fields to inbound_grns when the payload matches grnId. */
async function applyLiveGrnToInboundRow(
  client: PoolClient,
  grnId: number,
  live: Record<string, unknown> | null
): Promise<void> {
  if (!live) return;
  const gid = num(pick(live, ["grn_id", "grnId"]), null);
  if (gid !== grnId) return;
  const poId = num(pick(live, ["po_id", "poId"]), null);
  const vendorId = num(pick(live, ["vendor_id", "vendorId"]), null);
  if (poId == null || vendorId == null) return;

  const actualBoxes =
    num(pick(live, ["actual_box_count_recieved", "actual_box_count_received"]), 0) ?? 0;
  const createdAt = parseTimestamptz(pick(live, ["created_at", "createdAt"])) ?? new Date();
  const updatedAt = parseTimestamptz(pick(live, ["updated_at", "updatedAt"])) ?? createdAt;

  await client.query(
    `UPDATE inbound_grns SET
      po_id = $2,
      vendor_id = $3,
      vendor_name = $4,
      grn_status = $5,
      grn_audit_status = $6,
      grn_audit_by = $7,
      grn_invoice_collection_status = $8,
      grn_invoice_collection_by = $9,
      vendor_invoice_number = $10,
      box_count_invoice = $11,
      actual_box_count_received = $12,
      grn_sku_count = $13,
      grn_invoice_quantity = $14,
      grn_accepted_quantity = $15,
      grn_rejected_quantity = $16,
      grn_shortage_quantity = $17,
      po_sku_count = $18,
      po_total_quantity = $19,
      created_by = $20,
      created_at = $21::timestamptz,
      updated_at = $22::timestamptz
    WHERE grn_id = $1`,
    [
      grnId,
      poId,
      vendorId,
      str(pick(live, ["vendor_name", "vendorName"])) != null
        ? String(str(pick(live, ["vendor_name", "vendorName"]))).slice(0, 200)
        : null,
      str(pick(live, ["grn_status", "grnStatus"])) != null
        ? String(str(pick(live, ["grn_status", "grnStatus"]))).slice(0, 80)
        : null,
      str(pick(live, ["grn_audit_status", "grnAuditStatus"])) != null
        ? String(str(pick(live, ["grn_audit_status", "grnAuditStatus"]))).slice(0, 80)
        : null,
      str(pick(live, ["grn_audit_by", "grnAuditBy"])) != null
        ? String(str(pick(live, ["grn_audit_by", "grnAuditBy"]))).slice(0, 100)
        : null,
      str(pick(live, ["grn_invoice_collection_status", "grnInvoiceCollectionStatus"])) != null
        ? String(str(pick(live, ["grn_invoice_collection_status", "grnInvoiceCollectionStatus"]))).slice(
            0,
            80
          )
        : null,
      str(pick(live, ["grn_invoice_collection_by", "grnInvoiceCollectionBy"])) != null
        ? String(str(pick(live, ["grn_invoice_collection_by", "grnInvoiceCollectionBy"]))).slice(0, 100)
        : null,
      str(pick(live, ["vendor_invoice_number", "vendorInvoiceNumber"])) != null
        ? String(str(pick(live, ["vendor_invoice_number", "vendorInvoiceNumber"]))).slice(0, 200)
        : null,
      num(pick(live, ["box_count_invoice", "boxCountInvoice"]), 0) ?? 0,
      actualBoxes,
      num(pick(live, ["grn_sku_count", "grnSkuCount"]), 0) ?? 0,
      num(pick(live, ["grn_invoice_quantity", "grnInvoiceQuantity"]), 0) ?? 0,
      num(pick(live, ["grn_accepted_quantity", "grnAcceptedQuantity"]), 0) ?? 0,
      num(pick(live, ["grn_rejected_quantity", "grnRejectedQuantity"]), 0) ?? 0,
      num(pick(live, ["grn_shortage_quantity", "grnShortageQuantity"]), 0) ?? 0,
      num(pick(live, ["po_sku_count", "poSkuCount"]), 0) ?? 0,
      num(pick(live, ["po_total_quantity", "poTotalQuantity"]), 0) ?? 0,
      str(pick(live, ["created_by", "createdBy"])) != null
        ? String(str(pick(live, ["created_by", "createdBy"]))).slice(0, 100)
        : null,
      createdAt.toISOString(),
      updatedAt.toISOString(),
    ]
  );
}

function mergeGrnHeaderRaw(
  dbRow: Record<string, unknown>,
  live: Record<string, unknown> | null
): Record<string, unknown> {
  const base: Record<string, unknown> = { ...dbRow };
  for (const [k, v] of Object.entries(base)) {
    if (v instanceof Date) base[k] = v.toISOString();
  }
  if (!live) return base;
  return { ...base, ...live };
}

/**
 * Ingest eight eautomate GET payloads for a GRN (live header, PO, vendor, invoice files,
 * debit/credit notes, GRN logs, PO added items, GRN line items).
 */
export async function ingestGrnDetailsByGrnId(grnId: number): Promise<void> {
  if (!Number.isFinite(grnId) || grnId < 1) {
    throw new AppError("Invalid grn id", 400);
  }

  const headR = await query(
    `SELECT grn_id, po_id, vendor_id, vendor_name, grn_status, grn_audit_status, grn_audit_by,
            grn_invoice_collection_status, grn_invoice_collection_by, vendor_invoice_number,
            box_count_invoice, actual_box_count_received, grn_sku_count, grn_invoice_quantity,
            grn_accepted_quantity, grn_rejected_quantity, grn_shortage_quantity,
            po_sku_count, po_total_quantity, created_by, created_at, updated_at
     FROM inbound_grns WHERE grn_id = $1`,
    [grnId]
  );
  if (headR.rows.length === 0) {
    throw new AppError("GRN not found in inbound_grns (sync GRNs first)", 404);
  }
  const header = headR.rows[0] as Record<string, unknown>;
  const poId = num(header.po_id, null);
  const vendorId = num(header.vendor_id, null);
  if (poId == null || vendorId == null) {
    throw new AppError("GRN row missing po_id or vendor_id", 400);
  }

  const [
    grnJson,
    poJson,
    vendorJson,
    invoiceFilesJson,
    debitCreditNotesJson,
    grnLogsJson,
    addedJson,
    grnItemsJson,
  ] = await Promise.all([
    fetchEautomateJson(`/purchase_orders/grn/${grnId}`).catch(() => null),
    fetchEautomateJson(`/purchase_orders/${poId}`).catch(() => null),
    fetchEautomateJson(`/vendors/${vendorId}`).catch(() => null),
    fetchEautomateJson(`/purchase_orders/grn/invoice_files/${grnId}`).catch(() => null),
    fetchEautomateJson(`/purchase_orders/grn/debit_credit_notes/${grnId}`).catch(() => null),
    fetchEautomateJson(`/purchase_orders/grn/logs/${grnId}`).catch(() => null),
    fetchEautomateJson(
      `/purchase_orders/addedItems/withListing/withPendency/${poId}`
    ).catch(() => null),
    fetchEautomateJson(`/purchase_orders/grn/items/withListing/${grnId}`).catch(() => null),
  ]);

  const grnLive = unwrapEntity(grnJson) ?? asRecord(grnJson);

  const po = unwrapEntity(poJson) ?? {};
  const vendorRoot = unwrapEntity(vendorJson) ?? asRecord(vendorJson) ?? {};
  const vendorNested = asRecord(pick(vendorRoot, ["vendor", "data"])) ?? vendorRoot;
  const vendor = { ...vendorRoot, ...vendorNested };

  const poRelease = parseDateOnly(
    pick(po, ["date_published", "datePublished", "created_at", "createdAt", "po_release_date"])
  );
  const poExpiry = parseDateOnly(
    pick(po, ["expected_date", "expectedDate", "expiry_date", "po_expiry_date"])
  );
  const poCreatedBy = str(pick(po, ["created_by", "createdBy"]));

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await applyLiveGrnToInboundRow(client, grnId, grnLive);

    const headFreshR = await client.query(
      `SELECT grn_id, po_id, vendor_id, vendor_name, grn_status, grn_audit_status, grn_audit_by,
              grn_invoice_collection_status, grn_invoice_collection_by, vendor_invoice_number,
              box_count_invoice, actual_box_count_received, grn_sku_count, grn_invoice_quantity,
              grn_accepted_quantity, grn_rejected_quantity, grn_shortage_quantity,
              po_sku_count, po_total_quantity, created_by, created_at, updated_at
       FROM inbound_grns WHERE grn_id = $1`,
      [grnId]
    );
    const headerFresh = headFreshR.rows[0] as Record<string, unknown>;
    const poIdSnap = num(headerFresh.po_id, null) ?? poId;
    const vendorIdSnap = num(headerFresh.vendor_id, null) ?? vendorId;

    const vendorDisplayName =
      str(pick(vendor, ["vendor_name", "vendorName", "name"])) ??
      str(headerFresh.vendor_name);
    const addrParts = [
      str(pick(vendor, ["vendor_address_line", "vendorAddressLine", "address_line"])),
      str(pick(vendor, ["vendor_city", "vendorCity", "city"])),
      str(pick(vendor, ["vendor_state", "vendorState", "state"])),
      str(pick(vendor, ["vendor_postal_code", "vendorPostalCode", "postal_code", "pincode"])),
    ].filter(Boolean);
    const vendorAddress = addrParts.length ? addrParts.join(", ") : null;
    const vendorGstin = str(pick(vendor, ["vendor_gstin", "vendorGstin", "gstin"]));
    const phone = str(pick(vendor, ["vendor_contact_number", "vendorContactNumber", "phone"]));
    const email = str(pick(vendor, ["email", "vendor_email"]));
    const vendorContact = [phone, email].filter(Boolean).join(" · ") || null;

    const poTotalDemand =
      num(pick(po, ["total_quantity", "totalQuantity", "po_total_quantity"]), null) ??
      num(headerFresh.po_total_quantity, null);

    const grnHeaderRaw = mergeGrnHeaderRaw(headerFresh, grnLive);

    const grnBoxInv = num(headerFresh.box_count_invoice, 0) ?? 0;
    const grnAct = num(headerFresh.actual_box_count_received, 0) ?? 0;
    const grnOpenedBy = str(headerFresh.created_by);
    const grnCreatedAt = parseTimestamptz(headerFresh.created_at);
    const grnUpdatedAt = parseTimestamptz(headerFresh.updated_at);

    await client.query(
      `INSERT INTO inbound_grn_detail_snapshot (
        grn_id, po_id, vendor_id, vendor_display_name, vendor_address, vendor_gstin, vendor_contact,
        po_total_demand, po_release_date, po_expiry_date, po_created_by,
        grn_box_count_invoice, grn_actual_boxes, grn_opened_by, grn_created_at, grn_updated_at,
        synced_at, po_raw, vendor_raw, grn_header_raw, grn_api_raw
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9::date, $10::date, $11,
        $12, $13, $14, $15::timestamptz, $16::timestamptz,
        NOW(), $17::jsonb, $18::jsonb, $19::jsonb, $20::jsonb
      )
      ON CONFLICT (grn_id) DO UPDATE SET
        po_id = EXCLUDED.po_id,
        vendor_id = EXCLUDED.vendor_id,
        vendor_display_name = EXCLUDED.vendor_display_name,
        vendor_address = EXCLUDED.vendor_address,
        vendor_gstin = EXCLUDED.vendor_gstin,
        vendor_contact = EXCLUDED.vendor_contact,
        po_total_demand = EXCLUDED.po_total_demand,
        po_release_date = EXCLUDED.po_release_date,
        po_expiry_date = EXCLUDED.po_expiry_date,
        po_created_by = EXCLUDED.po_created_by,
        grn_box_count_invoice = EXCLUDED.grn_box_count_invoice,
        grn_actual_boxes = EXCLUDED.grn_actual_boxes,
        grn_opened_by = EXCLUDED.grn_opened_by,
        grn_created_at = EXCLUDED.grn_created_at,
        grn_updated_at = EXCLUDED.grn_updated_at,
        synced_at = NOW(),
        po_raw = EXCLUDED.po_raw,
        vendor_raw = EXCLUDED.vendor_raw,
        grn_header_raw = EXCLUDED.grn_header_raw,
        grn_api_raw = EXCLUDED.grn_api_raw`,
      [
        grnId,
        poIdSnap,
        vendorIdSnap,
        vendorDisplayName,
        vendorAddress,
        vendorGstin,
        vendorContact,
        poTotalDemand ?? 0,
        poRelease,
        poExpiry,
        poCreatedBy,
        grnBoxInv,
        grnAct,
        grnOpenedBy,
        grnCreatedAt,
        grnUpdatedAt,
        (poJson ?? {}) as object,
        (vendorJson ?? {}) as object,
        grnHeaderRaw as object,
        (grnJson ?? {}) as object,
      ]
    );

    await client.query(`DELETE FROM inbound_grn_invoice_files WHERE grn_id = $1`, [grnId]);
    const fileRows = extractArray(invoiceFilesJson);
    for (let i = 0; i < fileRows.length; i += 1) {
      const fr = asRecord(fileRows[i]);
      if (!fr) continue;
      const fid = num(pick(fr, ["id", "file_id", "fileId"]), null);
      if (fid == null) continue;
      const fileType = str(pick(fr, ["file_type", "fileType", "type"]));
      const fileName = str(pick(fr, ["file_name", "fileName", "name"]));
      const uploadedAt = parseTimestamptz(
        pick(fr, ["uploaded_at", "uploadedAt", "created_at", "createdAt"])
      );
      const uploadedBy = str(
        pick(fr, [
          "file_uploaded_by",
          "fileUploadedBy",
          "uploaded_by",
          "uploadedBy",
          "created_by",
          "createdBy",
        ])
      );
      const downloadUrl = str(
        pick(fr, ["download_url", "downloadUrl", "url", "file_url", "fileUrl"])
      );
      await client.query(
        `INSERT INTO inbound_grn_invoice_files (
          grn_id, file_id, file_type, file_name, uploaded_at, uploaded_by, download_url, raw
        ) VALUES ($1, $2, $3, $4, $5::timestamptz, $6, $7, $8::jsonb)`,
        [
          grnId,
          fid,
          fileType,
          fileName,
          uploadedAt,
          uploadedBy,
          downloadUrl,
          fr as object,
        ]
      );
    }

    await client.query(`DELETE FROM inbound_grn_debit_credit_notes WHERE grn_id = $1`, [grnId]);
    const dcnRows = extractArray(debitCreditNotesJson);
    for (const row of dcnRows) {
      const note = asRecord(row);
      if (!note) continue;
      const noteId = num(pick(note, ["id", "note_id", "noteId"]), null);
      if (noteId == null) continue;

      await client.query(
        `INSERT INTO inbound_grn_debit_credit_notes (
          grn_id, note_id, po_id, credit_debit_note_type, credit_debit_note_status, credit_debit_note_number,
          credit_debit_note_number_assignment_status, credit_debit_note_upload_status, credit_debit_note_uploaded_by,
          reverse_credit_debit_note_number, reverse_credit_debit_note_upload_status, reverse_credit_debit_note_uploaded_by,
          grn_status, grn_audit_status, grn_audit_by, vendor_invoice_number, box_count_invoice, actual_box_count_recieved,
          vendor_id, vendor_name, created_by, created_at, updated_at, raw
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22::timestamptz, $23::timestamptz, $24::jsonb
        )`,
        [
          grnId,
          noteId,
          num(pick(note, ["po_id", "poId"]), null),
          str(pick(note, ["credit_debit_note_type", "creditDebitNoteType"])) != null
            ? String(str(pick(note, ["credit_debit_note_type", "creditDebitNoteType"]))).slice(0, 120)
            : null,
          str(pick(note, ["credit_debit_note_status", "creditDebitNoteStatus"])) != null
            ? String(str(pick(note, ["credit_debit_note_status", "creditDebitNoteStatus"]))).slice(0, 80)
            : null,
          str(pick(note, ["credit_debit_note_number", "creditDebitNoteNumber"])),
          str(pick(note, ["credit_debit_note_number_assignment_status", "creditDebitNoteNumberAssignmentStatus"])) !=
          null
            ? String(
                str(
                  pick(note, [
                    "credit_debit_note_number_assignment_status",
                    "creditDebitNoteNumberAssignmentStatus",
                  ])
                )
              ).slice(0, 80)
            : null,
          str(pick(note, ["credit_debit_note_upload_status", "creditDebitNoteUploadStatus"])) != null
            ? String(str(pick(note, ["credit_debit_note_upload_status", "creditDebitNoteUploadStatus"]))).slice(
                0,
                80
              )
            : null,
          str(pick(note, ["credit_debit_note_uploaded_by", "creditDebitNoteUploadedBy"])) != null
            ? String(str(pick(note, ["credit_debit_note_uploaded_by", "creditDebitNoteUploadedBy"]))).slice(0, 100)
            : null,
          str(pick(note, ["reverse_credit_debit_note_number", "reverseCreditDebitNoteNumber"])),
          str(pick(note, ["reverse_credit_debit_note_upload_status", "reverseCreditDebitNoteUploadStatus"])) != null
            ? String(
                str(pick(note, ["reverse_credit_debit_note_upload_status", "reverseCreditDebitNoteUploadStatus"]))
              ).slice(0, 80)
            : null,
          str(pick(note, ["reverse_credit_debit_note_uploaded_by", "reverseCreditDebitNoteUploadedBy"])) != null
            ? String(
                str(pick(note, ["reverse_credit_debit_note_uploaded_by", "reverseCreditDebitNoteUploadedBy"]))
              ).slice(0, 100)
            : null,
          str(pick(note, ["grn_status", "grnStatus"])) != null
            ? String(str(pick(note, ["grn_status", "grnStatus"]))).slice(0, 80)
            : null,
          str(pick(note, ["grn_audit_status", "grnAuditStatus"])) != null
            ? String(str(pick(note, ["grn_audit_status", "grnAuditStatus"]))).slice(0, 80)
            : null,
          str(pick(note, ["grn_audit_by", "grnAuditBy"])) != null
            ? String(str(pick(note, ["grn_audit_by", "grnAuditBy"]))).slice(0, 100)
            : null,
          str(pick(note, ["vendor_invoice_number", "vendorInvoiceNumber"])) != null
            ? String(str(pick(note, ["vendor_invoice_number", "vendorInvoiceNumber"]))).slice(0, 200)
            : null,
          num(pick(note, ["box_count_invoice", "boxCountInvoice"]), null),
          num(
            pick(note, ["actual_box_count_recieved", "actual_box_count_received", "actualBoxCountRecieved"]),
            null
          ),
          num(pick(note, ["vendor_id", "vendorId"]), null),
          str(pick(note, ["vendor_name", "vendorName"])) != null
            ? String(str(pick(note, ["vendor_name", "vendorName"]))).slice(0, 200)
            : null,
          str(pick(note, ["created_by", "createdBy"])) != null
            ? String(str(pick(note, ["created_by", "createdBy"]))).slice(0, 100)
            : null,
          parseTimestamptz(pick(note, ["created_at", "createdAt"])),
          parseTimestamptz(pick(note, ["updated_at", "updatedAt"])),
          note as object,
        ]
      );

      const nestedFiles = extractArray(pick(note, ["files", "Files"]));
      for (const fr of nestedFiles) {
        const frec = asRecord(fr);
        if (!frec) continue;
        const fid = num(pick(frec, ["id", "file_id", "fileId"]), null);
        if (fid == null) continue;
        const fileType = str(pick(frec, ["file_type", "fileType", "type"]));
        const fileName = str(pick(frec, ["file_name", "fileName", "name"]));
        const savedName = str(pick(frec, ["saved_file_name", "savedFileName"]));
        const filePath = str(pick(frec, ["file_path", "filePath"]));
        const uploadedAt = parseTimestamptz(
          pick(frec, ["uploaded_at", "uploadedAt", "created_at", "createdAt"])
        );
        const uploadedByFile = str(
          pick(frec, [
            "file_uploaded_by",
            "fileUploadedBy",
            "uploaded_by",
            "uploadedBy",
            "created_by",
            "createdBy",
          ])
        );
        const downloadUrl = str(
          pick(frec, ["download_url", "downloadUrl", "url", "file_url", "fileUrl"])
        );
        await client.query(
          `INSERT INTO inbound_grn_debit_credit_note_files (
            grn_id, note_id, file_id, file_type, file_name, saved_file_name, file_path,
            uploaded_at, uploaded_by, download_url, raw
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9, $10, $11::jsonb)`,
          [
            grnId,
            noteId,
            fid,
            fileType,
            fileName,
            savedName,
            filePath,
            uploadedAt,
            uploadedByFile,
            downloadUrl,
            frec as object,
          ]
        );
      }
    }

    await client.query(`DELETE FROM inbound_grn_logs WHERE grn_id = $1`, [grnId]);
    const logRows = extractArray(grnLogsJson);
    for (let i = 0; i < logRows.length; i += 1) {
      const lg = asRecord(logRows[i]);
      if (!lg) continue;
      const logId = num(pick(lg, ["id", "log_id", "logId"]), null);
      if (logId == null) continue;

      const op = str(pick(lg, ["operation_performed", "operationPerformed", "operation"]));
      const logType = str(pick(lg, ["log_type", "logType", "type"]));
      const remarks = str(pick(lg, ["remarks", "remark", "message"]));
      const createdByLog = str(pick(lg, ["created_by", "createdBy"]));
      const skuLog = str(
        pick(lg, ["sku_id", "skuId", "SKU_ID", "sku", "secondary_sku_id", "inventory_sku_id"])
      );
      const invQty = num(
        pick(lg, ["invoice_quantity", "invoiceQuantity", "grn_invoice_quantity", "invoiced_quantity"]),
        null
      );
      const accQty = num(pick(lg, ["accepted_quantity", "acceptedQuantity", "grn_accepted_quantity"]), null);
      const rejQty = num(pick(lg, ["rejected_quantity", "rejectedQuantity", "grn_rejected_quantity"]), null);
      const recvPrice = num(pick(lg, ["received_price", "receivedPrice", "price", "audit_price"]), null);

      await client.query(
        `INSERT INTO inbound_grn_logs (
          grn_id, log_id, line_index, log_type, operation_performed, po_id, vendor_id, foreign_key,
          sku_id, invoice_quantity, accepted_quantity, rejected_quantity, received_price,
          remarks, created_by, created_at, updated_at, raw
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::timestamptz, $17::timestamptz, $18::jsonb
        )`,
        [
          grnId,
          logId,
          i,
          logType,
          op,
          num(pick(lg, ["po_id", "poId"]), null),
          num(pick(lg, ["vendor_id", "vendorId"]), null),
          num(pick(lg, ["foreign_key", "foreignKey", "grn_id", "grnId"]), null),
          skuLog,
          invQty,
          accQty,
          rejQty,
          recvPrice,
          remarks,
          createdByLog,
          parseTimestamptz(pick(lg, ["created_at", "createdAt"])),
          parseTimestamptz(pick(lg, ["updated_at", "updatedAt"])),
          lg as object,
        ]
      );
    }

    await client.query(`DELETE FROM inbound_grn_added_items WHERE grn_id = $1`, [grnId]);
    const addedRows = extractArray(addedJson);
    for (let i = 0; i < addedRows.length; i += 1) {
      const line = asRecord(addedRows[i]);
      if (!line) continue;
      const sku = skuFromLine(line);
      await client.query(
        `INSERT INTO inbound_grn_added_items (grn_id, line_index, sku_id, raw) VALUES ($1, $2, $3, $4::jsonb)`,
        [grnId, i, sku, line as object]
      );
    }

    await client.query(`DELETE FROM inbound_grn_items WHERE grn_id = $1`, [grnId]);
    const grnLineRows = extractArray(grnItemsJson);
    for (let i = 0; i < grnLineRows.length; i += 1) {
      const line = asRecord(grnLineRows[i]);
      if (!line) continue;
      const sku = skuFromLine(line);
      await client.query(
        `INSERT INTO inbound_grn_items (grn_id, line_index, sku_id, raw) VALUES ($1, $2, $3, $4::jsonb)`,
        [grnId, i, sku, line as object]
      );
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function getGrnDetailsBundle(grnId: number) {
  if (!Number.isFinite(grnId) || grnId < 1) {
    throw new AppError("Invalid grn id", 400);
  }
  const header = await inboundGrnsService.getGrnById(String(grnId)).catch(() => null);
  if (!header) {
    throw new AppError("GRN not found", 404);
  }

  const snapR = await query(`SELECT * FROM inbound_grn_detail_snapshot WHERE grn_id = $1`, [
    grnId,
  ]);
  const snapshot = snapR.rows[0] ?? null;

  const filesR = await query(
    `SELECT file_id, file_type, file_name, uploaded_at, uploaded_by, download_url, raw
     FROM inbound_grn_invoice_files WHERE grn_id = $1 ORDER BY file_id`,
    [grnId]
  );

  const addedR = await query(
    `SELECT line_index, sku_id, raw FROM inbound_grn_added_items WHERE grn_id = $1 ORDER BY line_index`,
    [grnId]
  );

  const itemsR = await query(
    `SELECT line_index, sku_id, raw FROM inbound_grn_items WHERE grn_id = $1 ORDER BY line_index`,
    [grnId]
  );

  const dcnR = await query(
    `SELECT grn_id, note_id, po_id, credit_debit_note_type, credit_debit_note_status, credit_debit_note_number,
            credit_debit_note_number_assignment_status, credit_debit_note_upload_status, credit_debit_note_uploaded_by,
            reverse_credit_debit_note_number, reverse_credit_debit_note_upload_status, reverse_credit_debit_note_uploaded_by,
            grn_status, grn_audit_status, grn_audit_by, vendor_invoice_number, box_count_invoice, actual_box_count_recieved,
            vendor_id, vendor_name, created_by, created_at, updated_at, raw
     FROM inbound_grn_debit_credit_notes WHERE grn_id = $1 ORDER BY note_id`,
    [grnId]
  );

  const dcnFilesR = await query(
    `SELECT grn_id, note_id, file_id, file_type, file_name, saved_file_name, file_path,
            uploaded_at, uploaded_by, download_url, raw
     FROM inbound_grn_debit_credit_note_files WHERE grn_id = $1 ORDER BY note_id, file_id`,
    [grnId]
  );

  const filesByNote = new Map<number, typeof dcnFilesR.rows>();
  for (const f of dcnFilesR.rows) {
    const nid = Number((f as { note_id: number }).note_id);
    const list = filesByNote.get(nid) ?? [];
    list.push(f);
    filesByNote.set(nid, list);
  }

  const debit_credit_notes = dcnR.rows.map((row) => {
    const nid = Number((row as { note_id: number }).note_id);
    return {
      ...row,
      files: filesByNote.get(nid) ?? [],
    };
  });

  const logsR = await query(
    `SELECT grn_id, log_id, line_index, log_type, operation_performed, po_id, vendor_id, foreign_key,
            sku_id, invoice_quantity, accepted_quantity, rejected_quantity, received_price,
            remarks, created_by, created_at, updated_at, raw
     FROM inbound_grn_logs WHERE grn_id = $1
     ORDER BY created_at DESC NULLS LAST, log_id DESC`,
    [grnId]
  );

  return {
    header,
    snapshot,
    invoice_files: filesR.rows,
    debit_credit_notes,
    grn_logs: logsR.rows,
    added_items: addedR.rows,
    grn_items: itemsR.rows,
  };
}

export async function snapshotExists(grnId: number): Promise<boolean> {
  const r = await query(
    `SELECT 1 FROM inbound_grn_detail_snapshot WHERE grn_id = $1 LIMIT 1`,
    [grnId]
  );
  return r.rows.length > 0;
}
