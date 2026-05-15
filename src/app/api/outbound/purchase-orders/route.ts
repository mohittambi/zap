import path from "path";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import { parsePagination } from "@/server/validators/pagination";
import { OUTBOUND_PO_TYPES } from "@/lib/outbound-po-types";
import * as outboundPoService from "@/server/services/outboundPurchaseOrdersService";
import { uploadBufferToBucket, getOutboundBucket } from "@/server/zapStorage";

const MAX_PO_FILES = 2;
const MAX_PO_FILE_BYTES = 2 * 1024 * 1024;

function safeFilename(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
  return (base || "file").slice(0, 180);
}

function classifyPoUpload(file: File): "pdf" | "spreadsheet" | "other" {
  const lower = file.name.toLowerCase();
  const mt = (file.type || "").toLowerCase();
  if (lower.endsWith(".pdf") || mt.includes("pdf")) return "pdf";
  if (
    lower.endsWith(".csv") ||
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    mt.includes("spreadsheet") ||
    mt.includes("csv") ||
    mt.includes("excel") ||
    mt.includes("sheet")
  ) {
    return "spreadsheet";
  }
  return "other";
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const { page, limit } = parsePagination(q, {
      page: 1,
      limit: 100,
      maxLimit: 200,
    });
    const search = typeof q.search === "string" ? q.search : undefined;
    const wipOnly =
      q.wip === "1" ||
      q.wip === "true" ||
      q.filter === "wip" ||
      q.status === "wip";
    const partialOnly =
      q.partial === "1" ||
      q.partial === "true" ||
      q.filter === "partial";

    const csvList = (raw: string | undefined): string[] =>
      typeof raw === "string"
        ? raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
        : [];

    /** Multi-select: prefer plural `*_ids`/`*_list`; accept singular for back-compat. */
    const companyIdsRaw =
      csvList(q.company_ids) .length > 0
        ? csvList(q.company_ids)
        : csvList(q.company_id);
    const companyIds = companyIdsRaw
      .map((s) => Number.parseInt(s, 10))
      .filter((n) => Number.isFinite(n) && n > 0);

    const deliveryCities =
      csvList(q.delivery_cities).length > 0
        ? csvList(q.delivery_cities)
        : csvList(q.delivery_city);

    const poStatuses =
      csvList(q.po_statuses).length > 0
        ? csvList(q.po_statuses)
        : csvList(q.po_status);

    const poTypes = csvList(q.po_types);

    const poNumber =
      typeof q.po_number === "string" ? q.po_number.trim() || undefined : undefined;

    const sortBy = typeof q.sort_by === "string" ? q.sort_by.trim() || undefined : undefined;
    let sortDir: "asc" | "desc" | undefined;
    if (q.sort_dir === "asc") sortDir = "asc";
    else if (q.sort_dir === "desc") sortDir = "desc";

    const data = await outboundPoService.listOutboundPurchaseOrders({
      page,
      limit,
      search,
      wipOnly,
      partialOnly,
      poNumber,
      companyIds,
      deliveryCities,
      poStatuses,
      poTypes,
      sortBy,
      sortDir,
    });
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  let createdId: number | null = null;
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "create");
    const form = await request.formData();

    const soldViaCode = String(form.get("soldViaCode") ?? "").trim();
    const companyId = Number(form.get("companyId"));
    const poLocation = String(form.get("poLocation") ?? "").trim();
    const billingAddress = String(form.get("billingAddress") ?? "").trim();
    const shippingAddress = String(form.get("shippingAddress") ?? "").trim();
    const buyerGstin = String(form.get("buyerGstin") ?? "").trim();
    const poReleaseIso = String(form.get("poReleaseIso") ?? "").trim();
    const poExpiryIso = String(form.get("poExpiryIso") ?? "").trim();
    const poType = String(form.get("poType") ?? "").trim();

    const files = form
      .getAll("po_files")
      .filter((x): x is File => x instanceof File && x.size > 0);

    if (!soldViaCode) throw new AppError("Sold via is required", 400);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      throw new AppError("Company is required", 400);
    }
    if (poLocation.length < 2) throw new AppError("PO location is required", 400);
    if (billingAddress.length < 3) {
      throw new AppError("Billing address is required", 400);
    }
    if (shippingAddress.length < 3) {
      throw new AppError("Shipping address is required", 400);
    }
    if (
      buyerGstin &&
      !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(buyerGstin)
    ) {
      throw new AppError("Invalid Buyer GSTIN format (15-character GSTIN)", 400);
    }
    if (!poReleaseIso || !poExpiryIso) {
      throw new AppError("Set PO release date and PO expiry date using the form controls", 400);
    }
    const poIssueDate = new Date(poReleaseIso);
    const expiryDate = new Date(poExpiryIso);
    if (Number.isNaN(poIssueDate.getTime()) || Number.isNaN(expiryDate.getTime())) {
      throw new AppError("Invalid release or expiry date", 400);
    }
    if (expiryDate < poIssueDate) {
      throw new AppError("Expiry date must be on or after the release date", 400);
    }
    const allowedTypes = OUTBOUND_PO_TYPES as readonly string[];
    if (!poType || !allowedTypes.includes(poType)) {
      throw new AppError("Select a valid PO type", 400);
    }

    const isDraft = files.length === 0;

    if (!isDraft) {
      if (files.length !== MAX_PO_FILES) {
        throw new AppError(
          "Upload exactly two files: one PDF and one spreadsheet (CSV or Excel). Maximum 2 files, 2MB each.",
          400
        );
      }
      for (const f of files) {
        if (f.size > MAX_PO_FILE_BYTES) {
          throw new AppError(`File "${f.name}" exceeds the 2MB limit`, 400);
        }
        if (classifyPoUpload(f) === "other") {
          throw new AppError(
            `Unsupported file type: "${f.name}". Use PDF or Excel/CSV.`,
            400
          );
        }
      }
      const pdfCount = files.filter((f) => classifyPoUpload(f) === "pdf").length;
      const ssCount = files.filter((f) => classifyPoUpload(f) === "spreadsheet").length;
      if (pdfCount !== 1 || ssCount !== 1) {
        throw new AppError(
          "Provide exactly one PDF and one spreadsheet or CSV (one of each).",
          400
        );
      }
    }

    const soldViaOptions = await outboundPoService.listOutboundSoldViaOptions();
    const soldViaLabel =
      soldViaOptions.find((o) => o.code === soldViaCode)?.label ?? soldViaCode;
    const compRows = await outboundPoService.listOutboundCompaniesForForm();
    const companyName = compRows.find((c) => c.id === companyId)?.name ?? null;

    const { id, po_number } = await outboundPoService.createOutboundPurchaseOrderRow({
      sold_via: soldViaLabel,
      company_id: companyId,
      delivery_city: poLocation,
      delivery_address: shippingAddress,
      billing_address: billingAddress,
      buyer_gstin: buyerGstin || null,
      po_issue_date: poIssueDate,
      expiry_date: expiryDate,
      po_type: poType,
      po_creation_status: isDraft ? "DRAFT" : "SUBMITTED",
      is_wip: isDraft ? "NO" : "YES",
      company_name: companyName,
      created_by: user.email,
    });
    createdId = id;

    for (const file of files) {
      const kind = classifyPoUpload(file);
      const buf = Buffer.from(await file.arrayBuffer());
      const fname = safeFilename(file.name);
      const objectPath = path.posix.join("outbound-po", String(id), fname);
      await uploadBufferToBucket(getOutboundBucket(), objectPath, buf, file.type || "application/octet-stream");
      await outboundPoService.insertOutboundPoAttachment({
        outbound_po_id: id,
        original_filename: file.name,
        content_type: file.type || null,
        size_bytes: buf.length,
        stored_path: objectPath,
        kind,
      });
    }

    return NextResponse.json({ id, po_number, draft: isDraft });
  } catch (err) {
    if (createdId != null) {
      await outboundPoService.deleteOutboundPurchaseOrderById(createdId).catch(() => {});
    }
    return handleApiError(err);
  }
}
