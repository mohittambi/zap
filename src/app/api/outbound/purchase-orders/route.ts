import path from "path";
import fs from "fs/promises";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import { parsePagination } from "@/server/validators/pagination";
import { OUTBOUND_PO_TYPES } from "@/lib/outbound-po-types";
import * as outboundPoService from "@/server/services/outboundPurchaseOrdersService";

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

    const companyRaw =
      typeof q.company_id === "string"
        ? q.company_id.trim()
        : typeof q.companyId === "string"
          ? q.companyId.trim()
          : "";
    const companyIdParsed = companyRaw ? Number.parseInt(companyRaw, 10) : NaN;
    const companyId =
      Number.isFinite(companyIdParsed) && companyIdParsed > 0
        ? companyIdParsed
        : undefined;
    const deliveryCity =
      typeof q.delivery_city === "string"
        ? q.delivery_city.trim() || undefined
        : typeof q.deliveryCity === "string"
          ? q.deliveryCity.trim() || undefined
          : undefined;
    const poStatus =
      typeof q.po_status === "string"
        ? q.po_status.trim() || undefined
        : typeof q.poStatus === "string"
          ? q.poStatus.trim() || undefined
          : undefined;

    const data = await outboundPoService.listOutboundPurchaseOrders({
      page,
      limit,
      search,
      wipOnly,
      partialOnly,
      companyId,
      deliveryCity,
      poStatus,
    });
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  let createdId: number | null = null;
  let uploadDir: string | null = null;
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
      company_name: companyName,
      created_by: user.email,
    });
    createdId = id;
    uploadDir = path.join(process.cwd(), "uploads", "outbound-po", String(id));
    await fs.mkdir(uploadDir, { recursive: true });

    for (const file of files) {
      const kind = classifyPoUpload(file);
      const buf = Buffer.from(await file.arrayBuffer());
      const fname = safeFilename(file.name);
      const rel = path.posix.join("outbound-po", String(id), fname);
      const abs = path.join(process.cwd(), "uploads", ...rel.split("/"));
      await fs.writeFile(abs, buf);
      await outboundPoService.insertOutboundPoAttachment({
        outbound_po_id: id,
        original_filename: file.name,
        content_type: file.type || null,
        size_bytes: buf.length,
        stored_path: rel,
        kind,
      });
    }

    return NextResponse.json({ id, po_number });
  } catch (err) {
    if (createdId != null) {
      await outboundPoService.deleteOutboundPurchaseOrderById(createdId).catch(() => {});
    }
    if (uploadDir) {
      await fs.rm(uploadDir, { recursive: true, force: true }).catch(() => {});
    }
    return handleApiError(err);
  }
}
