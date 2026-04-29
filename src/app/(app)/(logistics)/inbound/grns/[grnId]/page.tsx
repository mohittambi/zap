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
import { cn } from "@/lib/utils";
import { Download } from "lucide-react";

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

function formatDisplayDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return displayFormatter.format(d);
}

function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  const s = String(iso);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  return formatDisplayDateTime(iso);
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
  for (const nestKey of ["pendency", "pendency_object", "Pendency"]) {
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

const GRN_ITEM_KEYS = {
  sku: ADDED_ITEM_KEYS.sku,
  title: ADDED_ITEM_KEYS.title,
  invoice: ADDED_ITEM_KEYS.invoice,
  accepted: ADDED_ITEM_KEYS.accepted,
  rejected: ADDED_ITEM_KEYS.rejected,
  shortage: ADDED_ITEM_KEYS.shortage,
  listed: [
    "listed_quantity",
    "listedQuantity",
    "listing_quantity",
    "quantity_listed",
  ],
};

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

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-2 py-4 md:px-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href="/inbound/grns">← All GRNs</Link>
        </Button>
      </div>

      <AppPageTitle
        title={loading ? "GRN" : row ? `GRN ${row.grn_id}` : "GRN"}
        description="Goods receipt note — synced into Zap and cached in the database."
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
              This GRN is missing or you do not have access. Sync with{" "}
              <code className="text-xs">npm run sync:grns:all</code>, then open
              again.
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
          <div className="grid gap-4 md:grid-cols-3">
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
                    {formatDateOnly(snap?.po_release_date)}
                  </Field>
                  <Field label="Expiry / expected">
                    {formatDateOnly(snap?.po_expiry_date)}
                  </Field>
                  <Field label="Created by">
                    {snap?.po_created_by ?? "—"}
                  </Field>
                </dl>
              </CardContent>
            </Card>

            <Card className="border-primary/10 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">GRN</CardTitle>
                <CardDescription>Receipt summary</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-3">
                  <Field label="Box count (invoice)">
                    {snap?.grn_box_count_invoice ?? row.box_count_invoice}
                  </Field>
                  <Field label="Actual boxes received">
                    {snap?.grn_actual_boxes ?? row.actual_box_count_recieved}
                  </Field>
                  <Field label="GRN SKU count">{row.grn_sku_count}</Field>
                  <Field label="Invoice qty">{row.grn_invoice_quantity}</Field>
                  <Field label="Accepted">{row.grn_accepted_quantity}</Field>
                  <Field label="Rejected">{row.grn_rejected_quantity}</Field>
                  <Field label="Shortage">{row.grn_shortage_quantity}</Field>
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
          </div>

          <Card className="border-primary/10 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Added items (PO + pendency)</CardTitle>
              <CardDescription>
                From{" "}
                <code className="text-xs">
                  /purchase_orders/addedItems/withListing/withPendency/
                </code>
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-[420px] overflow-auto">
              {bundle.added_items.length === 0 ? (
                <p className="text-muted-foreground text-sm">No rows ingested.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Ordered</TableHead>
                      <TableHead className="text-right">Pendency</TableHead>
                      <TableHead className="text-right">Invoice</TableHead>
                      <TableHead className="text-right">Accepted</TableHead>
                      <TableHead className="text-right">Rejected</TableHead>
                      <TableHead className="text-right">Shortage</TableHead>
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
                From{" "}
                <code className="text-xs">
                  /purchase_orders/grn/items/withListing/
                </code>
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-[420px] overflow-auto">
              {bundle.grn_items.length === 0 ? (
                <p className="text-muted-foreground text-sm">No rows ingested.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Listed</TableHead>
                      <TableHead className="text-right">Invoice</TableHead>
                      <TableHead className="text-right">Accepted</TableHead>
                      <TableHead className="text-right">Rejected</TableHead>
                      <TableHead className="text-right">Shortage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bundle.grn_items.map((line) => (
                      <TableRow key={line.line_index}>
                        <TableCell className="text-muted-foreground text-xs">
                          {line.line_index + 1}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {line.sku_id ?? pickLine(line.raw, GRN_ITEM_KEYS.sku)}
                        </TableCell>
                        <TableCell className="max-w-[220px] text-xs">
                          {pickLine(line.raw, GRN_ITEM_KEYS.title)}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {pickLine(line.raw, GRN_ITEM_KEYS.listed)}
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {snap?.synced_at ? (
            <p className="text-muted-foreground text-center text-xs">
              Detail snapshot synced at {formatDisplayDateTime(snap.synced_at)}
            </p>
          ) : null}
            </TabsContent>

            <TabsContent value="documents" className="mt-4 space-y-6">
              <Card className="border-primary/10 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">GRN summary</CardTitle>
                  <CardDescription>
                    Quantities and identifiers (from synced header / live GRN API).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <Field label="Number of SKUs in GRN">{row.grn_sku_count}</Field>
                    <Field label="PO Number">
                      <Link
                        href={`/inbound/vendors/${row.vendor_id}/purchase-orders/${row.po_id}`}
                        className="text-primary font-medium underline-offset-4 hover:underline"
                      >
                        {row.po_id}
                      </Link>
                    </Field>
                    <Field label="GRN Invoice Quantity">{row.grn_invoice_quantity}</Field>
                    <Field label="GRN Number">{row.grn_id}</Field>
                    <Field label="GRN Accepted Quantity">{row.grn_accepted_quantity}</Field>
                    <Field label="Vendor Invoice Number">
                      {row.vendor_invoice_number ?? "—"}
                    </Field>
                    <Field label="GRN Rejected Quantity">{row.grn_rejected_quantity}</Field>
                    <Field label="Invoice Collection Status">
                      <span
                        className={invoiceCollectionClass(
                          row.grn_invoice_collection_status
                        )}
                      >
                        {row.grn_invoice_collection_status ?? "—"}
                      </span>
                    </Field>
                    <Field label="GRN Shortage Quantity">{row.grn_shortage_quantity}</Field>
                    <Field label="Invoice Collected By">
                      {row.grn_invoice_collection_by ?? "—"}
                    </Field>
                    {pickPoRaw(snap, "status") ? (
                      <Field label="PO status (cached)">{pickPoRaw(snap, "status")}</Field>
                    ) : null}
                    {pickPoRaw(snap, "sku_fill_rate") ? (
                      <Field label="PO SKU fill rate %">
                        {pickPoRaw(snap, "sku_fill_rate")}
                      </Field>
                    ) : null}
                  </dl>
                </CardContent>
              </Card>

              <Card className="border-primary/10 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Vendor Invoice</CardTitle>
                  <CardDescription>
                    Files from{" "}
                    <code className="text-xs">/purchase_orders/grn/invoice_files/</code>
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {bundle.invoice_files.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No invoice files ingested.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">File ID</TableHead>
                          <TableHead>File Type</TableHead>
                          <TableHead>Uploaded At</TableHead>
                          <TableHead>Uploaded By</TableHead>
                          <TableHead>File Name</TableHead>
                          <TableHead className="text-center">Invoice file</TableHead>
                          <TableHead className="text-center">Invoice data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bundle.invoice_files.map((f) => {
                          const fileHref =
                            f.download_url ??
                            `/api/inbound/grns/${row.grn_id}/files/${f.file_id}?kind=invoice`;
                          return (
                            <TableRow key={f.file_id}>
                              <TableCell className="font-mono text-xs">{f.file_id}</TableCell>
                              <TableCell>{f.file_type ?? "—"}</TableCell>
                              <TableCell className="whitespace-nowrap text-xs">
                                {formatDisplayDateTime(f.uploaded_at)}
                              </TableCell>
                              <TableCell>{f.uploaded_by ?? "—"}</TableCell>
                              <TableCell className="max-w-[200px] truncate">
                                {f.file_name ?? "—"}
                              </TableCell>
                              <TableCell className="text-center">
                                <a
                                  href={fileHref}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Download uploaded invoice file"
                                  className="text-primary inline-flex justify-center p-1 hover:opacity-80"
                                >
                                  <Download className="size-4" />
                                </a>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-center text-xs">
                                —
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card className="border-primary/10 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Debit / Credit Notes</CardTitle>
                  <CardDescription>
                    From{" "}
                    <code className="text-xs">
                      /purchase_orders/grn/debit_credit_notes/
                    </code>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {(bundle.debit_credit_notes ?? []).length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      No debit/credit notes ingested for this GRN.
                    </p>
                  ) : (
                    <>
                    {(bundle.debit_credit_notes ?? []).map((note) => (
                      <div key={note.note_id} className="space-y-3">
                        <div className="overflow-x-auto rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>GRN ID</TableHead>
                                <TableHead>PO Number</TableHead>
                                <TableHead>GRN Status</TableHead>
                                <TableHead>GRN Audit Status</TableHead>
                                <TableHead>Vendor Inv. #</TableHead>
                                <TableHead>Box count (inv.)</TableHead>
                                <TableHead>Actual boxes</TableHead>
                                <TableHead>GRN audited by</TableHead>
                                <TableHead>Credit/Debit Note</TableHead>
                                <TableHead>Note status</TableHead>
                                <TableHead>Note number</TableHead>
                                <TableHead># assignment</TableHead>
                                <TableHead>Upload status</TableHead>
                                <TableHead>Uploaded by</TableHead>
                                <TableHead>Reverse #</TableHead>
                                <TableHead>Reverse upload</TableHead>
                                <TableHead>Reverse by</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell className="font-mono text-xs">{note.grn_id}</TableCell>
                                <TableCell>
                                  <Link
                                    href={`/inbound/vendors/${row.vendor_id}/purchase-orders/${note.po_id ?? row.po_id}`}
                                    className="text-primary text-xs underline-offset-4 hover:underline"
                                  >
                                    {note.po_id ?? row.po_id}
                                  </Link>
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    "text-xs",
                                    statusClosedClass(note.grn_status)
                                  )}
                                >
                                  {note.grn_status ?? "—"}
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    "text-xs",
                                    statusClosedClass(note.grn_audit_status)
                                  )}
                                >
                                  {note.grn_audit_status ?? "—"}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {note.vendor_invoice_number ?? "—"}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {note.box_count_invoice ?? "—"}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {note.actual_box_count_recieved ?? "—"}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {note.grn_audit_by ?? "—"}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {formatNoteType(note.credit_debit_note_type)}
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    "text-xs",
                                    debitNoteGoodClass(note.credit_debit_note_status)
                                  )}
                                >
                                  {note.credit_debit_note_status ?? "—"}
                                </TableCell>
                                <TableCell className="max-w-[140px] truncate text-xs">
                                  {note.credit_debit_note_number ?? "—"}
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    "text-xs",
                                    debitNoteGoodClass(
                                      note.credit_debit_note_number_assignment_status
                                    )
                                  )}
                                >
                                  {note.credit_debit_note_number_assignment_status ?? "—"}
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    "text-xs",
                                    debitNoteGoodClass(note.credit_debit_note_upload_status),
                                    debitNoteBadClass(note.credit_debit_note_upload_status)
                                  )}
                                >
                                  {note.credit_debit_note_upload_status ?? "—"}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {note.credit_debit_note_uploaded_by ?? "—"}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {note.reverse_credit_debit_note_number ?? "—"}
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    "text-xs",
                                    debitNoteBadClass(
                                      note.reverse_credit_debit_note_upload_status
                                    ),
                                    debitNoteGoodClass(
                                      note.reverse_credit_debit_note_upload_status
                                    )
                                  )}
                                >
                                  {note.reverse_credit_debit_note_upload_status ?? "—"}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {note.reverse_credit_debit_note_uploaded_by ?? "—"}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>

                        <div>
                          <h4 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                            Debit/Credit Note Files
                          </h4>
                          {note.files.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No files on this note.</p>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-16">File ID</TableHead>
                                  <TableHead>File Type</TableHead>
                                  <TableHead>Uploaded At</TableHead>
                                  <TableHead>Uploaded By</TableHead>
                                  <TableHead>File Name</TableHead>
                                  <TableHead className="text-center">Download</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {note.files.map((f) => {
                                  const href =
                                    f.download_url ??
                                    `/api/inbound/grns/${row.grn_id}/files/${f.file_id}?kind=debit_note&noteId=${note.note_id}`;
                                  return (
                                    <TableRow key={f.file_id}>
                                      <TableCell className="font-mono text-xs">
                                        {f.file_id}
                                      </TableCell>
                                      <TableCell className="text-xs">{f.file_type ?? "—"}</TableCell>
                                      <TableCell className="whitespace-nowrap text-xs">
                                        {formatDisplayDateTime(f.uploaded_at)}
                                      </TableCell>
                                      <TableCell className="text-xs">
                                        {f.uploaded_by ?? "—"}
                                      </TableCell>
                                      <TableCell className="max-w-[200px] truncate text-xs">
                                        {f.file_name ?? "—"}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <a
                                          href={href}
                                          target="_blank"
                                          rel="noreferrer"
                                          title="Download file"
                                          className="text-primary inline-flex justify-center p-1 hover:opacity-80"
                                        >
                                          <Download className="size-4" />
                                        </a>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      </div>
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
                            toast.success("File uploaded to Zap Storage");
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
                      title="Upload reverse debit/credit note file to Zap Storage"
                      onClick={() => dcUploadRef.current?.click()}
                    >
                      {dcUploading ? "Uploading…" : "Upload Reverse Debit/Credit Note"}
                    </Button>
                    <div>
                      <h4 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                        Prepared downloadables
                      </h4>
                      <p className="text-muted-foreground text-sm">
                        Debit/Credit note data (.csv) is not included in the ingested API
                        payloads. Export from the source system if available.
                      </p>
                    </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="logs" className="mt-4 space-y-4">
              <p className="text-muted-foreground text-sm font-medium">GRN — {row.grn_id}</p>
              <Card className="border-primary/10 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">GRN Logs</CardTitle>
                  <CardDescription>
                    From{" "}
                    <code className="text-xs">/purchase_orders/grn/logs/{row.grn_id}</code> — synced
                    with GRN detail ingest.
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {(bundle.grn_logs ?? []).length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      No log rows ingested. Run{" "}
                      <code className="text-xs">npm run sync:grn:details -- --grn {row.grn_id}</code>{" "}
                      or open this page with refresh after migration 032.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Operation</TableHead>
                          <TableHead className="whitespace-nowrap">PO Number</TableHead>
                          <TableHead className="whitespace-nowrap">Vendor ID</TableHead>
                          <TableHead className="whitespace-nowrap">Foreign Key</TableHead>
                          <TableHead className="whitespace-nowrap">SKU Id</TableHead>
                          <TableHead className="text-right whitespace-nowrap">
                            Invoice Qty
                          </TableHead>
                          <TableHead className="text-right whitespace-nowrap">
                            Accepted Qty
                          </TableHead>
                          <TableHead className="text-right whitespace-nowrap">
                            Rejected Qty
                          </TableHead>
                          <TableHead className="text-right whitespace-nowrap">
                            Received Price
                          </TableHead>
                          <TableHead className="min-w-[200px]">Remarks</TableHead>
                          <TableHead className="whitespace-nowrap">Created By</TableHead>
                          <TableHead className="whitespace-nowrap">Created At</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(bundle.grn_logs ?? []).map((log) => (
                          <TableRow key={log.log_id}>
                            <TableCell className="text-xs">
                              {pickLogField(log.log_type, log.raw, [
                                "log_type",
                                "logType",
                                "type",
                              ])}
                            </TableCell>
                            <TableCell className="max-w-[200px] text-xs">
                              {formatLogOperation(
                                log.operation_performed ??
                                  (typeof log.raw?.operation_performed === "string"
                                    ? log.raw.operation_performed
                                    : null)
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {pickLogField(log.po_id, log.raw, ["po_id", "poId"])}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {pickLogField(log.vendor_id, log.raw, ["vendor_id", "vendorId"])}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {pickLogField(log.foreign_key, log.raw, [
                                "foreign_key",
                                "foreignKey",
                                "grn_id",
                              ])}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {pickLogField(log.sku_id, log.raw, [
                                "sku_id",
                                "skuId",
                                "SKU_ID",
                              ])}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {pickLogField(log.invoice_quantity, log.raw, [
                                "invoice_quantity",
                                "invoiceQuantity",
                              ])}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {pickLogField(log.accepted_quantity, log.raw, [
                                "accepted_quantity",
                                "acceptedQuantity",
                              ])}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {pickLogField(log.rejected_quantity, log.raw, [
                                "rejected_quantity",
                                "rejectedQuantity",
                              ])}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {pickLogField(log.received_price, log.raw, [
                                "received_price",
                                "receivedPrice",
                              ])}
                            </TableCell>
                            <TableCell className="max-w-[280px] text-xs break-words">
                              {pickLogField(log.remarks, log.raw, ["remarks", "remark"])}
                            </TableCell>
                            <TableCell className="text-xs">
                              {pickLogField(log.created_by, log.raw, ["created_by", "createdBy"])}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs">
                              {formatDisplayDateTime(log.created_at)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
