"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { apiFetch, apiUrl, getStoredToken } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import { Download, FileText, PanelRightOpen } from "lucide-react";

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

function GrnInputStatBox({
  label,
  value,
  className,
  valueClassName,
}: {
  label: string;
  value: string;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[52px] min-w-[96px] flex-1 flex-col justify-center rounded-md border-2 border-foreground/15 bg-background px-2 py-1.5 shadow-sm",
        className
      )}
    >
      <span className="text-[10px] leading-tight font-medium text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-sm tabular-nums font-semibold",
          valueClassName
        )}
      >
        {value}
      </span>
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
  grn_items: LineRow[];
  added_items: LineRow[];
  selectedLine: LineRow | null;
  onSelectLine: (line: LineRow) => void;
  grnTitle: string;
}) {
  const {
    open,
    onOpenChange,
    grn_items,
    added_items,
    selectedLine,
    onSelectLine,
    grnTitle,
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

  const raw = selectedLine?.raw ?? null;
  const listing = raw ? listingFromLineRaw(raw) : null;
  const thumbs = listingThumbUrls(listing);
  const title =
    listing && pickLine(listing, ADDED_ITEM_KEYS.title) !== "—"
      ? pickLine(listing, ADDED_ITEM_KEYS.title)
      : "—";

  const totalDemand = added ? parseLineQty(added.raw, DEMAND_KEYS) : 0;
  const pendency = added ? parseLineQty(added.raw, ADDED_ITEM_KEYS.pendency) : 0;
  const lineInv = raw ? parseLineQty(raw, GRN_ITEM_KEYS.invoice) : 0;
  const lineAcc = raw ? parseLineQty(raw, GRN_ITEM_KEYS.accepted) : 0;
  const lineRej = raw ? parseLineQty(raw, GRN_ITEM_KEYS.rejected) : 0;
  const lineShort = raw ? parseLineQty(raw, GRN_ITEM_KEYS.shortage) : 0;
  const linePrice = raw ? parseLineQty(raw, GRN_ITEM_KEYS.receivedPrice) : 0;
  const lineTax = raw ? parseLineQty(raw, GRN_ITEM_KEYS.taxRate) : 0;
  const lineAuditPrice = raw ? parseLineQty(raw, GRN_ITEM_KEYS.auditPriceExclGst) : 0;

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

          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 space-y-5">
            {!selectedLine ? (
              <p className="text-muted-foreground text-sm">Select a line item.</p>
            ) : (
              <>
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
                        <dt className="text-muted-foreground text-xs">
                          Warehouse Quantity
                        </dt>
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
                  <div className="flex flex-wrap gap-2">
                    <GrnInputStatBox
                      label="Quantity in Invoice"
                      value={fmtInboundQty(lineInv)}
                      valueClassName="text-violet-700 dark:text-violet-300"
                    />
                    <GrnInputStatBox
                      label="Accepted Quantity"
                      value={fmtInboundQty(lineAcc)}
                      valueClassName="text-emerald-700 dark:text-emerald-400"
                    />
                    <GrnInputStatBox
                      label="Rejected Quantity"
                      value={fmtInboundQty(lineRej)}
                      valueClassName="text-red-600"
                    />
                    <GrnInputStatBox
                      label="Short Quantity"
                      value={fmtInboundQty(lineShort)}
                      className="border-blue-300/80"
                      valueClassName="text-blue-700 dark:text-blue-300"
                    />
                    <GrnInputStatBox
                      label="Product Price (excl. Taxes)"
                      value={fmtInboundQty(linePrice)}
                    />
                    <GrnInputStatBox
                      label="Tax Rate"
                      value={lineTax > 0 ? String(lineTax) : "—"}
                    />
                    <GrnInputStatBox
                      label="Audited Price (excl. Taxes)"
                      value={lineAuditPrice > 0 ? fmtInboundQty(lineAuditPrice) : "—"}
                      className="border-amber-300/70 bg-amber-50 dark:bg-amber-950/30"
                      valueClassName="text-amber-950 dark:text-amber-100"
                    />
                  </div>
                </section>

                <section className="space-y-2">
                  <div className="bg-sky-100/80 px-2 py-1.5 font-semibold text-sky-950 text-xs uppercase tracking-wide dark:bg-sky-950/50 dark:text-sky-100">
                    Vendor billing summary
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    Only GRNs whose status and audit are CLOSED — rollups from inbound_grn_items in
                    this workspace.
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
                  <p className="text-muted-foreground text-[11px]">
                    Only the most recent 30 GRNs whose audit status has been marked as closed and
                    whose GRN status is CLOSED — ordered by GRN date (newest first).
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
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function InboundGrnDetailPage() {
  const params = useParams();
  const grnId = typeof params.grnId === "string" ? params.grnId : "";
  const [bundle, setBundle] = React.useState<GrnDetailsBundle | null>(null);
  const [loading, setLoading] = React.useState(true);
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
          `/api/inbound/grns/${grnId}/details?refresh=1`
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

  const row = bundle?.header ?? null;
  const snap = bundle?.snapshot ?? null;

  const [grnSkuSheetOpen, setGrnSkuSheetOpen] = React.useState(false);
  const [grnSkuSelectedLine, setGrnSkuSelectedLine] =
    React.useState<LineRow | null>(null);

  function openGrnSkuSheet(line: LineRow) {
    setGrnSkuSelectedLine(line);
    setGrnSkuSheetOpen(true);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-2 py-4 md:px-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href="/inbound/grns">← All GRNs</Link>
        </Button>
      </div>

      <AppPageTitle
        title={loading ? "GRN" : row ? `GRN ${row.grn_id}` : "GRN"}
        description="Receipt details, documents, and activity for this goods receipt note."
      />

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
          </div>

          <Tabs defaultValue="details" className="w-full">
            <TabsList
              variant="line"
              className="mb-2 w-full flex-wrap justify-start sm:w-auto"
            >
              <TabsTrigger value="details">GRN Details</TabsTrigger>
              <TabsTrigger value="documents">GRN Documents</TabsTrigger>
              <TabsTrigger value="logs">GRN Logs</TabsTrigger>
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
            grn_items={bundle.grn_items}
            added_items={bundle.added_items}
            selectedLine={grnSkuSelectedLine}
            onSelectLine={setGrnSkuSelectedLine}
            grnTitle={`GRN #${row.grn_id}`}
          />

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
                    PDF / images uploaded against this vendor invoice — download or archive.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
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
                            const fd = new FormData();
                            fd.set("file", file);
                            fd.set("kind", "debit_note");
                            fd.set("noteId", "-1");
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
          </Tabs>
        </>
      ) : null}
    </div>
  );
}
