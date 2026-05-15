"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch, apiUrl, getStoredToken } from "@/lib/api-browser";
import { filenameFromContentDisposition } from "@/lib/filenameFromContentDisposition";
import {
  closeGrnDisabledHint,
  closeGrnSubmitDisabled,
  closeGrnSubmitLabel,
  hasVendorInvoiceReadyToClose,
  showCloseGrnHeaderAction,
  VENDOR_INVOICE_MAX_FILES as VENDOR_INVOICE_MAX_FILES_LIB,
} from "@/lib/inboundGrnCloseUi";
import { classifyVendorInvoicePick } from "@/lib/inboundVendorInvoiceUi";
import { assertGrnLineQuantitiesAccountable } from "@/lib/grnLineQuantityValidation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AppPageTitle } from "@/components/layout/app-page-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CircleHelp,
  Download,
  FileText,
  PanelRightOpen,
  Plus,
  Trash2,
} from "lucide-react";
import { MermaidDiagram } from "@/components/ui/mermaid";
import { formatGrnLabel } from "@/lib/idDisplay";

type JsonRecord = Record<string, unknown>;

type GrnHeader = {
  grn_id: number;
  po_id: number;
  vendor_id: number;
  vendor_name: string | null;
  grn_status: string | null;
  grn_audit_status: string | null;
  grn_audit_by: string | null;
  grn_invoice_collection_status: string | null;
  grn_invoice_collection_by: string | null;
  accounts_status: string | null;
  accounts_by: string | null;
  accounts_at: string | null;
  inventory_receipt_status: string | null;
  inventory_receipt_by: string | null;
  inventory_receipt_at: string | null;
  vendor_invoice_number: string | null;
  box_count_invoice: number;
  actual_box_count_recieved: number;
  grn_sku_count: number;
  grn_invoice_quantity: string;
  grn_accepted_quantity: string;
  grn_rejected_quantity: string;
  grn_shortage_quantity: string;
  po_sku_count: number;
  po_total_quantity: number;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  /** Drives ZG- prefix in the page title. Doctrine #5. */
  source?: "zap" | "eautomate";
};

type SnapshotRow = {
  grn_id: number;
  po_id: number;
  vendor_id: number;
  vendor_display_name: string | null;
  vendor_address: string | null;
  vendor_gstin: string | null;
  vendor_contact: string | null;
  po_total_demand: number | null;
  po_release_date: string | null;
  po_expiry_date: string | null;
  po_created_by: string | null;
  grn_box_count_invoice: number | null;
  grn_actual_boxes: number | null;
  grn_opened_by: string | null;
  grn_created_at: string | null;
  grn_updated_at: string | null;
  synced_at: string | null;
  po_raw: JsonRecord;
  vendor_raw: JsonRecord;
  grn_header_raw: JsonRecord;
  grn_api_raw?: JsonRecord;
};

type InvoiceFileRow = {
  file_id: number;
  file_type: string | null;
  file_name: string | null;
  uploaded_at: string | null;
  uploaded_by: string | null;
  download_url: string | null;
  raw: JsonRecord;
};

type LineRow = {
  line_index: number;
  sku_id: string | null;
  raw: JsonRecord;
};

type BinOptionRow = {
  bin_id: string;
  warehouse_id: number;
  available_quantity: number;
};

type ReceiptLineItem = {
  row_key: string;
  line_index: number;
  sku_id: string;
  sku_description: string;
  /** Total accepted quantity for this GRN line (cap across bin splits). */
  accepted_qty: number;
  bin_id: string;
  quantity: string;
  bin_entry_mode: "dropdown" | "custom";
};

function sumBookedForLine(items: ReceiptLineItem[], line_index: number, excludeRowKey?: string): number {
  return items
    .filter((i) => i.line_index === line_index && i.row_key !== excludeRowKey)
    .reduce((s, i) => s + (Number(i.quantity) || 0), 0);
}

function maxBookableForRow(items: ReceiptLineItem[], item: ReceiptLineItem): number {
  return Math.max(0, item.accepted_qty - sumBookedForLine(items, item.line_index, item.row_key));
}

function sumBookedLineTotal(items: ReceiptLineItem[], line_index: number): number {
  return items
    .filter((i) => i.line_index === line_index)
    .reduce((s, i) => s + (Number(i.quantity) || 0), 0);
}

type DebitCreditNoteFileRow = {
  grn_id: number;
  note_id: number;
  file_id: number;
  file_type: string | null;
  file_name: string | null;
  saved_file_name: string | null;
  file_path: string | null;
  uploaded_at: string | null;
  uploaded_by: string | null;
  download_url: string | null;
  raw: JsonRecord;
};

type DebitCreditNoteRow = {
  grn_id: number;
  note_id: number;
  po_id: number | null;
  credit_debit_note_type: string | null;
  credit_debit_note_status: string | null;
  credit_debit_note_number: string | null;
  credit_debit_note_number_assignment_status: string | null;
  credit_debit_note_upload_status: string | null;
  credit_debit_note_uploaded_by: string | null;
  reverse_credit_debit_note_number: string | null;
  reverse_credit_debit_note_upload_status: string | null;
  reverse_credit_debit_note_uploaded_by: string | null;
  grn_status: string | null;
  grn_audit_status: string | null;
  grn_audit_by: string | null;
  vendor_invoice_number: string | null;
  box_count_invoice: number | null;
  actual_box_count_recieved: number | null;
  vendor_id: number | null;
  vendor_name: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  raw: JsonRecord;
  files: DebitCreditNoteFileRow[];
};

type GrnLogRow = {
  grn_id: number;
  log_id: number;
  line_index: number;
  log_type: string | null;
  operation_performed: string | null;
  po_id: number | null;
  vendor_id: number | null;
  foreign_key: number | null;
  sku_id: string | null;
  invoice_quantity: number | null;
  accepted_quantity: number | null;
  rejected_quantity: number | null;
  received_price: string | number | null;
  remarks: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  raw: JsonRecord;
};

type GrnDetailsBundle = {
  header: GrnHeader;
  snapshot: SnapshotRow | null;
  invoice_files: InvoiceFileRow[];
  debit_credit_notes: DebitCreditNoteRow[];
  grn_logs: GrnLogRow[];
  added_items: LineRow[];
  grn_items: LineRow[];
};

type AuditLine = {
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

type DebitNoteLine = {
  id: number;
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

type ZapDebitNote = {
  id: number;
  grn_id: number;
  note_reference: string;
  vendor_name: string | null;
  po_id: number | null;
  total_debit_amount: number;
  line_count: number;
  status: "DRAFT" | "ISSUED" | "EXPORTED" | "CLOSED";
  generated_by: string | null;
  generated_at: string;
  exported_at: string | null;
  dn_number: string | null;
  dn_number_assigned_by: string | null;
  dn_number_assigned_at: string | null;
  cn_copy_file_name: string | null;
  cn_copy_uploaded_at: string | null;
  cn_copy_uploaded_by: string | null;
  narration: string;
  lines: DebitNoteLine[];
};

const INBOUND_GRN_DETAIL_FLOW = `
flowchart TD
  start(["1 Open GRN in Zap web"]) --> idGate{"Negative GRN id?"}
  idGate -->|Yes draft| draft["Zap draft DRAFT_ZAP from PO"]
  idGate -->|No operational| ops["Positive GRN id live or synced"]
  draft --> register(["2 Register operational GRN"])
  register --> ops
  ops --> enterLines(["3 GRN Details OPEN"])
  enterLines --> noteEnter["Line qty and price vs PO"]
  noteEnter --> vendorInv(["4 Vendor invoice Documents or Close GRN"])
  vendorInv --> closeGate(["5 Close GRN"])
  closeGate --> closed["CLOSED lines frozen"]
  closed --> accountsGate(["6 Accounts if required"])
  accountsGate --> inventoryStep(["7 Inventory to bins"])
  inventoryStep --> auditStep(["8 Audit and Debit Note"])
`;

const displayFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const displayDateOnlyFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatDisplayDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return displayFormatter.format(d);
}

/** Calendar dates only — e.g. "17 Apr 2026" (aligned with CLOSED GRN summary). */
function formatDisplayDateOnly(value: string | null | undefined): string {
  if (!value) return "—";
  const s = String(value).trim();
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s|T|$)/);
  if (ymd) {
    const y = Number(ymd[1]);
    const mo = Number(ymd[2]);
    const dDay = Number(ymd[3]);
    const d = new Date(y, mo - 1, dDay);
    if (!Number.isNaN(d.getTime())) return displayDateOnlyFormatter.format(d);
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(value);
  return displayDateOnlyFormatter.format(d);
}

/** Closed-style statuses → violet emphasis */
function statusClosedClass(value: string | null | undefined): string {
  if (!value) return "";
  const up = value.trim().toUpperCase();
  if (
    up === "CLOSED" ||
    up === "DONE" ||
    up === "COMPLETED" ||
    up === "SETTLED"
  ) {
    return "text-violet-600 dark:text-violet-400 font-medium";
  }
  return "";
}

/** Invoice collection OPEN → green */
function invoiceCollectionClass(value: string | null | undefined): string {
  if (!value) return "";
  const up = value.trim().toUpperCase();
  if (up === "OPEN") {
    return "text-emerald-600 dark:text-emerald-400 font-medium";
  }
  return statusClosedClass(value);
}

/** Vendor invoice files (JPG, JPEG, PDF; 4 MB each). Server enforces per-file
 * size + type; client caps the count to keep the upload loop bounded. */
const VENDOR_INVOICE_MAX_FILES = VENDOR_INVOICE_MAX_FILES_LIB;
function filterVendorInvoiceFilesPicked(picked: File[]): File[] {
  if (picked.length > VENDOR_INVOICE_MAX_FILES) {
    toast.message(
      `Only the first ${VENDOR_INVOICE_MAX_FILES} files are used (max ${VENDOR_INVOICE_MAX_FILES}).`
    );
  }
  const out: File[] = [];
  for (const f of picked.slice(0, VENDOR_INVOICE_MAX_FILES)) {
    const rej = classifyVendorInvoicePick(f.name, f.size);
    if (rej === "oversize") {
      toast.error(`${f.name} exceeds 4MB`);
      continue;
    }
    if (rej === "bad_extension") {
      toast.error(`${f.name}: use JPG, JPEG, or PDF only`);
      continue;
    }
    out.push(f);
  }
  return out;
}

function debitNoteGoodClass(value: string | null | undefined): string {
  if (!value) return "";
  const up = value.trim().toUpperCase();
  if (
    up === "APPROVED" ||
    up === "UPLOADED" ||
    up === "ASSIGNED" ||
    up === "OPEN"
  ) {
    return "text-emerald-600 dark:text-emerald-400 font-medium";
  }
  return "";
}

function debitNoteBadClass(value: string | null | undefined): string {
  if (!value) return "";
  const up = value.trim().toUpperCase();
  if (up.includes("NOT") && up.includes("UPLOAD")) {
    return "text-red-600 dark:text-red-400 font-medium";
  }
  return "";
}

function formatNoteType(t: string | null | undefined): string {
  if (!t) return "—";
  return t.replaceAll("_", " ");
}

function mimeTypeForCnFilename(name: string | null | undefined): string | null {
  const n = (name ?? "").toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".png")) return "image/png";
  return null;
}

function withExplicitCnMime(blob: Blob, filename: string | null | undefined): Blob {
  const hint = mimeTypeForCnFilename(filename);
  if (!hint) return blob;
  if (blob.type && blob.type !== "" && blob.type !== "application/octet-stream") {
    return blob;
  }
  return new Blob([blob], { type: hint });
}

function pickPoRaw(snap: SnapshotRow | null, key: string): string | null {
  if (!snap?.po_raw) return null;
  const v = snap.po_raw[key];
  if (v == null || v === "") return null;
  return String(v);
}

/** Prefer typed column; else first matching key in raw (full API payload). */
function pickLogField(
  typed: string | number | null | undefined,
  raw: JsonRecord | undefined,
  keys: string[]
): string {
  if (typed != null && typed !== "") return String(typed);
  if (!raw) return "—";
  for (const k of keys) {
    const v = raw[k];
    if (v != null && v !== "") return String(v);
  }
  return "—";
}

function formatLogOperation(op: string | null | undefined): string {
  if (!op) return "—";
  return op.replaceAll("_", " ");
}

function asRecord(v: unknown): JsonRecord | null {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as JsonRecord;
  return null;
}

function pickLine(raw: JsonRecord | null | undefined, keys: string[]): string {
  if (!raw) return "—";
  for (const k of keys) {
    const v = raw[k];
    if (v != null && v !== "") return String(v);
  }
  const listing = asRecord(raw.listing);
  if (listing) {
    for (const k of keys) {
      const v = listing[k];
      if (v != null && v !== "") return String(v);
    }
  }
  const extraNests = [
    "pendency",
    "pendency_object",
    "Pendency",
    "previous_grns",
    "previousGrns",
    "prev_grns",
    "prevGrns",
    "previous_grn_totals",
    "previousGrnTotals",
    "aggregate_prev_grns",
  ];
  for (const nestKey of extraNests) {
    const nest = asRecord(raw[nestKey]);
    if (nest) {
      for (const k of keys) {
        const v = nest[k];
        if (v != null && v !== "") return String(v);
      }
    }
  }
  return "—";
}

/** ISO-like dates from line JSON; otherwise passthrough. */
function formatLineMaybeDate(value: string): string {
  if (value === "—") return "—";
  const d = new Date(value);
  if (!Number.isNaN(d.getTime()) && value.length >= 10) {
    return formatDisplayDateTime(value);
  }
  return value;
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-0.5", className)}>
      <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
      <dd className="text-sm break-words">{children}</dd>
    </div>
  );
}

function DocumentsStatChip({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-gradient-to-br px-3 py-2.5 shadow-sm backdrop-blur-sm",
        className
      )}
    >
      <p className="text-muted-foreground mb-1 text-[10px] font-semibold uppercase tracking-wide">
        {label}
      </p>
      <p className="font-mono text-xl leading-tight font-semibold tracking-tight tabular-nums">
        {value}
      </p>
    </div>
  );
}

function fileTypeBadgeClass(fileType: string | null | undefined): string {
  const u = (fileType ?? "").toUpperCase();
  if (u.includes("DEBIT") || u.includes("CREDIT")) {
    return "border-amber-300/70 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-50";
  }
  if (u.includes("INVOICE")) {
    return "border-blue-300/70 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/45 dark:text-blue-50";
  }
  return "border-border bg-muted/40 text-foreground";
}

function GrnDocumentFileCard(props: {
  fileHref: string;
  file_type: string | null;
  file_name: string | null;
  uploaded_at: string | null;
  uploaded_by: string | null;
}) {
  const { fileHref, file_type, file_name, uploaded_at, uploaded_by } = props;
  return (
    <div className="group flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-[box-shadow,border-color] hover:border-primary/25 hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg border">
          <FileText className="size-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wide",
                fileTypeBadgeClass(file_type)
              )}
            >
              {file_type ?? "FILE"}
            </Badge>
            <span className="truncate font-mono text-sm font-semibold">
              {file_name ?? "—"}
            </span>
          </div>
          <p className="text-muted-foreground text-xs">
            {uploaded_by ? <span>{uploaded_by}</span> : null}
            {uploaded_by && uploaded_at ? (
              <span className="text-muted-foreground/80"> · </span>
            ) : null}
            {uploaded_at ? formatDisplayDateTime(uploaded_at) : null}
            {!uploaded_by && !uploaded_at ? "—" : null}
          </p>
        </div>
      </div>
      <Button variant="outline" size="sm" className="shrink-0" asChild>
        <a href={fileHref} target="_blank" rel="noreferrer">
          <Download className="size-4" />
          Download
        </a>
      </Button>
    </div>
  );
}

function pickPoFillRate(snap: SnapshotRow | null): string | null {
  const qty = pickPoRaw(snap, "quantity_fill_rate");
  if (qty) return qty;
  return pickPoRaw(snap, "sku_fill_rate");
}

function getLogTimelineAccent(
  logType: string | null,
  operation: string | null
): { dotClass: string; leftBarClass: string } {
  const op = (operation ?? "").toUpperCase();
  const lt = (logType ?? "").toUpperCase();
  const hay = `${lt} ${op}`;
  if (hay.includes("DEBIT") || hay.includes("CREDIT")) {
    return {
      dotClass: "border-amber-700 bg-amber-500 ring-4 ring-amber-500/35",
      leftBarClass:
        "border-l-[3px] border-l-amber-500/95 dark:border-l-amber-500/70",
    };
  }
  if (hay.includes("AUDIT") || op.includes("CLOSED")) {
    return {
      dotClass: "border-violet-700 bg-violet-500 ring-4 ring-violet-500/30",
      leftBarClass:
        "border-l-[3px] border-l-violet-500/95 dark:border-l-violet-500/65",
    };
  }
  if (
    hay.includes("ENTRY") ||
    hay.includes("INPUT") ||
    hay.includes("GRN_INPUT")
  ) {
    return {
      dotClass: "border-sky-700 bg-sky-500 ring-4 ring-sky-500/30",
      leftBarClass:
        "border-l-[3px] border-l-sky-500/95 dark:border-l-sky-500/65",
    };
  }
  return {
    dotClass:
      "border-slate-500 bg-slate-400 ring-4 ring-slate-400/35 dark:bg-slate-500",
    leftBarClass:
      "border-l-[3px] border-l-muted-foreground/55 dark:border-l-muted-foreground/45",
  };
}

function LogQtyPill({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  if (value === "—") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-xs tabular-nums",
        className
      )}
    >
      <span className="text-muted-foreground text-[10px] font-semibold uppercase">
        {label}
      </span>
      {value}
    </span>
  );
}

const ADDED_ITEM_KEYS = {
  sku: ["sku_id", "skuId", "secondary_sku_id", "inventory_sku_id"],
  title: [
    "listing_title",
    "listingTitle",
    "product_name",
    "productName",
    "title",
    "name",
  ],
  ordered: [
    "ordered_quantity",
    "orderedQuantity",
    "po_quantity",
    "poQuantity",
    "quantity",
    "total_quantity",
  ],
  pendency: [
    "total_pendency",
    "totalPendency",
    "pendency_quantity",
    "pendencyQuantity",
    "pending_quantity",
  ],
  invoice: [
    "invoice_quantity",
    "invoiceQuantity",
    "grn_invoice_quantity",
    "invoiced_quantity",
  ],
  accepted: ["accepted_quantity", "acceptedQuantity", "grn_accepted_quantity"],
  rejected: ["rejected_quantity", "rejectedQuantity", "grn_rejected_quantity"],
  shortage: ["shortage_quantity", "shortageQuantity", "grn_shortage_quantity"],
};

function findAddedItemForSku(
  added: LineRow[],
  sku: string | null
): LineRow | null {
  if (!sku || sku === "—") return null;
  for (const a of added) {
    const id = a.sku_id ?? pickLine(a.raw, ADDED_ITEM_KEYS.sku);
    if (id === sku) return a;
  }
  return null;
}

/** Keys for `/purchase_orders/grn/items/withListing` raw rows — eAutomate payloads vary. */
const GRN_ITEM_KEYS = {
  sku: ADDED_ITEM_KEYS.sku,
  opsTag: ["ops_tag", "opsTag", "ops_tag_label"],
  availableQty: [
    "available_quantity",
    "availableQuantity",
    "avail_qty",
    "available_qty",
    "stock_quantity",
  ],
  totalDemand: [
    "total_demand",
    "totalDemand",
    "ordered_quantity",
    "required_quantity",
    "po_quantity",
    "poQuantity",
    "total_ordered_quantity",
  ],
  prevInvoiceQty: [
    "total_previous_invoice_quantity",
    "totalPreviousInvoiceQuantity",
    "invoice_quantity_prev_grns",
    "total_invoice_quantity_prev_grns",
    "prev_grn_invoice_quantity",
    "previous_grns_invoice_quantity",
    "invoice_quantity_previous_grns",
    "invoice_quantity_previous",
  ],
  prevAcceptedQty: [
    "total_previous_accepted_quantity",
    "totalPreviousAcceptedQuantity",
    "accepted_quantity_prev_grns",
    "prev_grn_accepted_quantity",
    "previous_grns_accepted_quantity",
    "accepted_quantity_previous_grns",
    "accepted_quantity_previous",
  ],
  prevRejectedQty: [
    "total_previous_rejected_quantity",
    "totalPreviousRejectedQuantity",
    "rejected_quantity_prev_grns",
    "prev_grn_rejected_quantity",
    "previous_grns_rejected_quantity",
  ],
  avgReceivedPricePrev: [
    "average_received_price_prev_grns",
    "averageReceivedPricePrevGrns",
    "average_received_price_previous",
    "averageReceivedPricePrev",
    "avg_received_price_prev",
    "average_recieved_price",
    "average_invoice_price_previous_grns",
  ],
  fillRatePrev: [
    "fill_rate_prev_grns",
    "fillRatePrevGrns",
    "fill_rate_previous",
    "percentage_fill_previous",
    "sku_fill_rate_prev",
    "quantity_fill_rate_prev_grns",
    "quantity_fill_previous",
  ],
  invoice: [
    ...ADDED_ITEM_KEYS.invoice,
    "current_grn_invoice_quantity",
    "currentGrnInvoiceQuantity",
    "current_invoice_quantity",
  ],
  accepted: [
    ...ADDED_ITEM_KEYS.accepted,
    "current_grn_accepted_quantity",
    "currentGrnAcceptedQuantity",
  ],
  rejected: [
    ...ADDED_ITEM_KEYS.rejected,
    "current_grn_rejected_quantity",
    "currentGrnRejectedQuantity",
  ],
  shortage: [
    ...ADDED_ITEM_KEYS.shortage,
    "current_grn_short_quantity",
    "currentGrnShortQuantity",
    "short_quantity",
    "shortage_qty",
  ],
  receivedPrice: [
    "received_price",
    "receivedPrice",
    "grn_received_price",
    "current_received_price",
  ],
  taxRate: [
    "tax_rate",
    "taxRate",
    "gst_rate",
    "gstRate",
    "current_grn_tax_rate",
    "gst_percentage",
  ],
  entryBy: [
    "entry_by",
    "entryBy",
    "grn_entry_by",
    "current_grn_entry_by",
    "entered_by",
  ],
  damageImagesCount: [
    "damage_images_count",
    "damageImagesCount",
    "damage_image_count",
    "no_of_damage_images",
  ],
  lineCreatedAt: ["created_at", "createdAt", "line_created_at"],
  auditPriceExclGst: [
    "audit_price",
    "auditPrice",
    "audit_price_excluding_gst",
    "auditPriceExclGst",
    "audit_price_exclusive_gst",
  ],
  auditedBy: ["audited_by", "auditedBy", "audit_by", "last_audit_by"],
  lastAuditedAt: [
    "last_audited_at",
    "lastAuditedAt",
    "audit_at",
    "auditAt",
    "audited_at",
  ],
};

type InboundSkuSummaryResponse = {
  sku_id: string;
  vendor_billing: Array<{
    vendor_id: number;
    vendor_name: string | null;
    total_qty_received: number;
    bill_count: number;
    min_price: number | null;
    max_price: number | null;
    latest_price: number | null;
  }>;
  closed_grn_summary: Array<{
    grn_id: number;
    vendor_name: string | null;
    invoice_number: string | null;
    grn_date: string | null;
    invoice_qty: number | null;
    accepted_qty: number | null;
    rejected_qty: number | null;
    received_price: number | null;
    audit_price: number | null;
  }>;
};

function parseLineQty(
  raw: JsonRecord | null | undefined,
  keys: string[]
): number {
  const s = pickLine(raw, keys);
  if (s === "—") return 0;
  const n = Number(String(s).replaceAll(",", ""));
  return Number.isFinite(n) ? n : 0;
}

function grnLineItemRowClass(line: LineRow): string {
  const rej = parseLineQty(line.raw, GRN_ITEM_KEYS.rejected);
  const short = parseLineQty(line.raw, GRN_ITEM_KEYS.shortage);
  if (rej > 0) {
    return "cursor-pointer bg-red-50/90 hover:bg-red-100/90 dark:bg-red-950/30 dark:hover:bg-red-950/45";
  }
  if (short > 0) {
    return "cursor-pointer bg-amber-50/90 hover:bg-amber-100/80 dark:bg-amber-950/25 dark:hover:bg-amber-950/35";
  }
  return "cursor-pointer hover:bg-muted/60";
}

function fmtInboundQty(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(n));
}

/** Draft row for Close GRN modal (same fields as GRN Section PATCH). */
type CloseGrnLineDraft = {
  inv: string;
  acc: string;
  rej: string;
  short: string;
  price: string;
  tax: string;
  audit: string;
};

function parseGrnLineNum(s: string, label: string): number {
  const t = s.trim();
  if (t === "") {
    throw new Error(`${label} is required`);
  }
  const n = Number(t.replaceAll(",", ""));
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${label} must be a non-negative number`);
  }
  return n;
}

function buildGrnLinePatchBody(d: CloseGrnLineDraft): Record<string, unknown> {
  const inv = parseGrnLineNum(d.inv, "Quantity in Invoice");
  const acc = parseGrnLineNum(d.acc, "Accepted Quantity");
  const rej = parseGrnLineNum(d.rej, "Rejected Quantity");
  const short = parseGrnLineNum(d.short, "Short Quantity");
  assertGrnLineQuantitiesAccountable({
    invoice_quantity: inv,
    accepted_quantity: acc,
    rejected_quantity: rej,
    shortage_quantity: short,
  });
  let auditPayload: number | null;
  if (d.audit.trim() === "") {
    auditPayload = null;
  } else {
    auditPayload = parseGrnLineNum(d.audit, "Audited Price (excl. Taxes)");
  }
  return {
    invoice_quantity: inv,
    accepted_quantity: acc,
    rejected_quantity: rej,
    shortage_quantity: short,
    received_price: parseGrnLineNum(d.price, "Product Price (excl. Taxes)"),
    tax_rate: parseGrnLineNum(d.tax, "Tax Rate"),
    audit_price: auditPayload,
  };
}

function closeModalDraftDiffers(line: LineRow, d: CloseGrnLineDraft): boolean {
  const r = line.raw ?? {};
  const taxN = parseLineQty(r, GRN_ITEM_KEYS.taxRate);
  const audN = parseLineQty(r, GRN_ITEM_KEYS.auditPriceExclGst);
  const taxStr = taxN > 0 ? String(taxN) : "";
  const audStr = audN > 0 ? String(audN) : "";
  return (
    d.inv.trim() !== String(parseLineQty(r, GRN_ITEM_KEYS.invoice)) ||
    d.acc.trim() !== String(parseLineQty(r, GRN_ITEM_KEYS.accepted)) ||
    d.rej.trim() !== String(parseLineQty(r, GRN_ITEM_KEYS.rejected)) ||
    d.short.trim() !== String(parseLineQty(r, GRN_ITEM_KEYS.shortage)) ||
    d.price.trim() !== String(parseLineQty(r, GRN_ITEM_KEYS.receivedPrice)) ||
    d.tax.trim() !== taxStr ||
    d.audit.trim() !== audStr
  );
}

function seedCloseGrnDraftsFromLines(items: LineRow[]): Record<number, CloseGrnLineDraft> {
  const out: Record<number, CloseGrnLineDraft> = {};
  for (const line of items) {
    const r = line.raw ?? {};
    const taxN = parseLineQty(r, GRN_ITEM_KEYS.taxRate);
    const audN = parseLineQty(r, GRN_ITEM_KEYS.auditPriceExclGst);
    out[line.line_index] = {
      inv: String(parseLineQty(r, GRN_ITEM_KEYS.invoice)),
      acc: String(parseLineQty(r, GRN_ITEM_KEYS.accepted)),
      rej: String(parseLineQty(r, GRN_ITEM_KEYS.rejected)),
      short: String(parseLineQty(r, GRN_ITEM_KEYS.shortage)),
      price: String(parseLineQty(r, GRN_ITEM_KEYS.receivedPrice)),
      tax: taxN > 0 ? String(taxN) : "",
      audit: audN > 0 ? String(audN) : "",
    };
  }
  return out;
}

function mergeGrnLineIntoBundle(
  b: GrnDetailsBundle,
  line: { line_index: number; sku_id: string | null; raw: JsonRecord }
): GrnDetailsBundle {
  return {
    ...b,
    grn_items: b.grn_items.map((li) =>
      li.line_index === line.line_index
        ? { ...li, raw: line.raw, sku_id: line.sku_id ?? li.sku_id }
        : li
    ),
  };
}

function listingFromLineRaw(raw: JsonRecord): JsonRecord | null {
  const l = raw.listing;
  if (l && typeof l === "object" && !Array.isArray(l)) return l as JsonRecord;
  return null;
}

function listingThumbUrls(listing: JsonRecord | null): string[] {
  if (!listing) return [];
  const keys = ["img_hd", "img_white", "img_wdim", "img_link1", "img_link2"];
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const k of keys) {
    const u = listing[k];
    if (typeof u === "string" && /^https?:\/\//i.test(u) && !seen.has(u)) {
      seen.add(u);
      urls.push(u);
    }
  }
  return urls;
}

/** Single GRN line quantity/price control with label (editable). */
function GrnInputEditableBox({
  label,
  value,
  onChange,
  disabled,
  className,
  inputClassName,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div
      className={cn(
        "flex min-h-[52px] min-w-[96px] flex-1 flex-col justify-center gap-1 rounded-md border-2 border-foreground/15 bg-background px-2 py-1.5 shadow-sm",
        className
      )}
    >
      <span className="text-[10px] leading-tight font-medium text-muted-foreground">
        {label}
      </span>
      <Input
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          "h-8 font-mono text-sm tabular-nums font-semibold",
          inputClassName
        )}
      />
    </div>
  );
}

const DEMAND_KEYS = [
  "required_quantity",
  "requiredQuantity",
  ...ADDED_ITEM_KEYS.ordered,
];

function GrnSkuDetailSheet(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grnId: string;
  grn_items: LineRow[];
  added_items: LineRow[];
  selectedLine: LineRow | null;
  onSelectLine: (line: LineRow) => void;
  grnTitle: string;
  onLineUpdated: (line: { line_index: number; sku_id: string | null; raw: JsonRecord }) => void;
}) {
  const {
    open,
    onOpenChange,
    grnId,
    grn_items,
    added_items,
    selectedLine,
    onSelectLine,
    grnTitle,
    onLineUpdated,
  } = props;

  const sku =
    selectedLine?.sku_id ??
    (selectedLine ? pickLine(selectedLine.raw, GRN_ITEM_KEYS.sku) : "");

  const added = sku ? findAddedItemForSku(added_items, sku) : null;

  const [summaryLoading, setSummaryLoading] = React.useState(false);
  const [summary, setSummary] = React.useState<InboundSkuSummaryResponse | null>(
    null
  );

  React.useEffect(() => {
    if (!open || !sku || sku === "—") {
      setSummary(null);
      setSummaryLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setSummaryLoading(true);
      setSummary(null);
      try {
        const data = await apiFetch<InboundSkuSummaryResponse>(
          `/api/inbound/skus/${encodeURIComponent(sku)}/inbound-summary`
        );
        if (!cancelled) setSummary(data);
      } catch (e) {
        if (!cancelled) {
          toast.error(
            e instanceof Error ? e.message : "Could not load SKU inbound summary"
          );
        }
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, sku]);

  const [draftInv, setDraftInv] = React.useState("");
  const [draftAcc, setDraftAcc] = React.useState("");
  const [draftRej, setDraftRej] = React.useState("");
  const [draftShort, setDraftShort] = React.useState("");
  const [draftPrice, setDraftPrice] = React.useState("");
  const [draftTax, setDraftTax] = React.useState("");
  const [draftAudit, setDraftAudit] = React.useState("");
  const [savingGrnInput, setSavingGrnInput] = React.useState(false);
  const draftSnapshotRef = React.useRef("");

  React.useEffect(() => {
    if (!selectedLine?.raw) {
      setDraftInv("");
      setDraftAcc("");
      setDraftRej("");
      setDraftShort("");
      setDraftPrice("");
      setDraftTax("");
      setDraftAudit("");
      draftSnapshotRef.current = "";
      return;
    }
    const r = selectedLine.raw;
    const taxN = parseLineQty(r, GRN_ITEM_KEYS.taxRate);
    const audN = parseLineQty(r, GRN_ITEM_KEYS.auditPriceExclGst);
    const ds = {
      inv: String(parseLineQty(r, GRN_ITEM_KEYS.invoice)),
      acc: String(parseLineQty(r, GRN_ITEM_KEYS.accepted)),
      rej: String(parseLineQty(r, GRN_ITEM_KEYS.rejected)),
      short: String(parseLineQty(r, GRN_ITEM_KEYS.shortage)),
      price: String(parseLineQty(r, GRN_ITEM_KEYS.receivedPrice)),
      tax: taxN > 0 ? String(taxN) : "",
      audit: audN > 0 ? String(audN) : "",
    };
    setDraftInv(ds.inv);
    setDraftAcc(ds.acc);
    setDraftRej(ds.rej);
    setDraftShort(ds.short);
    setDraftPrice(ds.price);
    setDraftTax(ds.tax);
    setDraftAudit(ds.audit);
    draftSnapshotRef.current = JSON.stringify(ds);
  }, [selectedLine?.line_index, selectedLine?.raw]);

  const grnInputDirty =
    draftSnapshotRef.current !== "" &&
    JSON.stringify({
      inv: draftInv.trim(),
      acc: draftAcc.trim(),
      rej: draftRej.trim(),
      short: draftShort.trim(),
      price: draftPrice.trim(),
      tax: draftTax.trim(),
      audit: draftAudit.trim(),
    }) !== draftSnapshotRef.current;

  async function saveGrnLineInput() {
    if (!selectedLine || !grnId.trim()) return;
    const parseNum = (s: string, label: string) => {
      const t = s.trim();
      if (t === "") {
        throw new Error(`${label} is required`);
      }
      const n = Number(t.replaceAll(",", ""));
      if (!Number.isFinite(n) || n < 0) {
        throw new Error(`${label} must be a non-negative number`);
      }
      return n;
    };
    let auditPayload: number | null;
    if (draftAudit.trim() === "") {
      auditPayload = null;
    } else {
      auditPayload = parseNum(draftAudit, "Audited Price (excl. Taxes)");
    }
    try {
      setSavingGrnInput(true);
      const invoice_quantity = parseNum(draftInv, "Quantity in Invoice");
      const accepted_quantity = parseNum(draftAcc, "Accepted Quantity");
      const rejected_quantity = parseNum(draftRej, "Rejected Quantity");
      const shortage_quantity = parseNum(draftShort, "Short Quantity");
      assertGrnLineQuantitiesAccountable({
        invoice_quantity,
        accepted_quantity,
        rejected_quantity,
        shortage_quantity,
      });
      const payload = {
        invoice_quantity,
        accepted_quantity,
        rejected_quantity,
        shortage_quantity,
        received_price: parseNum(draftPrice, "Product Price (excl. Taxes)"),
        tax_rate: parseNum(draftTax, "Tax Rate"),
        audit_price: auditPayload,
      };
      const res = await apiFetch<{
        line_index: number;
        sku_id: string | null;
        raw: JsonRecord;
      }>(
        `/api/inbound/grns/${encodeURIComponent(grnId)}/items/${selectedLine.line_index}`,
        { method: "PATCH", body: JSON.stringify(payload) }
      );
      toast.success("GRN line saved");
      onLineUpdated(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingGrnInput(false);
    }
  }

  const raw = selectedLine?.raw ?? null;
  const listing = raw ? listingFromLineRaw(raw) : null;
  const thumbs = listingThumbUrls(listing);
  const title =
    listing && pickLine(listing, ADDED_ITEM_KEYS.title) !== "—"
      ? pickLine(listing, ADDED_ITEM_KEYS.title)
      : "—";

  const totalDemand = added ? parseLineQty(added.raw, DEMAND_KEYS) : 0;
  const pendency = added ? parseLineQty(added.raw, ADDED_ITEM_KEYS.pendency) : 0;

  let fillPct: number | null = null;
  if (added && totalDemand > 0) {
    const accPo = parseLineQty(added.raw, ADDED_ITEM_KEYS.accepted);
    fillPct = (accPo / totalDemand) * 100;
  }

  const whQty = listing ? parseLineQty(listing, GRN_ITEM_KEYS.availableQty) : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton
        className={cn(
          "flex w-full flex-col gap-0 overflow-hidden p-0",
          /* Sheet base uses data-[side=right]:sm:max-w-sm; plain sm:max-w-* loses the cascade — override explicitly */
          "data-[side=right]:max-w-none data-[side=right]:sm:max-w-[min(96vw,1240px)] data-[side=right]:lg:max-w-[min(94vw,1400px)]"
        )}
      >
        <SheetHeader className="border-b bg-muted/20 px-4 py-3">
          <SheetTitle className="text-base">GRN Section</SheetTitle>
          <SheetDescription className="text-xs">
            {grnTitle}
            {sku ? (
              <>
                {" "}
                · SKU <span className="font-mono font-medium">{sku}</span>
              </>
            ) : null}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-row">
          <nav
            className="w-44 shrink-0 overflow-y-auto border-r bg-muted/25 p-2"
            aria-label="GRN line SKUs"
          >
            <p className="text-muted-foreground mb-2 px-1 text-[10px] font-semibold uppercase tracking-wide">
              Line SKUs
            </p>
            {grn_items.map((line) => {
              const sid = line.sku_id ?? pickLine(line.raw, GRN_ITEM_KEYS.sku);
              const active = selectedLine?.line_index === line.line_index;
              return (
                <button
                  key={line.line_index}
                  type="button"
                  onClick={() => onSelectLine(line)}
                  className={cn(
                    "mb-1 w-full rounded-md px-2 py-1.5 text-left font-mono text-[11px] transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  <span className="text-muted-foreground">{line.line_index + 1}. </span>
                  <span className="break-all">{sid || "—"}</span>
                </button>
              );
            })}
          </nav>

          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
            {!selectedLine ? (
              <p className="text-muted-foreground text-sm">Select a line item.</p>
            ) : (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
                <div className="order-2 flex flex-col gap-4 lg:order-1">
                  <section className="space-y-2">
                    <div className="bg-sky-100/80 px-2 py-1.5 font-semibold text-sky-950 text-xs uppercase tracking-wide dark:bg-sky-950/50 dark:text-sky-100">
                      Vendor billing summary
                    </div>
                    <p className="text-muted-foreground text-[11px] italic">
                      *Billing summary is only available when the GRN and GRN audit are closed for
                      this SKU (rollups from closed receipts in this workspace).
                    </p>
                    {summaryLoading ? (
                      <Skeleton className="h-24 w-full" />
                    ) : summary && summary.vendor_billing.length > 0 ? (
                      <div className="overflow-x-auto rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow className="whitespace-nowrap">
                              <TableHead className="w-10">Sr.</TableHead>
                              <TableHead>Vendor ID</TableHead>
                              <TableHead>Vendor Name</TableHead>
                              <TableHead className="text-right">
                                Total quantity received
                              </TableHead>
                              <TableHead className="text-right">Number of bills</TableHead>
                              <TableHead className="text-right">
                                Minimum price from vendor (Rs. excl. GST)
                              </TableHead>
                              <TableHead className="text-right">
                                Maximum price from vendor (Rs. excl. GST)
                              </TableHead>
                              <TableHead className="text-right">
                                Latest price from vendor (Rs. excl. GST)
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {summary.vendor_billing.map((vb, idx) => (
                              <TableRow key={vb.vendor_id}>
                                <TableCell className="text-muted-foreground text-xs">
                                  {idx + 1}
                                </TableCell>
                                <TableCell className="font-mono text-xs">{vb.vendor_id}</TableCell>
                                <TableCell className="text-xs">{vb.vendor_name ?? "—"}</TableCell>
                                <TableCell className="text-right text-xs tabular-nums">
                                  {fmtInboundQty(vb.total_qty_received)}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums">
                                  {vb.bill_count}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums">
                                  {fmtInboundQty(vb.min_price)}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums">
                                  {fmtInboundQty(vb.max_price)}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums">
                                  {fmtInboundQty(vb.latest_price)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">No billing rows for this SKU.</p>
                    )}
                  </section>

                  <section className="space-y-2">
                    <div className="bg-sky-100/80 px-2 py-1.5 font-semibold text-sky-950 text-xs uppercase tracking-wide dark:bg-sky-950/50 dark:text-sky-100">
                      Closed GRN summary
                    </div>
                    <p className="text-muted-foreground text-[11px] italic">
                      *Only the most recent 30 GRNs with closed audit and CLOSED GRN status — ordered
                      by GRN date (newest first).
                    </p>
                    {summaryLoading ? (
                      <Skeleton className="h-28 w-full" />
                    ) : summary && summary.closed_grn_summary.length > 0 ? (
                      <div className="max-h-[min(40vh,320px)] overflow-auto rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow className="whitespace-nowrap">
                              <TableHead>Vendor Name</TableHead>
                              <TableHead>Invoice Number</TableHead>
                              <TableHead>GRN Date</TableHead>
                              <TableHead className="text-right">Invoice Quantity</TableHead>
                              <TableHead className="text-right">Accepted Quantity</TableHead>
                              <TableHead className="text-right">Rejected Quantity</TableHead>
                              <TableHead className="text-right">
                                Received price (Rs. excl GST)
                              </TableHead>
                              <TableHead className="text-right">
                                Audited price (Rs. excl GST)
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {summary.closed_grn_summary.map((r) => (
                              <TableRow key={`${r.grn_id}-${r.invoice_number ?? ""}-${r.grn_date}`}>
                                <TableCell className="max-w-[140px] truncate text-xs">
                                  {r.vendor_name ?? "—"}
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                  {r.invoice_number ?? "—"}
                                </TableCell>
                                <TableCell className="text-xs whitespace-nowrap">
                                  {r.grn_date ? formatDisplayDateOnly(r.grn_date) : "—"}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums">
                                  {fmtInboundQty(r.invoice_qty)}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums">
                                  {fmtInboundQty(r.accepted_qty)}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums">
                                  {fmtInboundQty(r.rejected_qty)}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums">
                                  {fmtInboundQty(r.received_price)}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums">
                                  {fmtInboundQty(r.audit_price)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        No closed GRN rows for this SKU yet.
                      </p>
                    )}
                  </section>
                </div>

                <div className="order-1 flex flex-col gap-4 lg:order-2">
                  <section className="space-y-3">
                    <div className="bg-sky-100/80 px-2 py-1.5 font-semibold text-sky-950 text-xs uppercase tracking-wide dark:bg-sky-950/50 dark:text-sky-100">
                      Details
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <div className="flex gap-2">
                        <div className="flex shrink-0 flex-col gap-1">
                          {thumbs.slice(0, 5).map((url, thumbIdx) => (
                            <img
                              key={`${thumbIdx}-${url}`}
                              src={url}
                              alt=""
                              className="border-border h-14 w-14 rounded border bg-muted object-contain"
                            />
                          ))}
                        </div>
                        {thumbs[0] ? (
                          <img
                            src={thumbs[0]}
                            alt=""
                            className="border-border h-44 max-w-[200px] flex-1 rounded-md border bg-muted object-contain"
                          />
                        ) : null}
                      </div>
                      <dl className="grid flex-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                        <div>
                          <dt className="text-muted-foreground text-xs">SKU Id</dt>
                          <dd className="font-mono text-sm">{sku || "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground text-xs">Title</dt>
                          <dd className="text-sm">{title}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground text-xs">Ops Tag</dt>
                          <dd className="text-sm">
                            {listing
                              ? pickLine(listing, GRN_ITEM_KEYS.opsTag)
                              : pickLine(raw, GRN_ITEM_KEYS.opsTag)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground text-xs">Warehouse Quantity</dt>
                          <dd className="text-sm">{fmtInboundQty(whQty)}</dd>
                        </div>
                      </dl>
                    </div>
                  </section>

                  <section className="space-y-2">
                    <div className="text-muted-foreground text-[11px]">
                      Quantity summary for this SKU on the PO line.
                    </div>
                    <div className="bg-muted/40 grid grid-cols-2 gap-2 rounded-md border p-2 sm:grid-cols-2">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Total Original Demand:</span>{" "}
                        <span className="font-mono font-semibold text-violet-700 dark:text-violet-300">
                          {fmtInboundQty(totalDemand)}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Total Accepted Quantity:</span>{" "}
                        <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                          {added
                            ? fmtInboundQty(parseLineQty(added.raw, ADDED_ITEM_KEYS.accepted))
                            : "—"}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Total Rejected Quantity:</span>{" "}
                        <span className="font-mono font-semibold text-red-600">
                          {added
                            ? fmtInboundQty(parseLineQty(added.raw, ADDED_ITEM_KEYS.rejected))
                            : "—"}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Total Pending Quantity:</span>{" "}
                        <span className="font-mono font-semibold">{fmtInboundQty(pendency)}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Total Invoice Quantity:</span>{" "}
                        <span className="font-mono font-semibold text-violet-700 dark:text-violet-300">
                          {added
                            ? fmtInboundQty(parseLineQty(added.raw, ADDED_ITEM_KEYS.invoice))
                            : "—"}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Fill Rate %:</span>{" "}
                        <span className="font-mono font-semibold tabular-nums">
                          {fillPct != null && Number.isFinite(fillPct)
                            ? `${fillPct.toFixed(2)}`
                            : "—"}
                        </span>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-2">
                    <div className="bg-sky-100/80 px-2 py-1.5 text-center font-semibold text-sky-950 text-xs uppercase tracking-wide dark:bg-sky-950/50 dark:text-sky-100">
                      GRN input
                    </div>
                    <p className="text-muted-foreground text-[11px] leading-snug">
                      Quantity in Invoice must equal Accepted + Rejected + Short (same rule applies when
                      saving, closing the GRN, and on the server).
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <GrnInputEditableBox
                        label="Quantity in Invoice"
                        value={draftInv}
                        onChange={setDraftInv}
                        disabled={savingGrnInput}
                        inputClassName="text-violet-700 dark:text-violet-300"
                        inputMode="decimal"
                      />
                      <GrnInputEditableBox
                        label="Accepted Quantity"
                        value={draftAcc}
                        onChange={setDraftAcc}
                        disabled={savingGrnInput}
                        inputClassName="text-emerald-700 dark:text-emerald-400"
                        inputMode="decimal"
                      />
                      <GrnInputEditableBox
                        label="Rejected Quantity"
                        value={draftRej}
                        onChange={setDraftRej}
                        disabled={savingGrnInput}
                        inputClassName="text-red-600"
                        inputMode="decimal"
                      />
                      <GrnInputEditableBox
                        label="Short Quantity"
                        value={draftShort}
                        onChange={setDraftShort}
                        disabled={savingGrnInput}
                        className="border-blue-300/80"
                        inputClassName="text-blue-700 dark:text-blue-300"
                        inputMode="decimal"
                      />
                      <GrnInputEditableBox
                        label="Product Price (excl. Taxes)"
                        value={draftPrice}
                        onChange={setDraftPrice}
                        disabled={savingGrnInput}
                        inputMode="decimal"
                      />
                      <GrnInputEditableBox
                        label="Tax Rate"
                        value={draftTax}
                        onChange={setDraftTax}
                        disabled={savingGrnInput}
                        inputMode="decimal"
                      />
                      <GrnInputEditableBox
                        label="Audited Price (excl. Taxes)"
                        value={draftAudit}
                        onChange={setDraftAudit}
                        disabled={savingGrnInput}
                        className="border-amber-300/70 bg-amber-50 dark:bg-amber-950/30"
                        inputClassName="text-amber-950 dark:text-amber-100"
                        inputMode="decimal"
                      />
                    </div>
                    <div className="flex justify-end pt-1">
                      <Button
                        type="button"
                        size="sm"
                        disabled={savingGrnInput || !grnInputDirty}
                        onClick={() => void saveGrnLineInput()}
                      >
                        {savingGrnInput ? "Saving…" : "Save line"}
                      </Button>
                    </div>
                  </section>
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function InboundGrnDetailPage() {
  const params = useParams();
  const router = useRouter();
  const grnId = typeof params.grnId === "string" ? params.grnId : "";
  const [bundle, setBundle] = React.useState<GrnDetailsBundle | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [workflowOpen, setWorkflowOpen] = React.useState(false);
  const [workflowChartMounted, setWorkflowChartMounted] = React.useState(false);
  const dcUploadRef = React.useRef<HTMLInputElement>(null);
  const [dcUploading, setDcUploading] = React.useState(false);

  React.useEffect(() => {
    if (!grnId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await apiFetch<GrnDetailsBundle>(
          `/api/inbound/grns/${grnId}/details`
        );
        if (!cancelled) setBundle(data);
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Failed to load GRN");
          setBundle(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [grnId]);

  /** Single source of truth for re-fetching the GRN bundle. Every mutation
   * (line save, file upload, status change, DN action, etc.) calls this so
   * dependent components — header, line items, logs, debit-note panels, file
   * lists — refresh together without a manual page reload. */
  const reloadBundle = React.useCallback(async (): Promise<GrnDetailsBundle | null> => {
    if (!grnId) return null;
    try {
      const refreshed = await apiFetch<GrnDetailsBundle>(
        `/api/inbound/grns/${encodeURIComponent(grnId)}/details`
      );
      setBundle(refreshed);
      return refreshed;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refresh failed");
      return null;
    }
  }, [grnId]);

  const row = bundle?.header ?? null;
  const snap = bundle?.snapshot ?? null;

  const [grnSkuSheetOpen, setGrnSkuSheetOpen] = React.useState(false);
  const [grnSkuSelectedLine, setGrnSkuSelectedLine] =
    React.useState<LineRow | null>(null);

  // Audit & debit note tab state
  const [auditLines, setAuditLines] = React.useState<AuditLine[] | null>(null);
  const [auditLoading, setAuditLoading] = React.useState(false);
  const [debitNote, setDebitNote] = React.useState<ZapDebitNote | null>(null);
  const [debitNoteLoading, setDebitNoteLoading] = React.useState(false);
  const [generatingNote, setGeneratingNote] = React.useState(false);
  const [dnNumberInput, setDnNumberInput] = React.useState("");
  const [assigningDnNumber, setAssigningDnNumber] = React.useState(false);
  const cnCopyRef = React.useRef<HTMLInputElement>(null);
  const [uploadingCnCopy, setUploadingCnCopy] = React.useState(false);
  const [exportingTally, setExportingTally] = React.useState(false);

  function loadAuditPreview(grnId: number) {
    if (auditLoading) return;
    setAuditLoading(true);
    apiFetch<{ lines: AuditLine[] }>(`/api/inbound/grns/${grnId}/debit-note?preview=1`)
      .then((d) => setAuditLines(d.lines ?? []))
      .catch(() => toast.error("Failed to load audit price preview"))
      .finally(() => setAuditLoading(false));
  }

  function loadDebitNote(grnId: number) {
    setDebitNoteLoading(true);
    return apiFetch<ZapDebitNote>(`/api/inbound/grns/${grnId}/debit-note`)
      .then((note) => {
        setDebitNote(note);
        return note;
      })
      .catch(() => {
        setDebitNote(null);
        return null;
      })
      .finally(() => setDebitNoteLoading(false));
  }

  /** Refresh debit note from server without full-tab loading skeleton (e.g. after POST generate). */
  function refreshDebitNoteQuiet(grnId: number) {
    void apiFetch<ZapDebitNote>(`/api/inbound/grns/${grnId}/debit-note`)
      .then((n) => setDebitNote(n))
      .catch(() => {});
  }

  function handleGenerateDebitNote(grnId: number) {
    setGeneratingNote(true);
    apiFetch<ZapDebitNote>(`/api/inbound/grns/${grnId}/debit-note`, { method: "POST" })
      .then(async (note) => {
        setDebitNote(note);
        toast.success(
          `Debit note ${note.note_reference}: ${note.lines.length} line(s), total ₹${Number(note.total_debit_amount).toFixed(2)}`
        );
        refreshDebitNoteQuiet(grnId);
        await reloadBundle();
      })
      .catch(async (e: unknown) => {
        const msg = e instanceof Error ? e.message : "Failed to generate debit note";
        if (msg.includes("Cannot regenerate debit note while status is")) {
          const confirmed = globalThis.confirm(
            "This debit note is already progressed (ISSUED/CLOSED). Force regenerate and overwrite draft lines?"
          );
          if (confirmed) {
            const forced = await apiFetch<ZapDebitNote>(
              `/api/inbound/grns/${grnId}/debit-note`,
              {
                method: "POST",
                body: JSON.stringify({ force_regenerate: true }),
              }
            );
            setDebitNote(forced);
            toast.success(
              `Debit note ${forced.note_reference}: ${forced.lines.length} line(s), total ₹${Number(forced.total_debit_amount).toFixed(2)}`
            );
            refreshDebitNoteQuiet(grnId);
            await reloadBundle();
            return;
          }
        }
        toast.error(msg);
      })
      .finally(() => setGeneratingNote(false));
  }

  function handleAssignDnNumber(grnId: number) {
    if (!dnNumberInput.trim()) { toast.error("Enter a DN number"); return; }
    setAssigningDnNumber(true);
    apiFetch<ZapDebitNote>(`/api/inbound/grns/${grnId}/debit-note`, {
      method: "PATCH",
      body: JSON.stringify({ dn_number: dnNumberInput.trim() }),
    })
      .then(async (note) => {
        setDebitNote(note);
        toast.success("DN number assigned");
        await reloadBundle();
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to assign DN number"))
      .finally(() => setAssigningDnNumber(false));
  }

  async function handleDownloadCnCopy(grnId: number) {
    try {
      const meta = await apiFetch<{ url: string; filename?: string | null }>(
        `/api/inbound/grns/${grnId}/debit-note/cn-copy`
      );
      const fname = meta.filename?.trim() || "cn-copy";
      let blob: Blob | null = null;

      try {
        const signedRes = await fetch(meta.url, { mode: "cors" });
        if (signedRes.ok) {
          blob = await signedRes.blob();
        }
      } catch {
        blob = null;
      }

      if (!blob) {
        const token = getStoredToken();
        if (!token) {
          toast.error("Sign in to download");
          return;
        }
        const res = await fetch(
          apiUrl(`/api/inbound/grns/${grnId}/debit-note/cn-copy/file`),
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? res.statusText);
        }
        blob = await res.blob();
      }

      blob = withExplicitCnMime(blob, fname);

      const objectUrl = URL.createObjectURL(blob);
      const preview = window.open(objectUrl, "_blank", "noopener,noreferrer");
      if (!preview) {
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = fname;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast.success("Download started");
      }
      setTimeout(() => URL.revokeObjectURL(objectUrl), 900_000);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  }

  function handleUploadCnCopy(grnId: number) {
    const file = cnCopyRef.current?.files?.[0];
    if (!file) { toast.error("Select a file first"); return; }
    setUploadingCnCopy(true);
    const fd = new FormData();
    fd.append("file", file);
    apiFetch<ZapDebitNote>(`/api/inbound/grns/${grnId}/debit-note/cn-copy`, { method: "POST", body: fd })
      .then(async (note) => {
        setDebitNote(note);
        toast.success("CN copy uploaded");
        if (cnCopyRef.current) cnCopyRef.current.value = "";
        await reloadBundle();
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Upload failed"))
      .finally(() => setUploadingCnCopy(false));
  }

  async function handleExportTally(grnId: number) {
    const token = getStoredToken();
    if (!token) {
      toast.error("Sign in to export");
      return;
    }
    setExportingTally(true);
    try {
      const res = await fetch(
        apiUrl(`/api/inbound/grns/${grnId}/debit-note/export`),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? res.statusText);
      }
      const cd = res.headers.get("Content-Disposition");
      const fname =
        filenameFromContentDisposition(cd) ?? `tally-grn-${grnId}.csv`;
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = fname;
      a.click();
      URL.revokeObjectURL(objUrl);

      toast.success("Tally CSV downloaded");
      try {
        const note = await apiFetch<ZapDebitNote>(
          `/api/inbound/grns/${grnId}/debit-note/export`,
          { method: "POST" }
        );
        setDebitNote(note);
        await reloadBundle();
      } catch (e: unknown) {
        toast.error(
          e instanceof Error
            ? e.message
            : "File downloaded but marking export failed — retry or contact support"
        );
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExportingTally(false);
    }
  }

  function openGrnSkuSheet(line: LineRow) {
    setGrnSkuSelectedLine(line);
    setGrnSkuSheetOpen(true);
  }

  // Close GRN modal (upload + line review)
  const [closeGrnModalOpen, setCloseGrnModalOpen] = React.useState(false);
  const [closeGrnDrafts, setCloseGrnDrafts] = React.useState<
    Record<number, CloseGrnLineDraft>
  >({});
  const [closeGrnFiles, setCloseGrnFiles] = React.useState<File[]>([]);
  const [closeGrnBusy, setCloseGrnBusy] = React.useState(false);
  const closeGrnFileInputRef = React.useRef<HTMLInputElement>(null);

  function openCloseGrnModal() {
    if (!bundle) return;
    setCloseGrnDrafts(seedCloseGrnDraftsFromLines(bundle.grn_items));
    setCloseGrnFiles([]);
    if (closeGrnFileInputRef.current) closeGrnFileInputRef.current.value = "";
    setCloseGrnModalOpen(true);
  }

  function handleCloseGrnFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCloseGrnFiles(
      filterVendorInvoiceFilesPicked(Array.from(e.target.files ?? []))
    );
  }

  const documentsInvoiceFileInputRef = React.useRef<HTMLInputElement>(null);
  const [invoiceDocumentsUploading, setInvoiceDocumentsUploading] =
    React.useState(false);

  async function uploadVendorInvoiceFilesFromDocuments(files: File[]) {
    if (!row || row.grn_id < 1) return;
    const gid = row.grn_id;
    setInvoiceDocumentsUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("kind", "invoice");
        await apiFetch<unknown>(`/api/inbound/grns/${gid}/upload-zap`, {
          method: "POST",
          body: fd,
        });
      }
      await reloadBundle();
      toast.success(
        files.length === 1 ? "Invoice uploaded" : "Invoices uploaded"
      );
      if (documentsInvoiceFileInputRef.current)
        documentsInvoiceFileInputRef.current.value = "";
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setInvoiceDocumentsUploading(false);
    }
  }

  async function handleConfirmCloseGrn() {
    if (!bundle || !row) return;
    const gid = row.grn_id;
    if (
      !hasVendorInvoiceReadyToClose({
        existingInvoiceFilesCount: bundle.invoice_files.length,
        stagedInvoiceFilesCount: closeGrnFiles.length,
      })
    ) {
      toast.error("Upload the vendor invoice before closing.");
      return;
    }
    setCloseGrnBusy(true);
    try {
      for (const line of bundle.grn_items) {
        const d = closeGrnDrafts[line.line_index];
        if (!d) continue;
        assertGrnLineQuantitiesAccountable({
          invoice_quantity: parseGrnLineNum(d.inv, "Quantity in Invoice"),
          accepted_quantity: parseGrnLineNum(d.acc, "Accepted Quantity"),
          rejected_quantity: parseGrnLineNum(d.rej, "Rejected Quantity"),
          shortage_quantity: parseGrnLineNum(d.short, "Short Quantity"),
        });
      }

      for (const file of closeGrnFiles) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("kind", "invoice");
        await apiFetch<unknown>(`/api/inbound/grns/${gid}/upload-zap`, {
          method: "POST",
          body: fd,
        });
      }

      let b: GrnDetailsBundle = bundle;
      for (const line of bundle.grn_items) {
        const d = closeGrnDrafts[line.line_index];
        if (!d || !closeModalDraftDiffers(line, d)) continue;
        const payload = buildGrnLinePatchBody(d);
        const res = await apiFetch<{
          line_index: number;
          sku_id: string | null;
          raw: JsonRecord;
        }>(`/api/inbound/grns/${gid}/items/${line.line_index}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        b = mergeGrnLineIntoBundle(b, res);
      }
      setBundle(b);

      await apiFetch<GrnHeader>(`/api/inbound/grns/${gid}/close`, { method: "POST" });

      await reloadBundle();
      toast.success("GRN closed");
      setCloseGrnModalOpen(false);
      setCloseGrnFiles([]);
      if (closeGrnFileInputRef.current) closeGrnFileInputRef.current.value = "";
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to complete close workflow";
      toast.error(msg);
    } finally {
      setCloseGrnBusy(false);
    }
  }

  const [operationalGrnInput, setOperationalGrnInput] = React.useState("");
  const [registeringOperationalId, setRegisteringOperationalId] =
    React.useState(false);

  function handleRegisterOperational(draftId: number) {
    const n = Number.parseInt(String(operationalGrnInput).trim(), 10);
    if (!Number.isFinite(n) || n < 1) {
      toast.error("Enter a positive operational GRN number");
      return;
    }
    if (
      !globalThis.confirm(
        `Register this draft as GRN #${n}? The current id (${draftId}) will be replaced sitewide with this number.`
      )
    ) {
      return;
    }
    setRegisteringOperationalId(true);
    apiFetch<GrnHeader>(`/api/inbound/grns/${draftId}/register-operational`, {
      method: "POST",
      body: JSON.stringify({ operational_grn_id: n }),
    })
      .then((header) => {
        toast.success("GRN registered");
        router.replace(`/inbound/grns/${header.grn_id}`);
      })
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : "Registration failed")
      )
      .finally(() => setRegisteringOperationalId(false));
  }

  function handleOpenDraft(draftId: number) {
    setRegisteringOperationalId(true);
    apiFetch<GrnHeader>(`/api/inbound/grns/${draftId}/open-draft`, {
      method: "POST",
    })
      .then(async (header) => {
        toast.success(`GRN opened (status: ${header.grn_status ?? "OPEN"})`);
        await reloadBundle();
      })
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : "Open failed")
      )
      .finally(() => setRegisteringOperationalId(false));
  }

  // Accounts + Inventory receipt tab state
  const [accountsSubmitting, setAccountsSubmitting] = React.useState(false);
  const [receiptItems, setReceiptItems] = React.useState<ReceiptLineItem[]>([]);
  const [receiptSubmitting, setReceiptSubmitting] = React.useState(false);
  const [receiptDone, setReceiptDone] = React.useState<{ sku_id: string; bin_id: string; new_quantity: number }[] | null>(null);
  const [binsBySku, setBinsBySku] = React.useState<Record<string, BinOptionRow[]>>({});
  const [binsLoading, setBinsLoading] = React.useState(false);

  const receiptSkuKey = React.useMemo(
    () =>
      [...new Set(receiptItems.map((i) => i.sku_id))]
        .sort((a, b) => a.localeCompare(b))
        .join(","),
    [receiptItems]
  );

  React.useEffect(() => {
    if (!receiptSkuKey) return;
    const skus = receiptSkuKey.split(",").filter(Boolean);
    let cancelled = false;
    setBinsLoading(true);
    Promise.all(
      skus.map((sku) =>
        apiFetch<{ data: BinOptionRow[] }>(
          `/api/bins?${new URLSearchParams({ sku_id: sku, page: "1", limit: "500" })}`
        )
          .then((r) => [sku, r.data ?? []] as const)
          .catch(() => [sku, []] as const)
      )
    )
      .then((entries) => {
        if (cancelled) return;
        setBinsBySku(Object.fromEntries(entries));
      })
      .finally(() => {
        if (!cancelled) setBinsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [receiptSkuKey]);

  function initReceiptItems(grnItems: LineRow[]) {
    if (receiptItems.length > 0) return;
    const items = grnItems
      .map((line) => {
        const raw = line.raw ?? {};
        const skuId = line.sku_id ?? String(raw.sku_id ?? raw.skuId ?? "");
        const desc = String(raw.title ?? raw.name ?? raw.description ?? raw.sku_name ?? "");
        const qty = Number(raw.accepted_quantity ?? raw.acceptedQuantity ?? raw.current_grn_accepted_quantity ?? 0);
        return {
          row_key: `line-${line.line_index}-0`,
          line_index: line.line_index,
          sku_id: skuId,
          sku_description: desc,
          accepted_qty: qty,
          bin_id: "",
          quantity: String(qty),
          bin_entry_mode: "dropdown" as const,
        };
      })
      .filter((i) => i.sku_id);
    setReceiptItems(items);
  }

  function addSplitRowForLine(line_index: number) {
    setReceiptItems((prev) => {
      const template = prev.find((i) => i.line_index === line_index);
      if (!template) return prev;
      const totalBooked = sumBookedLineTotal(prev, line_index);
      const rem = Math.max(0, template.accepted_qty - totalBooked);
      if (rem <= 0) return prev;
      const splitKey = `line-${line_index}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      return [
        ...prev,
        {
          row_key: splitKey,
          line_index,
          sku_id: template.sku_id,
          sku_description: template.sku_description,
          accepted_qty: template.accepted_qty,
          bin_id: "",
          quantity: String(rem),
          bin_entry_mode: "dropdown" as const,
        },
      ];
    });
  }

  function removeSplitRow(rowKey: string) {
    setReceiptItems((prev) => {
      const idx = prev.findIndex((r) => r.row_key === rowKey);
      if (idx <= 0) return prev;
      const row = prev[idx];
      const firstIdx = prev.findIndex((r) => r.line_index === row.line_index);
      if (firstIdx < 0 || firstIdx === idx) return prev;
      const qtyToReturn = Number(row.quantity) || 0;
      const next = [...prev];
      next.splice(idx, 1);
      const firstRowIdx = next.findIndex((r) => r.row_key === prev[firstIdx].row_key);
      if (firstRowIdx >= 0 && qtyToReturn > 0) {
        const first = next[firstRowIdx];
        const merged = Math.min(first.accepted_qty, (Number(first.quantity) || 0) + qtyToReturn);
        next[firstRowIdx] = { ...first, quantity: String(merged) };
      }
      return next;
    });
  }

  React.useEffect(() => {
    setReceiptItems([]);
    setReceiptDone(null);
  }, [grnId]);

  React.useEffect(() => {
    if (!bundle?.grn_items?.length || !row) return;
    if (Number(grnId) !== row.grn_id) return;
    if (receiptItems.length > 0) return;
    if (row.inventory_receipt_status === "DONE") return;
    initReceiptItems(bundle.grn_items);
  }, [bundle, grnId, receiptItems.length, row?.grn_id, row?.inventory_receipt_status]);

  function handleAccountsAction(grnId: number, action: "APPROVED" | "REJECTED") {
    setAccountsSubmitting(true);
    apiFetch<GrnHeader>(`/api/inbound/grns/${grnId}`, {
      method: "PATCH",
      body: JSON.stringify({ accounts_status: action }),
    })
      .then(async () => {
        toast.success(action === "APPROVED" ? "Accounts approved" : "Accounts rejected");
        await reloadBundle();
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Action failed"))
      .finally(() => setAccountsSubmitting(false));
  }

  function handleReceiveInventory(grnId: number) {
    if (row?.inventory_receipt_status === "DONE") {
      toast.error("Inventory has already been booked for this GRN.");
      return;
    }
    const lineIndexes = [...new Set(receiptItems.map((i) => i.line_index))];
    for (const li of lineIndexes) {
      const rows = receiptItems.filter((i) => i.line_index === li);
      const cap = rows[0]?.accepted_qty ?? 0;
      const sum = sumBookedLineTotal(receiptItems, li);
      if (sum > cap + 1e-6) {
        toast.error(
          `GRN line ${li + 1}: total qty to book (${sum}) is greater than accepted (${cap}). Adjust quantities or bin splits.`
        );
        return;
      }
    }

    const payload = receiptItems
      .filter((i) => i.bin_id.trim() && Number(i.quantity) > 0)
      .map((i) => ({ sku_id: i.sku_id, bin_id: i.bin_id.trim(), quantity: Number(i.quantity) }));
    if (payload.length === 0) {
      toast.error("Choose a target bin and quantity for at least one line");
      return;
    }
    setReceiptSubmitting(true);
    apiFetch<{ ok: boolean; results: { sku_id: string; bin_id: string; new_quantity: number }[] }>(
      `/api/inbound/grns/${grnId}/receive-inventory`,
      { method: "POST", body: JSON.stringify({ items: payload }) }
    )
      .then(async (res) => {
        setReceiptDone(res.results);
        /** Refresh the whole bundle so header (inventory_receipt_status=DONE),
         * grn_logs (the receive-inventory log entry), and grn_items (any
         * derived totals) all refresh together. */
        await reloadBundle();
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to book inventory"))
      .finally(() => setReceiptSubmitting(false));
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-2 py-4 md:px-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href="/inbound/grns">← All GRNs</Link>
        </Button>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <AppPageTitle
          className="mb-0 min-w-0 flex-1"
          title={
            loading
              ? "GRN"
              : row
                ? `GRN ${formatGrnLabel(row.grn_id, row.source ?? (row.grn_id < 0 ? "draft" : "eautomate"))}`
                : "GRN"
          }
          description="Receipt details, documents, and activity for this goods receipt note."
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 self-end sm:mt-1 sm:shrink-0 sm:self-start"
          onClick={() => {
            setWorkflowOpen(true);
            setWorkflowChartMounted(true);
          }}
        >
          <CircleHelp className="h-4 w-4" aria-hidden />
          How this GRN flow works
        </Button>
      </div>

      <Sheet
        open={workflowOpen}
        onOpenChange={(open) => {
          setWorkflowOpen(open);
          if (open) setWorkflowChartMounted(true);
        }}
      >
        <SheetContent
          side="right"
          className={cn(
            "flex w-full flex-col gap-0 overflow-y-auto p-0",
            /* Base Sheet uses data-[side=right]:sm:max-w-sm — override width like GRN Section */
            "data-[side=right]:max-w-none data-[side=right]:sm:max-w-[min(96vw,900px)] data-[side=right]:lg:max-w-[min(94vw,1100px)]"
          )}
        >
          <SheetHeader className="border-b bg-muted/20 px-4 py-4 text-left">
            <SheetTitle>How this GRN flow works</SheetTitle>
            <SheetDescription>
              This guide describes the full <strong className="text-foreground">Zap web</strong> experience
              (all tabs below). The React Native app follows the same business order with a smaller UI;
              see <span className="font-mono text-[13px]">web/docs/mobile/inbound-grn-flow-parity.md</span>{" "}
              in the repo for web vs mobile mapping and backlog. Follow the numbered order below; tabs map
              to the same sequence where your process allows. The diagram is a compact visual of that path.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-5 p-4">
            <div>
              <h3 className="text-foreground mb-2 text-sm font-semibold tracking-wide uppercase">
                Business flow (recommended order)
              </h3>
              <ol className="text-muted-foreground list-decimal space-y-3 pl-5 text-sm leading-relaxed marker:text-foreground/80">
                <li>
                  <strong className="text-foreground">Know your GRN id.</strong> A{" "}
                  <strong className="text-foreground">negative id</strong> (e.g.{" "}
                  <span className="font-mono text-foreground">-2</span>) is a{" "}
                  <strong className="text-foreground">Zap draft</strong> tied to the PO—status{" "}
                  <strong className="text-foreground">DRAFT_ZAP</strong>. A{" "}
                  <strong className="text-foreground">positive id</strong> is the operational receipt in
                  Zap (synced, imported, or after you register the draft).
                </li>
                <li>
                  <strong className="text-foreground">Register the warehouse id (drafts only).</strong> Use{" "}
                  <strong className="text-foreground">Register operational GRN number</strong> on this page
                  when the real GRN number is known. Zap moves you to{" "}
                  <span className="font-mono text-foreground">/inbound/grns/&lt;positive&gt;</span> and
                  replaces the draft id everywhere.
                </li>
                <li>
                  <strong className="text-foreground">Record the physical receipt while OPEN.</strong> On{" "}
                  <strong className="text-foreground">GRN Details</strong>, use the line table and the{" "}
                  <strong className="text-foreground">GRN Section</strong> sheet to enter invoice, accepted,
                  rejected, shortage, and prices vs the PO{" "}
                  <span className="text-muted-foreground">(Editable only until the GRN is closed.)</span>
                </li>
                <li>
                  <strong className="text-foreground">Attach the vendor invoice before close.</strong>{" "}
                  Use <strong className="text-foreground">JPG, JPEG, or PDF</strong> (max two files, 4 MB
                  each). Upload on the <strong className="text-foreground">GRN Documents</strong> tab while
                  the GRN is <strong className="text-foreground">OPEN</strong>, or pick files in the{" "}
                  <strong className="text-foreground">Close GRN</strong> dialog before you confirm close.
                </li>
                <li>
                  <strong className="text-foreground">Close the GRN.</strong> Requires the invoice on file.
                  After <strong className="text-foreground">CLOSED</strong>, line quantities and prices are
                  fixed for this receipt.
                </li>
                <li>
                  <strong className="text-foreground">Accounts (if your policy uses it).</strong> On the{" "}
                  <strong className="text-foreground">Accounts</strong> tab, approve or reject. Inventory
                  booking usually expects <strong className="text-foreground">APPROVED</strong> first.
                </li>
                <li>
                  <strong className="text-foreground">Book stock into bins.</strong> On{" "}
                  <strong className="text-foreground">Inventory receipt</strong>, map each accepted line to
                  target bin IDs (choose from the list where present). You can split one line across
                  several bins; quantities must not exceed accepted per line. The bin must already exist in
                  Bins for that SKU.
                </li>
                <li>
                  <strong className="text-foreground">Audit and debit note.</strong> On{" "}
                  <strong className="text-foreground">Audit &amp; Debit Note</strong>: generate the note,
                  assign the <strong className="text-foreground">DN number</strong>, upload the vendor{" "}
                  <strong className="text-foreground">CN copy</strong> when issued, and{" "}
                  <strong className="text-foreground">Export Tally CSV</strong> when finance needs it.
                </li>
              </ol>
              <p className="text-muted-foreground border-border mt-4 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm leading-relaxed">
                <strong className="text-foreground">Close GRN</strong> in the page header appears only when{" "}
                <strong className="text-foreground">GRN</strong> status is{" "}
                <strong className="text-foreground">OPEN</strong>. Zap drafts (negative id /{" "}
                <strong className="text-foreground">DRAFT_ZAP</strong>) must use{" "}
                <strong className="text-foreground">Register operational GRN number</strong> first.
              </p>
            </div>
            <div>
              <h3 className="text-foreground mb-2 text-sm font-semibold tracking-wide uppercase">
                Where to look
              </h3>
              <ul className="text-muted-foreground list-disc space-y-2 pl-5 text-sm leading-relaxed marker:text-foreground/70">
                <li>
                  <strong className="text-foreground">Logs</strong> — timeline of actions Zap records on this
                  GRN (line updates, close, accounts, inventory, debit note, uploads).
                </li>
                <li>
                  <strong className="text-foreground">Documents</strong> — vendor invoice and other GRN
                  files: upload here while <strong className="text-foreground">OPEN</strong> or in the Close
                  GRN dialog; view and download anytime.
                </li>
                <li>
                  <strong className="text-foreground">Mobile</strong> — same sequence on{" "}
                  <span className="font-mono text-foreground">InboundGrnDetailScreen</span> (Summary, Items,
                  Documents, Debit Note). Parity and gaps:{" "}
                  <span className="font-mono text-[13px]">web/docs/mobile/inbound-grn-flow-parity.md</span>.
                </li>
              </ul>
            </div>
            {workflowChartMounted ? (
              <MermaidDiagram
                chart={INBOUND_GRN_DETAIL_FLOW}
                className="w-full overflow-x-auto"
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      {loading ? (
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      ) : null}

      {!loading && !bundle ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Not found</CardTitle>
            <CardDescription>
              This GRN could not be found. Check that the GRN ID is correct or contact your administrator.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {!loading && bundle && row ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              PO #{row.po_id}
            </Badge>
            <Badge variant="outline" className="font-mono text-xs">
              GRN #{row.grn_id}
            </Badge>
            {row.vendor_invoice_number ? (
              <Badge variant="outline" className="font-mono text-xs">
                Vendor inv. {row.vendor_invoice_number}
              </Badge>
            ) : null}
            {row.grn_status ? (
              <Badge variant="secondary" className={statusClosedClass(row.grn_status)}>
                GRN: {row.grn_status}
              </Badge>
            ) : null}
            {row.grn_audit_status ? (
              <Badge
                variant="secondary"
                className={statusClosedClass(row.grn_audit_status)}
              >
                Audit: {row.grn_audit_status}
              </Badge>
            ) : null}
            {row.grn_invoice_collection_status ? (
              <Badge
                variant="secondary"
                className={invoiceCollectionClass(
                  row.grn_invoice_collection_status
                )}
              >
                Inv. collection: {row.grn_invoice_collection_status}
              </Badge>
            ) : null}
            {showCloseGrnHeaderAction(row.grn_status) ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="ml-auto"
                onClick={() => openCloseGrnModal()}
              >
                Close GRN
              </Button>
            ) : (
              <p className="text-muted-foreground ml-auto max-w-lg text-right text-xs leading-snug">
                {String(row.grn_status ?? "").toUpperCase() === "CLOSED" ? (
                  <>
                    GRN is closed. Use{" "}
                    <span className="font-medium text-foreground">GRN Documents</span> and{" "}
                    <span className="font-medium text-foreground">GRN Logs</span> for files and history.
                  </>
                ) : String(row.grn_status ?? "").toUpperCase() === "DRAFT_ZAP" ? (
                  <>
                    <span className="font-medium text-foreground">Close GRN</span> appears when status is
                    OPEN. Open this draft to promote it (or register an operational GRN number).
                  </>
                ) : (
                  <>
                    <span className="font-medium text-foreground">Close GRN</span> is available when
                    status is OPEN.
                  </>
                )}
              </p>
            )}
          </div>

          {String(row.grn_status ?? "").toUpperCase() === "DRAFT_ZAP" ? (
            <Card className="border-amber-200/80 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Promote this draft to OPEN</CardTitle>
                <CardDescription>
                  This GRN is a zap-created draft (status{" "}
                  <span className="font-medium text-foreground">DRAFT_ZAP</span>). Promote it to{" "}
                  <span className="font-medium text-foreground">OPEN</span> so the{" "}
                  <span className="font-medium text-foreground">Close GRN</span> action becomes available.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div className="space-y-0.5 text-sm">
                    <p className="font-medium">Open with the current zap GRN id</p>
                    <p className="text-muted-foreground text-xs">
                      Keep this draft&apos;s id ({row.grn_id}). Quickest path when ops doesn&apos;t have a
                      separate warehouse GRN number.
                    </p>
                  </div>
                  <Button
                    type="button"
                    disabled={registeringOperationalId}
                    className="w-full sm:w-auto"
                    onClick={() => handleOpenDraft(row.grn_id)}
                  >
                    {registeringOperationalId ? "Working…" : "Open this draft"}
                  </Button>
                </div>
                <div className="border-t pt-3">
                  <p className="text-sm font-medium">Or register an operational GRN number</p>
                  <p className="text-muted-foreground mb-3 text-xs">
                    Re-keys this draft to the warehouse / receipt GRN number you enter. Replaces the id
                    across documents, lines, and URLs.
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="min-w-[12rem] flex-1 space-y-1.5">
                      <label
                        htmlFor="operational-grn-id-input"
                        className="text-muted-foreground text-xs font-medium"
                      >
                        Operational GRN #
                      </label>
                      <Input
                        id="operational-grn-id-input"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        placeholder="e.g. 12345"
                        value={operationalGrnInput}
                        onChange={(e) => setOperationalGrnInput(e.target.value)}
                        disabled={registeringOperationalId}
                        className="font-mono"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={registeringOperationalId}
                      className="w-full sm:w-auto"
                      onClick={() => handleRegisterOperational(row.grn_id)}
                    >
                      {registeringOperationalId ? "Registering…" : "Register"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Tabs
            defaultValue="details"
            className="w-full"
            onValueChange={(v) => {
              if (v !== "inventory" || !bundle?.grn_items?.length) return;
              if (row?.inventory_receipt_status === "DONE") return;
              initReceiptItems(bundle.grn_items);
            }}
          >
            <TabsList
              variant="line"
              className="mb-2 w-full flex-wrap justify-start sm:w-auto"
            >
              <TabsTrigger value="details">GRN Details</TabsTrigger>
              <TabsTrigger value="documents">GRN Documents</TabsTrigger>
              <TabsTrigger value="logs">GRN Logs</TabsTrigger>
              <TabsTrigger
                value="audit"
                onClick={() => {
                  if (!row) return;
                  if (!auditLines) loadAuditPreview(row.grn_id);
                  void loadDebitNote(row.grn_id);
                }}
              >
                Audit &amp; Debit Note
              </TabsTrigger>
              <TabsTrigger value="accounts">Accounts</TabsTrigger>
              <TabsTrigger value="inventory">Inventory Receipt</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-4 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-primary/10 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Vendor</CardTitle>
                <CardDescription>
                  <Link
                    href={`/inbound/vendors/${row.vendor_id}`}
                    className="text-primary font-medium underline-offset-4 hover:underline"
                  >
                    Vendor {row.vendor_id}
                  </Link>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-3">
                  <Field label="Name">
                    {snap?.vendor_display_name ?? row.vendor_name ?? "—"}
                  </Field>
                  <Field label="Address">{snap?.vendor_address ?? "—"}</Field>
                  <Field label="GSTIN">{snap?.vendor_gstin ?? "—"}</Field>
                  <Field label="Contact">{snap?.vendor_contact ?? "—"}</Field>
                </dl>
              </CardContent>
            </Card>

            <Card className="border-primary/10 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Purchase order</CardTitle>
                <CardDescription>
                  <Link
                    href={`/inbound/vendors/${row.vendor_id}/purchase-orders/${row.po_id}`}
                    className="text-primary font-medium underline-offset-4 hover:underline"
                  >
                    PO {row.po_id}
                  </Link>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-3">
                  <Field label="Total demand (SKUs)">
                    {snap?.po_total_demand ?? row.po_total_quantity}
                  </Field>
                  <Field label="PO SKU count">{row.po_sku_count}</Field>
                  <Field label="Release date">
                    {formatDisplayDateOnly(snap?.po_release_date)}
                  </Field>
                  <Field label="Expiry / expected">
                    {formatDisplayDateOnly(snap?.po_expiry_date)}
                  </Field>
                  <Field label="Created by">
                    {snap?.po_created_by ?? "—"}
                  </Field>
                </dl>
              </CardContent>
            </Card>

          </div>

          <Card className="border-primary/10 shadow-sm">
            <CardHeader className="border-b bg-gradient-to-r from-primary/8 via-muted/40 to-transparent pb-4">
              <CardTitle className="text-base">GRN - Receipt summary</CardTitle>
              <CardDescription>
                <span className="font-mono">GRN {row.grn_id}</span>
                <span className="text-muted-foreground/80 px-1">·</span>
                <Link
                  href={`/inbound/vendors/${row.vendor_id}/purchase-orders/${row.po_id}`}
                  className="text-primary font-medium underline-offset-4 hover:underline"
                >
                  PO {row.po_id}
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <DocumentsStatChip
                  label="Invoice qty"
                  value={row.grn_invoice_quantity}
                  className="border-l-[3px] border-violet-500 from-violet-50/95 to-transparent dark:from-violet-950/30"
                />
                <DocumentsStatChip
                  label="Accepted"
                  value={row.grn_accepted_quantity}
                  className="border-l-[3px] border-emerald-500 from-emerald-50/95 to-transparent dark:from-emerald-950/30"
                />
                <DocumentsStatChip
                  label="Rejected"
                  value={row.grn_rejected_quantity}
                  className="border-l-[3px] border-red-500 from-red-50/95 to-transparent dark:from-red-950/30"
                />
                <DocumentsStatChip
                  label="Shortage"
                  value={row.grn_shortage_quantity}
                  className="border-l-[3px] border-amber-500 from-amber-50/95 to-transparent dark:from-amber-950/30"
                />
                <DocumentsStatChip
                  label="SKU count"
                  value={row.grn_sku_count}
                  className="border-l-[3px] border-sky-500 from-sky-50/95 to-transparent dark:from-sky-950/30"
                />
              </div>

              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Box count (invoice)">
                  {snap?.grn_box_count_invoice ?? row.box_count_invoice}
                </Field>
                <Field label="Actual boxes received">
                  {snap?.grn_actual_boxes ?? row.actual_box_count_recieved}
                </Field>
                <Field label="Opened by">
                  {snap?.grn_opened_by ?? row.created_by ?? "—"}
                </Field>
                <Field label="Opened at">
                  {formatDisplayDateTime(
                    snap?.grn_created_at ?? row.created_at
                  )}
                </Field>
                <Field label="Updated">
                  {formatDisplayDateTime(
                    snap?.grn_updated_at ?? row.updated_at
                  )}
                </Field>
                <Field label="Audited by">{row.grn_audit_by ?? "—"}</Field>
                <Field label="Invoice collection by">
                  {row.grn_invoice_collection_by ?? "—"}
                </Field>
              </dl>
            </CardContent>
          </Card>

          <Card className="border-primary/10 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Added items (PO + pendency)</CardTitle>
              <CardDescription>
                Purchase order lines with listing and pendency where applicable.
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-[420px] overflow-auto">
              {bundle.added_items.length === 0 ? (
                <p className="text-muted-foreground text-sm">No line items to show.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">Sr. No</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Ordered</TableHead>
                      <TableHead className="text-right">Pendency</TableHead>
                      <TableHead className="text-right">Invoice Qty</TableHead>
                      <TableHead className="text-right">Accepted Qty</TableHead>
                      <TableHead className="text-right">Rejected Qty</TableHead>
                      <TableHead className="text-right">Shortage Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bundle.added_items.map((line) => (
                      <TableRow key={line.line_index}>
                        <TableCell className="text-muted-foreground text-xs">
                          {line.line_index + 1}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {line.sku_id ?? pickLine(line.raw, ADDED_ITEM_KEYS.sku)}
                        </TableCell>
                        <TableCell className="max-w-[220px] text-xs">
                          {pickLine(line.raw, ADDED_ITEM_KEYS.title)}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {pickLine(line.raw, ADDED_ITEM_KEYS.ordered)}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {pickLine(line.raw, ADDED_ITEM_KEYS.pendency)}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {pickLine(line.raw, ADDED_ITEM_KEYS.invoice)}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {pickLine(line.raw, ADDED_ITEM_KEYS.accepted)}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {pickLine(line.raw, ADDED_ITEM_KEYS.rejected)}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {pickLine(line.raw, ADDED_ITEM_KEYS.shortage)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/10 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">GRN line items</CardTitle>
              <CardDescription>
                Line-level quantities per SKU for this receipt.
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-[min(70vh,560px)] overflow-x-auto overflow-y-auto">
              {bundle.grn_items.length === 0 ? (
                <p className="text-muted-foreground text-sm">No line items to show.</p>
              ) : (
                <Table className="min-w-[2680px]">
                  <TableHeader>
                    <TableRow className="whitespace-nowrap">
                      <TableHead className="w-12">Sr. No</TableHead>
                      <TableHead>SKU ID</TableHead>
                      <TableHead>Ops Tag</TableHead>
                      <TableHead className="text-right">Available Quantity</TableHead>
                      <TableHead className="text-right">Total Demand</TableHead>
                      <TableHead className="text-right">
                        Total Invoice Qty (Prev. GRNs)
                      </TableHead>
                      <TableHead className="text-right">
                        Total Accepted Qty (Prev. GRNs)
                      </TableHead>
                      <TableHead className="text-right">
                        Total Rejected Qty (Prev. GRNs)
                      </TableHead>
                      <TableHead className="text-right">
                        Avg. Received Price (Prev. GRNs)
                      </TableHead>
                      <TableHead className="text-right">
                        Fill Rate % (Prev. GRNs)
                      </TableHead>
                      <TableHead className="text-right">
                        Current Invoice Qty
                      </TableHead>
                      <TableHead className="text-right">
                        Current Accepted Qty
                      </TableHead>
                      <TableHead className="text-right">
                        Current Rejected Qty
                      </TableHead>
                      <TableHead className="text-right">
                        Current Short Qty
                      </TableHead>
                      <TableHead className="text-right">
                        Current Received Price
                      </TableHead>
                      <TableHead className="text-right">Current Tax Rate</TableHead>
                      <TableHead>Current Entry By</TableHead>
                      <TableHead className="text-right">
                        Damage Images Count
                      </TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead className="text-right">
                        Audit Price (excl. GST)
                      </TableHead>
                      <TableHead>Audited By</TableHead>
                      <TableHead>Last Audited At</TableHead>
                      <TableHead className="w-16 text-center text-xs whitespace-nowrap">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bundle.grn_items.map((line) => (
                      <TableRow
                        key={line.line_index}
                        className={grnLineItemRowClass(line)}
                        onClick={() => openGrnSkuSheet(line)}
                      >
                        <TableCell className="text-muted-foreground text-xs">
                          {line.line_index + 1}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {line.sku_id ?? pickLine(line.raw, GRN_ITEM_KEYS.sku)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {pickLine(line.raw, GRN_ITEM_KEYS.opsTag)}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {pickLine(line.raw, GRN_ITEM_KEYS.availableQty)}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {pickLine(line.raw, GRN_ITEM_KEYS.totalDemand)}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {pickLine(line.raw, GRN_ITEM_KEYS.prevInvoiceQty)}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {pickLine(line.raw, GRN_ITEM_KEYS.prevAcceptedQty)}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {pickLine(line.raw, GRN_ITEM_KEYS.prevRejectedQty)}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {pickLine(line.raw, GRN_ITEM_KEYS.avgReceivedPricePrev)}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {pickLine(line.raw, GRN_ITEM_KEYS.fillRatePrev)}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {pickLine(line.raw, GRN_ITEM_KEYS.invoice)}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {pickLine(line.raw, GRN_ITEM_KEYS.accepted)}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {pickLine(line.raw, GRN_ITEM_KEYS.rejected)}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {pickLine(line.raw, GRN_ITEM_KEYS.shortage)}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {pickLine(line.raw, GRN_ITEM_KEYS.receivedPrice)}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {pickLine(line.raw, GRN_ITEM_KEYS.taxRate)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {pickLine(line.raw, GRN_ITEM_KEYS.entryBy)}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {pickLine(line.raw, GRN_ITEM_KEYS.damageImagesCount)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatLineMaybeDate(
                            pickLine(line.raw, GRN_ITEM_KEYS.lineCreatedAt)
                          )}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {pickLine(line.raw, GRN_ITEM_KEYS.auditPriceExclGst)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {pickLine(line.raw, GRN_ITEM_KEYS.auditedBy)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatLineMaybeDate(
                            pickLine(line.raw, GRN_ITEM_KEYS.lastAuditedAt)
                          )}
                        </TableCell>
                        <TableCell className="px-1 text-center" onClick={(e) => e.stopPropagation()}>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            aria-label="Open GRN Section"
                            onClick={() => openGrnSkuSheet(line)}
                          >
                            <PanelRightOpen className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <GrnSkuDetailSheet
            open={grnSkuSheetOpen}
            onOpenChange={(next) => {
              setGrnSkuSheetOpen(next);
              if (!next) setGrnSkuSelectedLine(null);
            }}
            grnId={grnId}
            grn_items={bundle.grn_items}
            added_items={bundle.added_items}
            selectedLine={grnSkuSelectedLine}
            onSelectLine={setGrnSkuSelectedLine}
            grnTitle={`GRN #${row.grn_id}`}
            onLineUpdated={async () => {
              /** After a line save, close the sidebar and re-fetch the whole
               * bundle so derived totals (accepted/rejected/shortage on the
               * GRN header, fill-rate badges, debit-note flags, logs, etc.)
               * all reflect the new state instead of just the row we touched. */
              setGrnSkuSheetOpen(false);
              setGrnSkuSelectedLine(null);
              await reloadBundle();
            }}
          />

          <Dialog
            open={closeGrnModalOpen}
            onOpenChange={(o) => {
              if (!o && closeGrnBusy) return;
              setCloseGrnModalOpen(o);
              if (!o) {
                setCloseGrnFiles([]);
                if (closeGrnFileInputRef.current) closeGrnFileInputRef.current.value = "";
              }
            }}
          >
            <DialogContent
              className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,1400px)]"
              showCloseButton={!closeGrnBusy}
            >
              <DialogHeader className="border-border shrink-0 border-b px-6 py-4 text-left">
                <DialogTitle>Close GRN</DialogTitle>
                <DialogDescription className="text-muted-foreground pt-1 text-sm">
                  Review “current GRN” quantities and prices, attach the vendor invoice, then confirm
                  closure. At least one invoice file is required (upload here or from GRN Documents).
                </DialogDescription>
              </DialogHeader>
              <div className="text-muted-foreground/90 hover:text-foreground/90 min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-4 text-xs leading-relaxed">
                <div className="border-border bg-muted/30 space-y-2 rounded-md border p-3">
                  <p className="text-foreground font-medium text-[13px]">How closing works</p>
                  <ul className="list-inside list-disc space-y-1">
                    <li>
                      After goods are received, enter approved quantities and pricing per line (current
                      GRN columns).
                    </li>
                    <li>
                      Final closure requires a supporting vendor invoice — upload scanned PDF or JPG
                      (max 2 files, 4MB each). An invoice already stored on this GRN counts toward this
                      requirement.
                    </li>
                    <li>Formats: JPG, JPEG, PDF.</li>
                  </ul>
                </div>

                <section className="space-y-2">
                  <h3 className="text-foreground font-semibold text-sm">
                    Upload scanned invoice files
                  </h3>
                  <p className="text-muted-foreground text-[13px]">
                    Vendor invoice for this receipt — pick one or many (up to{" "}
                    <span className="font-medium">{VENDOR_INVOICE_MAX_FILES}</span> files,{" "}
                    <span className="font-medium">4 MB</span> each;{" "}
                    <span className="font-medium">JPG, JPEG, PDF</span>). If the vendor only provides a
                    spreadsheet-style invoice, export or scan to PDF before uploading.
                  </p>
                  {bundle.invoice_files.length > 0 ? (
                    <p className="text-sky-800 text-[13px] dark:text-sky-200">
                      This GRN already has {bundle.invoice_files.length} invoice file
                      {bundle.invoice_files.length === 1 ? "" : "s"} on file. You may add more below
                      or close using the existing documents.
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={closeGrnFileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,image/jpeg,application/pdf"
                      multiple
                      className="text-muted-foreground max-w-full text-xs file:mr-2 file:rounded file:border file:bg-muted file:px-2 file:py-1"
                      disabled={closeGrnBusy}
                      onChange={handleCloseGrnFilesChange}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  {closeGrnFiles.length > 0 ? (
                    <ul className="text-[13px]">
                      {closeGrnFiles.map((f) => (
                        <li key={`${f.name}-${f.size}`} className="font-mono">
                          {f.name}{" "}
                          <span className="text-muted-foreground">
                            ({(f.size / 1024).toFixed(1)} KB)
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>

                <section className="space-y-2">
                  <h3 className="text-foreground font-semibold text-sm">
                    GRN line items — review current GRN
                  </h3>
                  <p className="text-muted-foreground text-[13px]">
                    Per line: Invoice qty = Accepted + Rejected + Short before you can close.
                  </p>
                  <div className="max-h-[min(50vh,420px)] overflow-auto rounded-md border">
                    {bundle.grn_items.length === 0 ? (
                      <p className="text-muted-foreground p-4 text-sm">No lines on this GRN.</p>
                    ) : (
                      <Table className="min-w-[2480px]">
                        <TableHeader>
                          <TableRow className="whitespace-nowrap">
                            <TableHead className="w-12">Sr. No</TableHead>
                            <TableHead>SKU ID</TableHead>
                            <TableHead>Ops Tag</TableHead>
                            <TableHead className="text-right">Available Quantity</TableHead>
                            <TableHead className="text-right">Total Demand</TableHead>
                            <TableHead className="text-right">
                              Total Invoice Qty (Prev. GRNs)
                            </TableHead>
                            <TableHead className="text-right">
                              Total Accepted Qty (Prev. GRNs)
                            </TableHead>
                            <TableHead className="text-right">
                              Total Rejected Qty (Prev. GRNs)
                            </TableHead>
                            <TableHead className="text-right">
                              Avg. Received Price (Prev. GRNs)
                            </TableHead>
                            <TableHead className="text-right">
                              Fill Rate % (Prev. GRNs)
                            </TableHead>
                            <TableHead
                              className={cn(
                                "text-right bg-emerald-50/40 dark:bg-emerald-950/25",
                                "font-medium text-emerald-950 dark:text-emerald-100"
                              )}
                            >
                              Current Invoice Qty
                            </TableHead>
                            <TableHead
                              className={cn(
                                "text-right bg-emerald-50/40 dark:bg-emerald-950/25",
                                "font-medium text-emerald-950 dark:text-emerald-100"
                              )}
                            >
                              Current Accepted Qty
                            </TableHead>
                            <TableHead
                              className={cn(
                                "text-right bg-emerald-50/40 dark:bg-emerald-950/25",
                                "font-medium text-emerald-950 dark:text-emerald-100"
                              )}
                            >
                              Current Rejected Qty
                            </TableHead>
                            <TableHead
                              className={cn(
                                "text-right bg-emerald-50/40 dark:bg-emerald-950/25",
                                "font-medium text-emerald-950 dark:text-emerald-100"
                              )}
                            >
                              Current Short Qty
                            </TableHead>
                            <TableHead
                              className={cn(
                                "text-right bg-emerald-50/40 dark:bg-emerald-950/25",
                                "font-medium text-emerald-950 dark:text-emerald-100"
                              )}
                            >
                              Current Received Price
                            </TableHead>
                            <TableHead
                              className={cn(
                                "text-right bg-emerald-50/40 dark:bg-emerald-950/25",
                                "font-medium text-emerald-950 dark:text-emerald-100"
                              )}
                            >
                              Current Tax Rate
                            </TableHead>
                            <TableHead>Current Entry By</TableHead>
                            <TableHead className="text-right">Damage Images Count</TableHead>
                            <TableHead>Created At</TableHead>
                            <TableHead
                              className={cn(
                                "text-right bg-emerald-50/40 dark:bg-emerald-950/25",
                                "font-medium text-emerald-950 dark:text-emerald-100"
                              )}
                            >
                              Audit Price (excl. GST)
                            </TableHead>
                            <TableHead>Audited By</TableHead>
                            <TableHead>Last Audited At</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bundle.grn_items.map((line) => {
                            const d =
                              closeGrnDrafts[line.line_index] ??
                              seedCloseGrnDraftsFromLines([line])[line.line_index];
                            return (
                              <TableRow key={line.line_index} className="whitespace-nowrap">
                                <TableCell className="text-muted-foreground text-xs">
                                  {line.line_index + 1}
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                  {line.sku_id ?? pickLine(line.raw, GRN_ITEM_KEYS.sku)}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {pickLine(line.raw, GRN_ITEM_KEYS.opsTag)}
                                </TableCell>
                                <TableCell className="text-right text-xs">
                                  {pickLine(line.raw, GRN_ITEM_KEYS.availableQty)}
                                </TableCell>
                                <TableCell className="text-right text-xs">
                                  {pickLine(line.raw, GRN_ITEM_KEYS.totalDemand)}
                                </TableCell>
                                <TableCell className="text-right text-xs">
                                  {pickLine(line.raw, GRN_ITEM_KEYS.prevInvoiceQty)}
                                </TableCell>
                                <TableCell className="text-right text-xs">
                                  {pickLine(line.raw, GRN_ITEM_KEYS.prevAcceptedQty)}
                                </TableCell>
                                <TableCell className="text-right text-xs">
                                  {pickLine(line.raw, GRN_ITEM_KEYS.prevRejectedQty)}
                                </TableCell>
                                <TableCell className="text-right text-xs">
                                  {pickLine(line.raw, GRN_ITEM_KEYS.avgReceivedPricePrev)}
                                </TableCell>
                                <TableCell className="text-right text-xs">
                                  {pickLine(line.raw, GRN_ITEM_KEYS.fillRatePrev)}
                                </TableCell>
                                <TableCell
                                  className="bg-emerald-50/40 p-1 dark:bg-emerald-950/20"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Input
                                    className="h-8 min-w-[4.5rem] text-right font-mono text-xs"
                                    value={d.inv}
                                    disabled={closeGrnBusy}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setCloseGrnDrafts((prev) => ({
                                        ...prev,
                                        [line.line_index]: { ...d, inv: v },
                                      }));
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </TableCell>
                                <TableCell
                                  className="bg-emerald-50/40 p-1 dark:bg-emerald-950/20"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Input
                                    className="h-8 min-w-[4.5rem] text-right font-mono text-xs"
                                    value={d.acc}
                                    disabled={closeGrnBusy}
                                    onChange={(e) =>
                                      setCloseGrnDrafts((prev) => ({
                                        ...prev,
                                        [line.line_index]: { ...d, acc: e.target.value },
                                      }))
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </TableCell>
                                <TableCell
                                  className="bg-emerald-50/40 p-1 dark:bg-emerald-950/20"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Input
                                    className="h-8 min-w-[4.5rem] text-right font-mono text-xs"
                                    value={d.rej}
                                    disabled={closeGrnBusy}
                                    onChange={(e) =>
                                      setCloseGrnDrafts((prev) => ({
                                        ...prev,
                                        [line.line_index]: { ...d, rej: e.target.value },
                                      }))
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </TableCell>
                                <TableCell
                                  className="bg-emerald-50/40 p-1 dark:bg-emerald-950/20"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Input
                                    className="h-8 min-w-[4.5rem] text-right font-mono text-xs"
                                    value={d.short}
                                    disabled={closeGrnBusy}
                                    onChange={(e) =>
                                      setCloseGrnDrafts((prev) => ({
                                        ...prev,
                                        [line.line_index]: { ...d, short: e.target.value },
                                      }))
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </TableCell>
                                <TableCell
                                  className="bg-emerald-50/40 p-1 dark:bg-emerald-950/20"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Input
                                    className="h-8 min-w-[4.5rem] text-right font-mono text-xs"
                                    value={d.price}
                                    disabled={closeGrnBusy}
                                    onChange={(e) =>
                                      setCloseGrnDrafts((prev) => ({
                                        ...prev,
                                        [line.line_index]: { ...d, price: e.target.value },
                                      }))
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </TableCell>
                                <TableCell
                                  className="bg-emerald-50/40 p-1 dark:bg-emerald-950/20"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Input
                                    className="h-8 min-w-[4.5rem] text-right font-mono text-xs"
                                    value={d.tax}
                                    disabled={closeGrnBusy}
                                    onChange={(e) =>
                                      setCloseGrnDrafts((prev) => ({
                                        ...prev,
                                        [line.line_index]: { ...d, tax: e.target.value },
                                      }))
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </TableCell>
                                <TableCell className="text-xs">
                                  {pickLine(line.raw, GRN_ITEM_KEYS.entryBy)}
                                </TableCell>
                                <TableCell className="text-right text-xs">
                                  {pickLine(line.raw, GRN_ITEM_KEYS.damageImagesCount)}
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-xs">
                                  {formatLineMaybeDate(
                                    pickLine(line.raw, GRN_ITEM_KEYS.lineCreatedAt)
                                  )}
                                </TableCell>
                                <TableCell
                                  className="bg-emerald-50/40 p-1 dark:bg-emerald-950/20"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Input
                                    className="h-8 min-w-[4.5rem] text-right font-mono text-xs"
                                    value={d.audit}
                                    disabled={closeGrnBusy}
                                    onChange={(e) =>
                                      setCloseGrnDrafts((prev) => ({
                                        ...prev,
                                        [line.line_index]: { ...d, audit: e.target.value },
                                      }))
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </TableCell>
                                <TableCell className="text-xs">
                                  {pickLine(line.raw, GRN_ITEM_KEYS.auditedBy)}
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-xs">
                                  {formatLineMaybeDate(
                                    pickLine(line.raw, GRN_ITEM_KEYS.lastAuditedAt)
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </section>
              </div>
              <DialogFooter className="border-border bg-muted/10 flex shrink-0 flex-col gap-2 border-t px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
                {(() => {
                  const hint = closeGrnDisabledHint({
                    busy: closeGrnBusy,
                    existingInvoiceFilesCount: bundle.invoice_files.length,
                    stagedInvoiceFilesCount: closeGrnFiles.length,
                  });
                  return hint ? (
                    <p className="text-muted-foreground text-xs sm:mr-auto">{hint}</p>
                  ) : (
                    <span className="sm:mr-auto" />
                  );
                })()}
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={closeGrnBusy}
                    onClick={() => setCloseGrnModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={closeGrnSubmitDisabled({
                      busy: closeGrnBusy,
                      existingInvoiceFilesCount: bundle.invoice_files.length,
                      stagedInvoiceFilesCount: closeGrnFiles.length,
                    })}
                    title={
                      closeGrnDisabledHint({
                        busy: closeGrnBusy,
                        existingInvoiceFilesCount: bundle.invoice_files.length,
                        stagedInvoiceFilesCount: closeGrnFiles.length,
                      }) ?? undefined
                    }
                    onClick={() => void handleConfirmCloseGrn()}
                  >
                    {closeGrnSubmitLabel({
                      busy: closeGrnBusy,
                      stagedFilesCount: closeGrnFiles.length,
                    })}
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {snap?.synced_at ? (
            <p className="text-muted-foreground text-center text-xs">
              Details last refreshed {formatDisplayDateTime(snap.synced_at)}
            </p>
          ) : null}
            </TabsContent>

            <TabsContent value="documents" className="mt-4 space-y-6">
              <Card className="overflow-hidden border-primary/15 shadow-sm">
                <CardHeader className="border-b bg-gradient-to-r from-primary/8 via-muted/40 to-transparent pb-4">
                  <CardTitle className="text-base">GRN summary</CardTitle>
                  <CardDescription>
                    Quantities and identifiers for this receipt — at-a-glance.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8 pt-6">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                    <DocumentsStatChip
                      label="Invoice qty"
                      value={row.grn_invoice_quantity}
                      className="border-l-[3px] border-violet-500 from-violet-50/95 to-transparent dark:from-violet-950/30"
                    />
                    <DocumentsStatChip
                      label="Accepted qty"
                      value={row.grn_accepted_quantity}
                      className="border-l-[3px] border-emerald-500 from-emerald-50/95 to-transparent dark:from-emerald-950/30"
                    />
                    <DocumentsStatChip
                      label="Rejected qty"
                      value={row.grn_rejected_quantity}
                      className="border-l-[3px] border-red-500 from-red-50/95 to-transparent dark:from-red-950/30"
                    />
                    <DocumentsStatChip
                      label="Shortage qty"
                      value={row.grn_shortage_quantity}
                      className="border-l-[3px] border-amber-500 from-amber-50/95 to-transparent dark:from-amber-950/30"
                    />
                    <DocumentsStatChip
                      label="SKU count"
                      value={row.grn_sku_count}
                      className="border-l-[3px] border-sky-500 from-sky-50/95 to-transparent dark:from-sky-950/30"
                    />
                    <DocumentsStatChip
                      label="Fill rate %"
                      value={pickPoFillRate(snap) ?? "—"}
                      className="border-l-[3px] border-indigo-500 from-indigo-50/95 to-transparent dark:from-indigo-950/30"
                    />
                  </div>
                  <div className="border-border bg-muted/20 grid gap-4 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="GRN number">
                      <span className="font-mono font-semibold">{row.grn_id}</span>
                    </Field>
                    <Field label="PO number">
                      <Link
                        href={`/inbound/vendors/${row.vendor_id}/purchase-orders/${row.po_id}`}
                        className="font-mono font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {row.po_id}
                      </Link>
                    </Field>
                    <Field label="Vendor invoice #">{row.vendor_invoice_number ?? "—"}</Field>
                    <Field label="Invoice collection">
                      <span
                        className={invoiceCollectionClass(
                          row.grn_invoice_collection_status
                        )}
                      >
                        {row.grn_invoice_collection_status ?? "—"}
                      </span>
                      {row.grn_invoice_collection_by ? (
                        <span className="text-muted-foreground mt-1 block text-xs">
                          Collected by {row.grn_invoice_collection_by}
                        </span>
                      ) : null}
                    </Field>
                    {pickPoRaw(snap, "status") ? (
                      <Field label="PO status">
                        <Badge variant="outline" className="font-normal">
                          {pickPoRaw(snap, "status")}
                        </Badge>
                      </Field>
                    ) : (
                      <Field label="PO status">
                        <span className="text-muted-foreground text-sm">—</span>
                      </Field>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-primary/15 shadow-sm">
                <CardHeader className="border-b bg-muted/25 pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="text-primary size-4" />
                    Vendor invoice files
                  </CardTitle>
                  <CardDescription>
                    PDF / images for this vendor invoice. Upload here while OPEN or add files in the Close GRN
                    dialog — download or archive below.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  {(() => {
                    if (row.grn_status === "OPEN" && row.grn_id > 0) {
                      return (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            ref={documentsInvoiceFileInputRef}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,image/jpeg,application/pdf"
                            multiple
                            className="text-muted-foreground max-w-full text-xs file:mr-2 file:rounded file:border file:bg-muted file:px-2 file:py-1"
                            disabled={invoiceDocumentsUploading}
                            onChange={(e) => {
                              const picked = filterVendorInvoiceFilesPicked(
                                Array.from(e.target.files ?? [])
                              );
                              e.target.value = "";
                              if (picked.length === 0) return;
                              void uploadVendorInvoiceFilesFromDocuments(picked);
                            }}
                            onClick={(ev) => ev.stopPropagation()}
                          />
                          {invoiceDocumentsUploading ? (
                            <span className="text-muted-foreground text-xs">Uploading…</span>
                          ) : null}
                        </div>
                      );
                    }
                    if (row.grn_id < 0) {
                      return (
                        <p className="text-muted-foreground text-xs">
                          Register the operational GRN before uploading invoice files.
                        </p>
                      );
                    }
                    if (row.grn_status !== "OPEN") {
                      return (
                        <p className="text-muted-foreground text-xs">
                          Vendor invoice upload is available while the GRN is OPEN (or add files when you run
                          Close GRN).
                        </p>
                      );
                    }
                    return null;
                  })()}
                  {bundle.invoice_files.length === 0 ? (
                    <div className="border-border rounded-xl border border-dashed px-6 py-10 text-center">
                      <p className="text-muted-foreground text-sm">
                        No vendor invoice documents are attached yet.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {bundle.invoice_files.map((f) => {
                        const fileHref =
                          f.download_url ??
                          `/api/inbound/grns/${row.grn_id}/files/${f.file_id}?kind=invoice`;
                        return (
                          <GrnDocumentFileCard
                            key={`inv-${f.file_id}`}
                            fileHref={fileHref}
                            file_type={f.file_type}
                            file_name={f.file_name}
                            uploaded_at={f.uploaded_at}
                            uploaded_by={f.uploaded_by}
                          />
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="overflow-hidden border-amber-200/50 shadow-sm dark:border-amber-900/35">
                <CardHeader className="border-b bg-gradient-to-r from-amber-50/90 via-muted/30 to-transparent pb-4 dark:from-amber-950/25">
                  <CardTitle className="text-base">Debit / credit notes</CardTitle>
                  <CardDescription>
                    Notes linked to this GRN — identifiers, statuses, uploads, and files.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  {(bundle.debit_credit_notes ?? []).length === 0 ? (
                    <div className="border-border rounded-xl border border-dashed px-6 py-10 text-center">
                      <p className="text-muted-foreground text-sm">
                        No debit or credit notes for this GRN.
                      </p>
                    </div>
                  ) : (
                    <>
                      {(bundle.debit_credit_notes ?? []).map((note) => (
                        <Card
                          key={note.note_id}
                          className="border-amber-200/60 shadow-sm dark:border-amber-900/35"
                        >
                          <CardHeader className="space-y-3 bg-muted/25 pb-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <Badge
                                  variant="secondary"
                                  className="uppercase tracking-wide"
                                >
                                  {formatNoteType(note.credit_debit_note_type)}
                                </Badge>
                                <Badge variant="outline" className="font-mono">
                                  Note #{note.note_id}
                                </Badge>
                                {note.credit_debit_note_status ? (
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      debitNoteGoodClass(note.credit_debit_note_status)
                                    )}
                                  >
                                    {note.credit_debit_note_status}
                                  </Badge>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
                                <span>GRN {note.grn_id}</span>
                                <span className="opacity-50">·</span>
                                <Link
                                  href={`/inbound/vendors/${row.vendor_id}/purchase-orders/${note.po_id ?? row.po_id}`}
                                  className="text-primary font-medium underline-offset-4 hover:underline"
                                >
                                  PO {note.po_id ?? row.po_id}
                                </Link>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 font-mono text-sm">
                              <span className="text-muted-foreground">Note document #</span>
                              <span className="truncate font-semibold">
                                {note.credit_debit_note_number ?? "—"}
                              </span>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-6 pt-6">
                            <div className="border-border bg-muted/15 grid gap-4 rounded-xl border p-4 sm:grid-cols-2 xl:grid-cols-3">
                              <Field label="GRN status">
                                <span
                                  className={cn(
                                    "font-medium text-sm",
                                    statusClosedClass(note.grn_status)
                                  )}
                                >
                                  {note.grn_status ?? "—"}
                                </span>
                              </Field>
                              <Field label="Audit status">
                                <span
                                  className={cn(
                                    "font-medium text-sm",
                                    statusClosedClass(note.grn_audit_status)
                                  )}
                                >
                                  {note.grn_audit_status ?? "—"}
                                </span>
                              </Field>
                              <Field label="Vendor invoice">
                                {note.vendor_invoice_number ?? "—"}
                              </Field>
                              <Field label="Box count (invoice)">
                                {note.box_count_invoice ?? "—"}
                              </Field>
                              <Field label="Actual boxes">
                                {note.actual_box_count_recieved ?? "—"}
                              </Field>
                              <Field label="Audited by">
                                {note.grn_audit_by ?? "—"}
                              </Field>
                              <Field label="Note # assignment">
                                <span
                                  className={cn(
                                    debitNoteGoodClass(
                                      note.credit_debit_note_number_assignment_status
                                    )
                                  )}
                                >
                                  {note.credit_debit_note_number_assignment_status ?? "—"}
                                </span>
                              </Field>
                              <Field label="Upload status">
                                <span
                                  className={cn(
                                    debitNoteGoodClass(note.credit_debit_note_upload_status),
                                    debitNoteBadClass(note.credit_debit_note_upload_status)
                                  )}
                                >
                                  {note.credit_debit_note_upload_status ?? "—"}
                                </span>
                              </Field>
                              <Field label="Uploaded by">
                                {note.credit_debit_note_uploaded_by ?? "—"}
                              </Field>
                              <Field label="Reverse note #">
                                {note.reverse_credit_debit_note_number ?? "—"}
                              </Field>
                              <Field label="Reverse upload">
                                <span
                                  className={cn(
                                    debitNoteBadClass(
                                      note.reverse_credit_debit_note_upload_status
                                    ),
                                    debitNoteGoodClass(
                                      note.reverse_credit_debit_note_upload_status
                                    )
                                  )}
                                >
                                  {note.reverse_credit_debit_note_upload_status ?? "—"}
                                </span>
                              </Field>
                              <Field label="Reverse uploaded by">
                                {note.reverse_credit_debit_note_uploaded_by ?? "—"}
                              </Field>
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center gap-2 border-b pb-2">
                                <FileText className="text-muted-foreground size-4" />
                                <span className="text-sm font-semibold tracking-wide">
                                  Files on this note
                                </span>
                              </div>
                              {note.files.length === 0 ? (
                                <p className="text-muted-foreground text-sm">
                                  No attachments on this note.
                                </p>
                              ) : (
                                <div className="grid gap-3 md:grid-cols-2">
                                  {note.files.map((f) => {
                                    const href =
                                      f.download_url ??
                                      `/api/inbound/grns/${row.grn_id}/files/${f.file_id}?kind=debit_note&noteId=${note.note_id}`;
                                    return (
                                      <GrnDocumentFileCard
                                        key={`dc-${note.note_id}-${f.file_id}-${f.download_url ?? ""}`}
                                        fileHref={href}
                                        file_type={f.file_type}
                                        file_name={f.file_name ?? f.saved_file_name}
                                        uploaded_at={f.uploaded_at}
                                        uploaded_by={f.uploaded_by}
                                      />
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    <input
                      ref={dcUploadRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file || !row?.grn_id) return;
                        setDcUploading(true);
                        void (async () => {
                          try {
                            const targetNoteId =
                              bundle?.debit_credit_notes?.[0]?.note_id ?? -1;
                            const fd = new FormData();
                            fd.set("file", file);
                            fd.set("kind", "debit_note");
                            fd.set("noteId", String(targetNoteId));
                            const token = getStoredToken();
                            const headers = new Headers();
                            if (token)
                              headers.set("Authorization", `Bearer ${token}`);
                            const res = await fetch(
                              apiUrl(`/api/inbound/grns/${row.grn_id}/upload-zap`),
                              { method: "POST", headers, body: fd }
                            );
                            const text = await res.text();
                            if (!res.ok) throw new Error(text.slice(0, 200));
                            toast.success("File uploaded");
                            globalThis.location.reload();
                          } catch (err) {
                            toast.error(
                              err instanceof Error ? err.message : "Upload failed"
                            );
                          } finally {
                            setDcUploading(false);
                          }
                        })();
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={dcUploading || !row?.grn_id}
                      title="Upload a reverse debit or credit note file"
                      onClick={() => dcUploadRef.current?.click()}
                    >
                      {dcUploading ? "Uploading…" : "Upload Reverse Debit/Credit Note"}
                    </Button>
                    <div>
                      <h4 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                        Prepared downloadables
                      </h4>
                      <p className="text-muted-foreground text-sm">
                        Debit and credit note CSV exports are not stored here. Export from the
                        source system if you need them.
                      </p>
                    </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="logs" className="mt-4 space-y-4">
              <Card className="overflow-hidden border-primary/15 shadow-sm">
                <CardHeader className="border-b bg-muted/25">
                  <CardTitle className="text-base">GRN activity log</CardTitle>
                  <CardDescription>
                    Timeline of operations for GRN #{row.grn_id} — same data as table view,
                    reorganized by event.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  {(bundle.grn_logs ?? []).length === 0 ? (
                    <div className="border-border rounded-xl border border-dashed px-6 py-10 text-center">
                      <p className="text-muted-foreground text-sm">
                        No activity log entries for this GRN.
                      </p>
                    </div>
                  ) : (
                    <ul className="relative space-y-4 pl-0">
                      {(bundle.grn_logs ?? []).map((log, logIdx) => {
                        const rawOp =
                          log.operation_performed ??
                          (typeof log.raw?.operation_performed === "string"
                            ? log.raw.operation_performed
                            : null);
                        const accent = getLogTimelineAccent(log.log_type, rawOp ?? null);
                        const operationTitle =
                          formatLogOperation(rawOp ?? log.operation_performed ?? null);
                        const logTypeLabel = pickLogField(log.log_type, log.raw, [
                          "log_type",
                          "logType",
                          "type",
                        ]);
                        const poStr = pickLogField(log.po_id, log.raw, ["po_id", "poId"]);
                        const vendorStr = pickLogField(log.vendor_id, log.raw, [
                          "vendor_id",
                          "vendorId",
                        ]);
                        const fkStr = pickLogField(log.foreign_key, log.raw, [
                          "foreign_key",
                          "foreignKey",
                          "grn_id",
                        ]);
                        const skuStr = pickLogField(log.sku_id, log.raw, [
                          "sku_id",
                          "skuId",
                          "SKU_ID",
                        ]);
                        const invQtyStr = pickLogField(log.invoice_quantity, log.raw, [
                          "invoice_quantity",
                          "invoiceQuantity",
                        ]);
                        const accQtyStr = pickLogField(log.accepted_quantity, log.raw, [
                          "accepted_quantity",
                          "acceptedQuantity",
                        ]);
                        const rejQtyStr = pickLogField(log.rejected_quantity, log.raw, [
                          "rejected_quantity",
                          "rejectedQuantity",
                        ]);
                        const priceStr = pickLogField(log.received_price, log.raw, [
                          "received_price",
                          "receivedPrice",
                        ]);
                        const remarksStr = pickLogField(log.remarks, log.raw, [
                          "remarks",
                          "remark",
                        ]);
                        const byStr = pickLogField(log.created_by, log.raw, [
                          "created_by",
                          "createdBy",
                        ]);
                        return (
                          <li
                            key={`log-${log.log_id}-${log.line_index}-${logIdx}`}
                            className="relative flex gap-3"
                          >
                            <span
                              className={cn(
                                "mt-6 size-3 shrink-0 rounded-full border-2 border-background ring-4 ring-muted/70",
                                accent.dotClass
                              )}
                            />
                            <div
                              className={cn(
                                "min-w-0 flex-1 rounded-xl border bg-card px-4 py-3 shadow-sm ring-1 ring-border/70 transition-colors hover:bg-muted/40",
                                accent.leftBarClass
                              )}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                                <div className="min-w-0 space-y-1">
                                  <p className="text-foreground leading-snug font-semibold capitalize">
                                    {operationTitle}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-2">
                                    {logTypeLabel !== "—" ? (
                                      <Badge variant="outline" className="text-[10px] uppercase">
                                        {logTypeLabel}
                                      </Badge>
                                    ) : null}
                                    <Badge variant="secondary" className="font-mono text-[10px]">
                                      log #{log.log_id}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-0.5 text-xs">
                                  <span className="text-muted-foreground whitespace-nowrap">
                                    {formatDisplayDateTime(log.created_at)}
                                  </span>
                                  {byStr !== "—" ? (
                                    <span className="text-muted-foreground">{byStr}</span>
                                  ) : null}
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                {skuStr !== "—" ? (
                                  <span className="bg-muted rounded-md border px-2 py-0.5 font-mono text-xs">
                                    SKU {skuStr}
                                  </span>
                                ) : null}
                                <LogQtyPill
                                  label="Inv"
                                  value={invQtyStr}
                                  className="border-violet-200/70 bg-violet-50 text-violet-950 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-50"
                                />
                                <LogQtyPill
                                  label="Acc"
                                  value={accQtyStr}
                                  className="border-emerald-200/70 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50"
                                />
                                <LogQtyPill
                                  label="Rej"
                                  value={rejQtyStr}
                                  className="border-red-200/70 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/35 dark:text-red-50"
                                />
                                {priceStr !== "—" &&
                                Number(String(priceStr).replaceAll(",", "")) !== 0 ? (
                                  <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs tabular-nums dark:border-slate-700 dark:bg-slate-900/70">
                                    ₹ {priceStr}
                                  </span>
                                ) : null}
                              </div>
                              {(poStr !== "—" ||
                                vendorStr !== "—" ||
                                fkStr !== "—") && (
                                <p className="text-muted-foreground mt-3 text-[11px] leading-relaxed tracking-tight">
                                  {poStr !== "—" ? (
                                    <span>
                                      PO <span className="font-mono">{poStr}</span>
                                    </span>
                                  ) : null}{" "}
                                  {vendorStr !== "—" ? (
                                    <span>
                                      · Vendor <span className="font-mono">{vendorStr}</span>
                                    </span>
                                  ) : null}{" "}
                                  {fkStr !== "—" ? (
                                    <span>
                                      · FK <span className="font-mono">{fkStr}</span>
                                    </span>
                                  ) : null}
                                </p>
                              )}
                              {remarksStr !== "—" ? (
                                <p className="text-muted-foreground mt-3 border-t pt-3 text-xs italic leading-relaxed">
                                  {remarksStr}
                                </p>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Audit & Debit Note ─────────────────────────────────────────────── */}
            <TabsContent value="audit" className="mt-4 space-y-6">
              <Card className="overflow-hidden border-primary/15 shadow-sm">
                <CardHeader className="border-b bg-gradient-to-r from-primary/8 via-muted/40 to-transparent pb-4">
                  <CardTitle className="text-base">Price audit — vendor vs. audit price</CardTitle>
                  <CardDescription>
                    Compares the vendor&apos;s received_price with the admin-approved audit_price (excl. GST)
                    per accepted line item. Lines where the vendor price exceeds the audit price are
                    eligible for a debit note.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  {auditLoading ? (
                    <Skeleton className="h-40 w-full" />
                  ) : auditLines && auditLines.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">#</TableHead>
                          <TableHead className="text-xs">SKU</TableHead>
                          <TableHead className="text-xs">Description</TableHead>
                          <TableHead className="text-right text-xs">Accepted Qty</TableHead>
                          <TableHead className="text-right text-xs">Rejected Qty</TableHead>
                          <TableHead className="text-right text-xs">Short Qty</TableHead>
                          <TableHead className="text-right text-xs">Vendor Price</TableHead>
                          <TableHead className="text-right text-xs">Audit Price</TableHead>
                          <TableHead className="text-right text-xs">Diff/unit</TableHead>
                          <TableHead className="text-right text-xs">Debit Amt</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLines.map((l) => (
                          <TableRow
                            key={l.line_index}
                            className={l.has_discrepancy ? "bg-red-50 dark:bg-red-950/20" : undefined}
                          >
                            <TableCell className="font-mono text-xs">{l.line_index}</TableCell>
                            <TableCell className="font-mono text-xs">{l.sku_id ?? "—"}</TableCell>
                            <TableCell className="max-w-[180px] truncate text-xs">{l.sku_description || "—"}</TableCell>
                            <TableCell className="text-right font-mono text-xs tabular-nums">{Number(l.quantity).toFixed(3)}</TableCell>
                            <TableCell className="text-right font-mono text-xs tabular-nums">
                              {Number(l.rejected_quantity) > 0 ? Number(l.rejected_quantity).toFixed(3) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs tabular-nums">
                              {Number(l.short_quantity) > 0 ? Number(l.short_quantity).toFixed(3) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs tabular-nums">
                              {Number(l.vendor_price) > 0 ? `₹${Number(l.vendor_price).toFixed(4)}` : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs tabular-nums">
                              {Number(l.audit_price) > 0 ? `₹${Number(l.audit_price).toFixed(4)}` : "—"}
                            </TableCell>
                            <TableCell className={cn(
                              "text-right font-mono text-xs tabular-nums font-semibold",
                              l.has_discrepancy ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                            )}>
                              {l.has_discrepancy ? `+₹${Number(l.price_diff).toFixed(4)}` : "✓"}
                            </TableCell>
                            <TableCell className={cn(
                              "text-right font-mono text-xs tabular-nums",
                              l.has_discrepancy ? "font-semibold text-red-600 dark:text-red-400" : ""
                            )}>
                              {l.has_discrepancy ? `₹${Number(l.debit_amount).toFixed(2)}` : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : auditLines && auditLines.length === 0 ? (
                    <p className="text-muted-foreground py-8 text-center text-sm">
                      No line items found. Ensure the PO has lines in ZAP (purchase order page) or add GRN lines.
                    </p>
                  ) : (
                    <p className="text-muted-foreground py-8 text-center text-sm">
                      Click the &ldquo;Audit &amp; Debit Note&rdquo; tab to load price data.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Debit note section */}
              <Card className="overflow-hidden border-amber-200 shadow-sm dark:border-amber-800">
                <CardHeader className="border-b bg-gradient-to-r from-amber-50/80 via-muted/20 to-transparent pb-4 dark:from-amber-950/30">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        Debit note
                      </CardTitle>
                      <CardDescription>
                        Auto-generated from lines where vendor overcharged. Export as Tally-compatible CSV.
                      </CardDescription>
                      {debitNote?.status === "ISSUED" || debitNote?.status === "CLOSED" ? (
                        <p className="text-muted-foreground mt-1 text-xs">
                          This note is already {debitNote.status.toLowerCase()}. Regenerate requires confirmation and can replace draft lines.
                        </p>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={generatingNote || !row}
                        onClick={() => row && handleGenerateDebitNote(row.grn_id)}
                      >
                        {generatingNote
                          ? "Generating…"
                          : debitNote?.status === "ISSUED" || debitNote?.status === "CLOSED"
                            ? "Force regenerate"
                            : debitNote
                              ? "Regenerate"
                              : "Generate debit note"}
                      </Button>
                      {debitNote ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={
                            debitNote.status === "ISSUED" ||
                            debitNote.status === "CLOSED" ||
                            exportingTally
                          }
                          onClick={() => row && void handleExportTally(row.grn_id)}
                        >
                          <Download className="mr-1 h-4 w-4" />
                          {exportingTally ? "Exporting…" : "Export for Tally"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>

                {debitNoteLoading ? (
                  <CardContent className="pt-4"><Skeleton className="h-24 w-full" /></CardContent>
                ) : debitNote ? (
                  <CardContent className="space-y-4 pt-4">
                    <dl className="grid gap-2 sm:grid-cols-3">
                      <div className="space-y-0.5">
                        <dt className="text-muted-foreground text-xs">Reference</dt>
                        <dd className="font-mono text-sm font-semibold">{debitNote.note_reference}</dd>
                      </div>
                      <div className="space-y-0.5">
                        <dt className="text-muted-foreground text-xs">Total debit amount</dt>
                        <dd className="font-mono text-sm font-semibold text-red-600 dark:text-red-400">
                          ₹{Number(debitNote.total_debit_amount).toFixed(2)}
                        </dd>
                      </div>
                      <div className="space-y-0.5">
                        <dt className="text-muted-foreground text-xs">Status</dt>
                        <dd>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              debitNote.status === "EXPORTED"
                                ? "border-green-500 text-green-600"
                                : debitNote.status === "ISSUED"
                                ? "border-blue-500 text-blue-600"
                                : "border-amber-500 text-amber-600"
                            )}
                          >
                            {debitNote.status}
                          </Badge>
                        </dd>
                      </div>
                    </dl>

                    {debitNote.narration ? (
                      <p className="text-muted-foreground rounded bg-muted/40 px-3 py-2 text-xs font-mono">
                        {debitNote.narration}
                      </p>
                    ) : null}

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">SKU</TableHead>
                          <TableHead className="text-xs">Description</TableHead>
                          <TableHead className="text-right text-xs">Qty</TableHead>
                          <TableHead className="text-right text-xs">Rejected Qty</TableHead>
                          <TableHead className="text-right text-xs">Short Qty</TableHead>
                          <TableHead className="text-right text-xs">Invoice ₹</TableHead>
                          <TableHead className="text-right text-xs">Audit ₹</TableHead>
                          <TableHead className="text-right text-xs">Diff ₹</TableHead>
                          <TableHead className="text-right text-xs">Debit Amt</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {debitNote.lines.map((l) => (
                          <TableRow key={l.line_index}>
                            <TableCell className="font-mono text-xs">{l.sku_id ?? "—"}</TableCell>
                            <TableCell className="max-w-[160px] truncate text-xs">{l.sku_description || "—"}</TableCell>
                            <TableCell className="text-right font-mono text-xs tabular-nums">{Number(l.quantity).toFixed(3)}</TableCell>
                            <TableCell className="text-right font-mono text-xs tabular-nums">
                              {Number(l.rejected_quantity) > 0 ? Number(l.rejected_quantity).toFixed(3) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs tabular-nums">
                              {Number(l.short_quantity) > 0 ? Number(l.short_quantity).toFixed(3) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs tabular-nums">₹{Number(l.vendor_price).toFixed(4)}</TableCell>
                            <TableCell className="text-right font-mono text-xs tabular-nums">₹{Number(l.audit_price).toFixed(4)}</TableCell>
                            <TableCell className="text-right font-mono text-xs tabular-nums text-red-600 dark:text-red-400">
                              +₹{Number(l.price_diff).toFixed(4)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs tabular-nums font-semibold text-red-600 dark:text-red-400">
                              ₹{Number(l.debit_amount).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/40 font-semibold">
                          <TableCell colSpan={8} className="text-right text-xs">Total</TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums text-red-600 dark:text-red-400">
                            ₹{Number(debitNote.total_debit_amount).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>

                    {debitNote.exported_at ? (
                      <p className="text-muted-foreground text-xs">
                        Last exported {formatDisplayDateTime(debitNote.exported_at)} by {debitNote.generated_by ?? "unknown"}
                      </p>
                    ) : null}

                    {/* DN Number assignment */}
                    <div className="border-t pt-4 space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">DN Number</p>
                      {debitNote.dn_number ? (
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-mono text-sm font-semibold">{debitNote.dn_number}</span>
                          <span className="text-muted-foreground text-xs">
                            Assigned by {debitNote.dn_number_assigned_by ?? "—"}{debitNote.dn_number_assigned_at ? ` · ${formatDisplayDateTime(debitNote.dn_number_assigned_at)}` : ""}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="e.g. DN-2026-001"
                            value={dnNumberInput}
                            onChange={(e) => setDnNumberInput(e.target.value)}
                            className="h-8 w-48 rounded-md border border-input bg-background px-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={assigningDnNumber || !row}
                            onClick={() => row && handleAssignDnNumber(row.grn_id)}
                          >
                            {assigningDnNumber ? "Saving…" : "Assign"}
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* CN Copy upload */}
                    <div className="border-t pt-4 space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vendor CN Copy</p>
                      {debitNote.cn_copy_file_name ? (
                        <div className="flex flex-wrap items-center gap-3">
                          <Badge variant="outline" className="font-mono text-xs">{debitNote.cn_copy_file_name}</Badge>
                          <span className="text-muted-foreground text-xs">
                            {debitNote.cn_copy_uploaded_by ?? "—"}{debitNote.cn_copy_uploaded_at ? ` · ${formatDisplayDateTime(debitNote.cn_copy_uploaded_at)}` : ""}
                          </span>
                          <Badge variant="outline" className="border-violet-400 text-violet-600 dark:text-violet-400 text-xs font-semibold">CLOSED</Badge>
                          {row && (
                            <Button size="sm" variant="outline" onClick={() => void handleDownloadCnCopy(row.grn_id)}>
                              Download CN Copy
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input ref={cnCopyRef} type="file" accept=".pdf,.jpg,.jpeg" className="text-sm" />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={uploadingCnCopy || !row}
                            onClick={() => row && handleUploadCnCopy(row.grn_id)}
                          >
                            {uploadingCnCopy ? "Uploading…" : "Upload CN Copy"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                ) : (
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground text-sm">
                      No debit note generated yet. Click &ldquo;Generate debit note&rdquo; to create one from price discrepancies.
                    </p>
                  </CardContent>
                )}
              </Card>
            </TabsContent>

            {/* ── Accounts approval ───────────────────────────────────────────── */}
            <TabsContent value="accounts" className="mt-4 space-y-4">
              <Card className="overflow-hidden border-primary/15 shadow-sm">
                <CardHeader className="border-b bg-gradient-to-r from-primary/8 via-muted/40 to-transparent pb-4">
                  <CardTitle className="text-base">Accounts approval</CardTitle>
                  <CardDescription>
                    Accounts team reviews the GRN and debit note before inventory is booked.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <dl className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-0.5">
                      <dt className="text-muted-foreground text-xs">Status</dt>
                      <dd>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs font-semibold",
                            row?.accounts_status === "APPROVED"
                              ? "border-green-500 text-green-600 dark:text-green-400"
                              : row?.accounts_status === "REJECTED"
                              ? "border-red-500 text-red-600 dark:text-red-400"
                              : "border-slate-400 text-slate-500"
                          )}
                        >
                          {row?.accounts_status ?? "PENDING"}
                        </Badge>
                      </dd>
                    </div>
                    <div className="space-y-0.5">
                      <dt className="text-muted-foreground text-xs">Actioned by</dt>
                      <dd className="text-sm">{row?.accounts_by ?? "—"}</dd>
                    </div>
                    <div className="space-y-0.5">
                      <dt className="text-muted-foreground text-xs">At</dt>
                      <dd className="text-sm">
                        {row?.accounts_at ? formatDisplayDateTime(row.accounts_at) : "—"}
                      </dd>
                    </div>
                  </dl>

                  {row?.accounts_status !== "APPROVED" && row?.accounts_status !== "REJECTED" ? (
                    <div className="flex gap-3">
                      <Button
                        size="sm"
                        disabled={accountsSubmitting || !row}
                        onClick={() => row && handleAccountsAction(row.grn_id, "APPROVED")}
                        className="bg-green-600 text-white hover:bg-green-700"
                      >
                        {accountsSubmitting ? "Saving…" : "Approve"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={accountsSubmitting || !row}
                        onClick={() => row && handleAccountsAction(row.grn_id, "REJECTED")}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      {row?.accounts_status === "APPROVED"
                        ? "GRN is approved by accounts. Proceed to Inventory Receipt tab."
                        : "GRN was rejected by accounts."}
                    </p>
                  )}

                  {row?.grn_invoice_collection_status === "COLLECTED" ? (
                    <div className="border-t pt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const token = getStoredToken();
                          const url = apiUrl(`/api/inbound/grns/${row.grn_id}/invoice-export`);
                          const a = document.createElement("a");
                          a.href = token ? `${url}?token=${encodeURIComponent(token)}` : url;
                          a.download = "";
                          a.click();
                        }}
                      >
                        <Download className="size-4 mr-1" />
                        Download Invoice Excel
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Inventory receipt ───────────────────────────────────────────── */}
            <TabsContent value="inventory" className="mt-4 space-y-4">
              <Card className="overflow-hidden border-primary/15 shadow-sm">
                <CardHeader className="border-b bg-gradient-to-r from-primary/8 via-muted/40 to-transparent pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Inventory receipt</CardTitle>
                      <CardDescription>
                        Map each accepted SKU to a target bin and book quantities into the warehouse.
                        Accounts approval is required first.
                      </CardDescription>
                    </div>
                    {row?.inventory_receipt_status === "DONE" ? (
                      <Badge variant="outline" className="border-green-500 text-green-600 dark:text-green-400">
                        Received {row.inventory_receipt_at ? formatDisplayDateTime(row.inventory_receipt_at) : ""}
                      </Badge>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  {row?.accounts_status !== "APPROVED" ? (
                    <p className="text-muted-foreground py-8 text-center text-sm">
                      Accounts must approve this GRN before inventory can be booked.
                    </p>
                  ) : receiptDone && receiptDone.length > 0 ? (
                    <div className="space-y-3">
                      <p className="font-medium text-green-600 dark:text-green-400">
                        Inventory booked successfully.
                      </p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">SKU</TableHead>
                            <TableHead className="text-xs">Bin</TableHead>
                            <TableHead className="text-right text-xs">New Qty</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {receiptDone.map((r, idx) => (
                            <TableRow key={`${r.sku_id}-${r.bin_id}-${idx}`}>
                              <TableCell className="font-mono text-xs">{r.sku_id}</TableCell>
                              <TableCell className="font-mono text-xs">{r.bin_id}</TableCell>
                              <TableCell className="text-right font-mono text-xs tabular-nums">{r.new_quantity}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : row?.inventory_receipt_status === "DONE" ? (
                    <div className="space-y-2 py-4">
                      <p className="font-medium text-green-600 dark:text-green-400">
                        Inventory receipt is complete for this GRN.
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {row.inventory_receipt_at
                          ? `Booked ${formatDisplayDateTime(row.inventory_receipt_at)}`
                          : "Stock was booked into bins from a previous session."}
                        {row.inventory_receipt_by ? ` · ${row.inventory_receipt_by}` : ""}
                      </p>
                    </div>
                  ) : receiptItems.length === 0 ? (
                    <p className="text-muted-foreground py-8 text-center text-sm">
                      No GRN line items found. Load PO lines in ZAP or add lines to this GRN.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">SKU</TableHead>
                            <TableHead className="text-xs">Description</TableHead>
                            <TableHead className="text-right text-xs">Accepted Qty</TableHead>
                            <TableHead className="text-right text-xs">Booked Σ</TableHead>
                            <TableHead className="text-xs min-w-[220px]">Target Bin ID</TableHead>
                            <TableHead className="text-xs w-28">Qty to Book</TableHead>
                            <TableHead className="w-10 text-xs text-center"> </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {receiptItems.map((item, idx) => {
                            const lineRows = receiptItems.filter((i) => i.line_index === item.line_index);
                            const lineBooked = sumBookedLineTotal(receiptItems, item.line_index);
                            const maxQty = maxBookableForRow(receiptItems, item);
                            const skuBins = binsBySku[item.sku_id] ?? [];
                            const isLastForLine =
                              idx === receiptItems.length - 1 ||
                              receiptItems[idx + 1]?.line_index !== item.line_index;
                            const remainderLine = Math.max(0, item.accepted_qty - lineBooked);
                            const binInList =
                              item.bin_id.trim() !== "" &&
                              skuBins.some((b) => b.bin_id === item.bin_id.trim());
                            const effectiveCustom =
                              item.bin_entry_mode === "custom" ||
                              (item.bin_id.trim() !== "" && !binInList);
                            const selectValue = effectiveCustom
                              ? "__custom__"
                              : item.bin_id.trim() && binInList
                                ? item.bin_id.trim()
                                : "";
                            return (
                              <TableRow key={item.row_key}>
                                <TableCell className="font-mono text-xs">{item.sku_id}</TableCell>
                                <TableCell className="max-w-[160px] truncate text-xs">
                                  {item.sku_description || "—"}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs tabular-nums">
                                  {item.accepted_qty}
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    "text-right font-mono text-xs tabular-nums",
                                    lineBooked > item.accepted_qty + 1e-6 && "text-destructive"
                                  )}
                                >
                                  {lineBooked}
                                  <span className="text-muted-foreground"> / {item.accepted_qty}</span>
                                </TableCell>
                                <TableCell>
                                  <div className="flex min-w-0 flex-col gap-1.5">
                                    <select
                                      disabled={binsLoading}
                                      aria-label="Target bin"
                                      value={selectValue}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        const next = [...receiptItems];
                                        if (v === "__custom__") {
                                          next[idx] = {
                                            ...next[idx],
                                            bin_entry_mode: "custom",
                                            bin_id: "",
                                          };
                                        } else if (v === "") {
                                          next[idx] = {
                                            ...next[idx],
                                            bin_entry_mode: "dropdown",
                                            bin_id: "",
                                          };
                                        } else {
                                          next[idx] = {
                                            ...next[idx],
                                            bin_entry_mode: "dropdown",
                                            bin_id: v,
                                          };
                                        }
                                        setReceiptItems(next);
                                      }}
                                      className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                                    >
                                      <option value="">
                                        {binsLoading ? "Loading bins…" : "Select bin…"}
                                      </option>
                                      {skuBins.map((b) => (
                                        <option key={`${b.bin_id}-${b.warehouse_id}`} value={b.bin_id}>
                                          {b.bin_id} · WH {b.warehouse_id} · avail {b.available_quantity}
                                        </option>
                                      ))}
                                      <option value="__custom__">Other (enter bin ID)…</option>
                                    </select>
                                    {effectiveCustom ? (
                                      <Input
                                        placeholder="Exact bin ID"
                                        value={item.bin_id}
                                        onChange={(e) => {
                                          const next = [...receiptItems];
                                          next[idx] = { ...next[idx], bin_id: e.target.value };
                                          setReceiptItems(next);
                                        }}
                                        className="h-7 font-mono text-xs"
                                      />
                                    ) : null}
                                    {!binsLoading && skuBins.length === 0 ? (
                                      <p className="text-muted-foreground text-[11px] leading-snug">
                                        No bins list for this SKU yet. Use &quot;Other&quot; if the bin already
                                        exists in Bins.
                                      </p>
                                    ) : null}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <input
                                    type="number"
                                    min={0}
                                    max={maxQty}
                                    value={item.quantity}
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      const n = Number(raw);
                                      const next = [...receiptItems];
                                      const clamped =
                                        raw === "" || !Number.isFinite(n)
                                          ? raw
                                          : String(Math.min(Math.max(0, n), maxQty));
                                      next[idx] = { ...next[idx], quantity: clamped };
                                      setReceiptItems(next);
                                    }}
                                    className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
                                  />
                                  <p className="text-muted-foreground mt-0.5 text-[11px] tabular-nums">
                                    max {maxQty}
                                  </p>
                                </TableCell>
                                <TableCell className="text-center align-top pt-3">
                                  <div className="flex flex-col items-center gap-1">
                                    {lineRows.length > 1 && item.row_key !== lineRows[0]?.row_key ? (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 shrink-0"
                                        title="Remove this bin row"
                                        onClick={() => removeSplitRow(item.row_key)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                      </Button>
                                    ) : null}
                                    {isLastForLine && remainderLine > 0 ? (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 shrink-0"
                                        title="Put remaining quantity in another bin"
                                        onClick={() => addSplitRowForLine(item.line_index)}
                                      >
                                        <Plus className="h-3.5 w-3.5" aria-hidden />
                                      </Button>
                                    ) : null}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          disabled={receiptSubmitting || !row}
                          onClick={() => row && handleReceiveInventory(row.grn_id)}
                        >
                          {receiptSubmitting ? "Booking…" : "Book to Inventory"}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>
        </>
      ) : null}
    </div>
  );
}
