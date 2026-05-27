"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, TruckIcon, FileTextIcon, CalendarIcon, Upload, Download } from "lucide-react";
import { apiFetch, apiUrl, getStoredToken } from "@/lib/api-browser";
import { CompanyNameWithLogo } from "@/components/company/company-logo";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { ConsignmentLineItemsEditor } from "@/components/outbound/consignment-line-items-editor";
import { ConsignmentLineItemsTabViews } from "@/components/outbound/consignment-line-items-tab-views";
import { isConsignmentLinesLocked } from "@/lib/outbound-consignment-status";
import { ConsignmentPoLineItems } from "@/components/outbound/consignment-po-line-items";
import { MarkConsignmentRtdDialog } from "@/components/outbound/mark-consignment-rtd-dialog";
import type { OutboundConsignmentRow } from "@/server/services/outboundConsignmentsService";

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function fmt(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return dateFormatter.format(d);
}

function StatTile({
  label,
  value,
  highlight = false,
}: Readonly<{
  label: string;
  value: string | number | null | undefined;
  highlight?: boolean;
}>) {
  const display = value != null && value !== "" ? String(value) : "—";
  return (
    <div className={cn("rounded-lg border p-3", highlight ? "bg-primary/5" : "bg-muted/50")}>
      <p className="text-muted-foreground mb-1 text-[10px] font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className="font-mono text-lg font-bold">{display}</p>
    </div>
  );
}

function MetaRow({ label, value, mono = false }: Readonly<{ label: string; value: string | null | undefined; mono?: boolean }>) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground shrink-0 text-xs font-medium">{label}</span>
      <span className={cn("text-right break-all", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}

function InvoiceNumberRow({
  current,
  inputVal,
  saving,
  onChange,
  onSave,
}: Readonly<{
  current: string | null;
  inputVal: string;
  saving: boolean;
  onChange: (v: string) => void;
  onSave: () => void;
}>) {
  if (current) return <MetaRow label="Invoice Number" value={current} mono />;
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-muted-foreground shrink-0 text-xs font-medium">Invoice Number</span>
      <div className="flex items-center gap-2">
        <Input
          value={inputVal}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter invoice number"
          className="h-7 w-44 text-xs font-mono"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={saving || !inputVal.trim()}
          onClick={onSave}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function statusVariant(s: string | null): "default" | "secondary" | "destructive" | "outline" {
  if (!s) return "outline";
  const l = s.toLowerCase();
  if (l.includes("cancel") || l.includes("fail")) return "destructive";
  if (l.includes("deliver") || l.includes("complet") || l.includes("rtd")) return "default";
  if (l.includes("pending") || l.includes("transit")) return "secondary";
  return "outline";
}

export function ConsignmentDetailClient({ id }: Readonly<{ id: string }>) {
  const [loading, setLoading] = React.useState(true);
  const [row, setRow] = React.useState<OutboundConsignmentRow | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const invoiceFileRef = React.useRef<HTMLInputElement>(null);
  const [uploadingInvoice, setUploadingInvoice] = React.useState(false);
  const [invoiceNumInput, setInvoiceNumInput] = React.useState("");
  const [savingInvoiceNum, setSavingInvoiceNum] = React.useState(false);
  const [downloadingExcel, setDownloadingExcel] = React.useState(false);
  const [rtdDialogOpen, setRtdDialogOpen] = React.useState(false);
  const { hasPermission } = useAuth();
  const canWritePo = hasPermission("purchase_orders", "write");

  async function handleDownloadInvoice() {
    try {
      const { url } = await apiFetch<{ url: string }>(`/api/outbound/consignments/${encodeURIComponent(id)}/invoice`);
      window.open(url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  }

  function handleUploadInvoice() {
    const file = invoiceFileRef.current?.files?.[0];
    if (!file) { toast.error("Select a file first"); return; }
    setUploadingInvoice(true);
    const fd = new FormData();
    fd.append("file", file);
    apiFetch<{ ok: boolean }>(`/api/outbound/consignments/${encodeURIComponent(id)}/invoice-upload`, { method: "POST", body: fd })
      .then(() => {
        toast.success("Invoice uploaded");
        if (invoiceFileRef.current) invoiceFileRef.current.value = "";
        return apiFetch<OutboundConsignmentRow>(`/api/outbound/consignments/${encodeURIComponent(id)}`);
      })
      .then((updated) => setRow(updated))
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Upload failed"))
      .finally(() => setUploadingInvoice(false));
  }

  async function handleSaveInvoiceNumber() {
    const num = invoiceNumInput.trim();
    setSavingInvoiceNum(true);
    try {
      await apiFetch(`/api/outbound/consignments/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ field: "invoice_number", value: num || null }),
      });
      toast.success(num ? "Invoice number saved" : "Invoice number cleared");
      setInvoiceNumInput("");
      const updated = await apiFetch<OutboundConsignmentRow>(`/api/outbound/consignments/${encodeURIComponent(id)}`);
      setRow(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingInvoiceNum(false);
    }
  }

  async function handleDownloadExcel() {
    setDownloadingExcel(true);
    try {
      const token = getStoredToken();
      const headers = new Headers();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const res = await fetch(apiUrl(`/api/outbound/consignments/${encodeURIComponent(id)}/invoice-excel`), { headers });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? res.statusText);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Consignment-${id}-invoice.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloadingExcel(false);
    }
  }

  async function refreshConsignmentData() {
    try {
      const updated = await apiFetch<OutboundConsignmentRow>(
        `/api/outbound/consignments/${encodeURIComponent(id)}`
      );
      setRow(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refresh failed");
    }
  }

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const data = await apiFetch<OutboundConsignmentRow>(
          `/api/outbound/consignments/${encodeURIComponent(id)}`
        );
        if (!cancelled) setRow(data);
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Failed to load");
          setRow(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 px-2 py-8 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading consignment…
      </div>
    );
  }

  if (err || !row) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-2 py-6">
        <p className="text-destructive text-sm">{err ?? "Not found"}</p>
        <Button variant="outline" asChild>
          <Link href="/outbound/consignments">Back to consignments</Link>
        </Button>
      </div>
    );
  }

  const linesLocked = isConsignmentLinesLocked({
    consignment_status: row.consignment_status,
    marked_rtd_at: row.marked_rtd_at,
  });
  const shipmentType =
    typeof row.raw?.shipment_type === "string" ? row.raw.shipment_type : null;
  const canMarkRtd =
    canWritePo && !linesLocked && (row.boxes_count ?? 0) > 0;

  return (
    <div className="mx-auto max-w-[min(100%,96rem)] space-y-6 px-2 py-4 md:px-4">
      <Button variant="ghost" size="sm" asChild className="gap-1">
        <Link href="/outbound/consignments">
          <ArrowLeft className="size-4" />
          Back
        </Link>
      </Button>

      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">Consignment #{row.id}</h1>
          {row.consignment_status ? (
            <Badge variant={statusVariant(row.consignment_status)}>
              {row.consignment_status}
            </Badge>
          ) : null}
        </div>
        <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <CompanyNameWithLogo name={row.company_name} size={18} />
          {row.location ? <span>· {row.location}</span> : null}
        </p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="h-full">
          <CardHeader className="pb-2">
            <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>Current Consignment Summary</span>
              {canMarkRtd ? (
                <Button size="sm" onClick={() => setRtdDialogOpen(true)}>
                  Mark for dispatch
                </Button>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <StatTile label="Boxes" value={row.boxes_count ?? 0} highlight />
              <StatTile label="SKUs" value={row.sku_count ?? 0} />
              <StatTile label="Total Qty" value={row.total_quantity ?? 0} />
            </div>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2">
                <FileTextIcon className="size-4" />
                PO &amp; Invoice
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-xs"
                disabled={downloadingExcel}
                onClick={() => void handleDownloadExcel()}
              >
                <Download className="size-3.5" />
                {downloadingExcel ? "Downloading…" : "Excel"}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <MetaRow label="PO Number" value={row.po_number} mono />
            <MetaRow label="PO Type" value={row.po_type} />
            <MetaRow label="Sold via" value={row.sold_via} />
            <InvoiceNumberRow
              current={row.invoice_number}
              inputVal={invoiceNumInput}
              saving={savingInvoiceNum}
              onChange={setInvoiceNumInput}
              onSave={() => void handleSaveInvoiceNumber()}
            />
            <MetaRow label="Invoice status" value={row.invoice_number_status} />
            <MetaRow label="Invoice upload" value={row.invoice_upload_status} />
            {row.invoice_file_name ? (
              <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
                <span className="text-muted-foreground shrink-0 text-xs font-medium">Invoice file</span>
                <span className="flex items-center gap-2 text-right">
                  <span className="font-mono text-xs">{row.invoice_file_name}</span>
                  {row.invoice_uploaded_at ? (
                    <span className="text-muted-foreground text-xs">{fmt(row.invoice_uploaded_at)}</span>
                  ) : null}
                  <Button size="sm" variant="outline" onClick={() => void handleDownloadInvoice()}>
                    Download
                  </Button>
                </span>
              </div>
            ) : null}
            {row.invoice_number_status && !row.invoice_file_name ? (
              <div className="flex items-center justify-between gap-4 py-2">
                <span className="text-muted-foreground shrink-0 text-xs font-medium">Upload invoice</span>
                <div className="flex items-center gap-2">
                  <input ref={invoiceFileRef} type="file" accept=".pdf,.jpg,.jpeg" className="text-xs" />
                  <Button size="sm" variant="outline" disabled={uploadingInvoice} onClick={handleUploadInvoice}>
                    <Upload className="size-3.5 mr-1" />
                    {uploadingInvoice ? "Uploading…" : "Upload"}
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="h-full">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <TruckIcon className="size-4" />
              Transport
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {row.transporter_name || row.vehicle_number || row.docket_number || shipmentType ? (
              <>
                <MetaRow label="Transporter" value={row.transporter_name} />
                <MetaRow label="Shipment type" value={shipmentType} />
                <MetaRow label="Vehicle" value={row.vehicle_number} mono />
                <MetaRow label="Docket" value={row.docket_number} mono />
              </>
            ) : (
              <p className="text-muted-foreground py-4 text-sm">
                No transport details yet. Mark for dispatch to add transporter and docket.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CalendarIcon className="size-4" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <MetaRow label="Created" value={fmt(row.created_at)} />
            <MetaRow label="Marked RTD" value={fmt(row.marked_rtd_at)} />
            <MetaRow label="Marked RTD by" value={row.marked_rtd_by} />
            <MetaRow label="Synced at" value={fmt(row.synced_at)} />
          </CardContent>
        </Card>
      </div>

      {linesLocked ? (
        <ConsignmentLineItemsTabViews consignmentId={Number(id)} />
      ) : (
        <ConsignmentLineItemsEditor
          consignmentId={Number(id)}
          poNumber={row.po_number ?? "—"}
          onSaved={() => void refreshConsignmentData()}
        />
      )}

      <ConsignmentPoLineItems consignmentId={Number(id)} poNumber={row.po_number} />

      <MarkConsignmentRtdDialog
        open={rtdDialogOpen}
        onOpenChange={setRtdDialogOpen}
        consignmentId={Number(id)}
        onMarked={() => void refreshConsignmentData()}
      />
    </div>
  );
}
