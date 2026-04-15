"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Trash2,
  Download,
  ArrowLeft,
  Loader2,
  PencilLine,
} from "lucide-react";
import { toast } from "sonner";
import { apiUrl, getStoredToken } from "@/lib/api-browser";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const textareaClass =
  "border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[100px] w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";
import {
  OutboundPoLineItemsTable,
  type OutboundListingsEnvelope,
} from "./outbound-po-detail-line-items-table";

type OutboundPoDetail = {
  id: number;
  po_number: string;
  sold_via: string | null;
  company_id: number | null;
  company_name: string | null;
  delivery_city: string | null;
  delivery_address: string | null;
  billing_address: string | null;
  buyer_gstin: string | null;
  po_issue_date: string | null;
  expiry_date: string | null;
  po_type: string | null;
  po_creation_status: string | null;
  po_acknowledgement_status: string | null;
  po_fulfillment_status: string | null;
  calculated_po_status: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  is_wip: string | null;
  remarks: string | null;
  analytics_object: Record<string, unknown>;
  listings_snapshot?: Record<string, unknown>;
};

type EaFile = {
  eautomate_file_id: number;
  file_name: string;
  file_uploaded_by: string | null;
  created_at: string | null;
  file_type: string | null;
};

type ZapAtt = {
  id: number;
  original_filename: string;
  kind: string;
  created_at: string | null;
};

type DetailPayload = {
  po: OutboundPoDetail;
  listings: Record<string, unknown>;
  eautomateFiles: EaFile[];
  zapAttachments: ZapAtt[];
  sync: { ok: boolean; message?: string };
  eautomateDownloadConfigured: boolean;
};

type SaveFieldKey =
  | "po_type"
  | "delivery_city"
  | "delivery_address"
  | "billing_address"
  | "expiry_date"
  | "remarks";

function fmtDay(d: string | null | undefined): string {
  if (!d) return "—";
  const x = new Date(d.replace(" ", "T"));
  if (Number.isNaN(x.getTime())) return d;
  return x.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return d;
  return x.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtRs(n: unknown): string {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return `Rs. ${x.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtNum(n: unknown): string {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return String(x);
}

const SUMMARY_ROWS: { key: string; label: string; format?: "rs" | "pct" }[] = [
  { key: "sku_count", label: "Number of SKUs" },
  { key: "total_demand", label: "Total Demand Quantity" },
  { key: "total_pending", label: "Total Pending Quantity" },
  { key: "total_packed", label: "Total Packed Quantity" },
  { key: "boxes_packed", label: "Boxed Packed" },
  { key: "total_before_tax", label: "Po Value Before Tax", format: "rs" },
  { key: "sku_fill_rate", label: "SKU Fill Rate %", format: "pct" },
  { key: "quantity_fill_rate", label: "Quantity Fill Rate %", format: "pct" },
  { key: "total_consignments", label: "Total Consignments" },
  { key: "total_dispatched", label: "Total Dispatched Quantity" },
  { key: "boxes_dispatched", label: "Boxes Dispatched" },
  { key: "total_after_tax", label: "Po Value After Tax", format: "rs" },
];

async function authFetchRaw(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const token = getStoredToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(apiUrl(path), { ...init, headers });
}

async function downloadBlob(path: string, filename: string) {
  const res = await authFetchRaw(path);
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? res.statusText);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 200);
  a.click();
  URL.revokeObjectURL(url);
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
    <div className={cn("space-y-1", className)}>
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}

function EditableRow({
  label,
  children,
  canEdit,
  onEdit,
}: {
  label: string;
  children: React.ReactNode;
  canEdit: boolean;
  onEdit?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start gap-2 sm:items-center">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        <div className="text-sm font-medium">{children}</div>
      </div>
      {canEdit && onEdit ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-primary shrink-0"
          aria-label={`Edit ${label}`}
          onClick={onEdit}
        >
          <PencilLine className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}

export function OutboundPoDetailClient({ poId }: { poId: string }) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canMutate = hasPermission("purchase_orders", "create");
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<DetailPayload | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [dlBusy, setDlBusy] = React.useState<number | string | null>(null);
  const [stubBusy, setStubBusy] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState("details");
  const [editOpen, setEditOpen] = React.useState(false);
  const [editField, setEditField] = React.useState<SaveFieldKey | null>(null);
  const [editLabel, setEditLabel] = React.useState("");
  const [editValue, setEditValue] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await authFetchRaw(`/api/outbound/purchase-orders/${poId}/detail`);
      const j = (await res.json()) as DetailPayload & { error?: string };
      if (!res.ok) throw new Error(j.error ?? res.statusText);
      setData({
        ...j,
        listings:
          j.listings && typeof j.listings === "object"
            ? j.listings
            : (j.po?.listings_snapshot as Record<string, unknown>) ?? {},
      });
      if (!j.sync?.ok && j.sync?.message) {
        toast.message("Live sync skipped", { description: j.sync.message });
      } else if (j.sync?.ok && j.sync?.message) {
        toast.message("Sync completed with notices", { description: j.sync.message });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [poId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const po = data?.po;
  const isPartial =
    (po?.po_creation_status ?? "").toUpperCase().trim() === "PARTIAL";

  const openEdit = (field: SaveFieldKey, label: string, value: string) => {
    setEditField(field);
    setEditLabel(label);
    setEditValue(value);
    setEditOpen(true);
  };

  const onSaveEdit = async () => {
    if (!editField) return;
    setStubBusy("save_field");
    try {
      const res = await authFetchRaw(
        `/api/outbound/purchase-orders/${poId}/eautomate-actions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_field",
            field: editField,
            value: editValue,
          }),
        }
      );
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        action?: string;
      };
      if (res.status === 501) {
        toast.message(j.message ?? "Not implemented", {
          description: `Action: ${j.action ?? "save_field"}`,
        });
        setEditOpen(false);
        return;
      }
      if (!res.ok) throw new Error(j.error ?? res.statusText);
      toast.success("Saved");
      setEditOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setStubBusy(null);
    }
  };

  const onStubWorkflow = async (action: string) => {
    setStubBusy(action);
    try {
      const res = await authFetchRaw(
        `/api/outbound/purchase-orders/${poId}/eautomate-actions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        action?: string;
      };
      if (res.status === 501) {
        toast.message(j.message ?? "Not implemented", {
          description: `Action: ${j.action ?? action}`,
        });
        return;
      }
      if (!res.ok) throw new Error(j.error ?? res.statusText);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed");
    } finally {
      setStubBusy(null);
    }
  };

  const onDelete = async () => {
    if (!canMutate || !isPartial) return;
    if (!window.confirm("Delete this partial purchase order from Zap? This cannot be undone.")) {
      return;
    }
    setDeleting(true);
    try {
      const res = await authFetchRaw(`/api/outbound/purchase-orders/${poId}`, {
        method: "DELETE",
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? res.statusText);
      toast.success("Purchase order deleted");
      router.push("/outbound/partial");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const onUpload = async () => {
    if (!canMutate || !file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const token = getStoredToken();
      const headers = new Headers();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const res = await fetch(apiUrl(`/api/outbound/purchase-orders/${poId}/attachments`), {
        method: "POST",
        headers,
        body: fd,
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? res.statusText);
      toast.success("File uploaded");
      setFile(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onDownloadEa = async (fileId: number, fileName: string) => {
    setDlBusy(`ea-${fileId}`);
    try {
      await downloadBlob(
        `/api/outbound/purchase-orders/${poId}/eautomate-files/${fileId}`,
        fileName
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDlBusy(null);
    }
  };

  const onDownloadZap = async (attachmentId: number, fileName: string) => {
    setDlBusy(`zap-${attachmentId}`);
    try {
      await downloadBlob(
        `/api/outbound/purchase-orders/${poId}/attachments/${attachmentId}`,
        fileName
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDlBusy(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 px-2 py-8 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading purchase order…
      </div>
    );
  }

  if (err || !po || !data) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-2 py-6">
        <p className="text-destructive text-sm">{err ?? "Not found"}</p>
        <Button variant="outline" asChild>
          <Link href="/outbound">Back to purchase orders</Link>
        </Button>
      </div>
    );
  }

  const analytics = po.analytics_object ?? {};
  const wip = (po.is_wip ?? "").toUpperCase().trim();
  const listingsEnvelope = (data.listings ?? {}) as OutboundListingsEnvelope;

  const filesTable = (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Original PO files (eAutomate)</CardTitle>
        {!data.eautomateDownloadConfigured ? (
          <CardDescription>
            Set <code className="text-xs">EAUTOMATE_OUTBOUND_PO_FILE_URL_PATH</code> on the server
            (placeholders {"{"}fileId{"}"}, {"{"}poNumber{"}"}) to enable download proxy.
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="px-3 py-2 font-semibold">File ID</th>
                <th className="px-3 py-2 font-semibold">Uploaded at</th>
                <th className="px-3 py-2 font-semibold">Uploaded by</th>
                <th className="px-3 py-2 font-semibold">File name</th>
                <th className="px-3 py-2 font-semibold">Download</th>
              </tr>
            </thead>
            <tbody>
              {data.eautomateFiles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-muted-foreground px-3 py-4 text-center">
                    No files synced yet (open page again after eAutomate sync).
                  </td>
                </tr>
              ) : (
                data.eautomateFiles.map((f) => (
                  <tr key={f.eautomate_file_id} className="border-b">
                    <td className="px-3 py-2 tabular-nums">{f.eautomate_file_id}</td>
                    <td className="px-3 py-2">{fmtDateTime(f.created_at)}</td>
                    <td className="px-3 py-2">{f.file_uploaded_by ?? "—"}</td>
                    <td className="max-w-[240px] truncate px-3 py-2" title={f.file_name}>
                      {f.file_name}
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-primary h-8 w-8"
                        disabled={
                          !data.eautomateDownloadConfigured ||
                          dlBusy === `ea-${f.eautomate_file_id}`
                        }
                        aria-label={`Download ${f.file_name}`}
                        onClick={() => void onDownloadEa(f.eautomate_file_id, f.file_name)}
                      >
                        {dlBusy === `ea-${f.eautomate_file_id}` ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Download className="size-4" />
                        )}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );

  const summaryTable = (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Current Purchase Order Summary</CardTitle>
        <CardDescription>Values from analytics_object</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <tbody>
              {SUMMARY_ROWS.map(({ key, label, format }) => {
                const raw = analytics[key];
                let display: string;
                if (format === "rs") display = fmtRs(raw);
                else if (format === "pct") display = `${fmtNum(raw)}%`;
                else display = fmtNum(raw);
                return (
                  <tr key={key} className="border-b last:border-0">
                    <th className="text-muted-foreground w-[55%] px-3 py-2 text-left font-medium">
                      {label}
                    </th>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{display}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );

  const workflowButtons = (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="border-primary text-primary hover:bg-primary/5 h-auto min-h-11 w-full whitespace-normal py-2"
        disabled={!canMutate || stubBusy !== null}
        onClick={() => void onStubWorkflow("acknowledge")}
      >
        {stubBusy === "acknowledge" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          "Acknowledge Purchase Order"
        )}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-auto min-h-11 w-full whitespace-normal border-red-300 py-2 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
        disabled={!canMutate || stubBusy !== null}
        onClick={() => void onStubWorkflow("cancel")}
      >
        {stubBusy === "cancel" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          "Cancel Purchase Order"
        )}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="border-blue-400 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950/30 h-auto min-h-11 w-full whitespace-normal py-2"
        disabled={!canMutate || stubBusy !== null}
        onClick={() => void onStubWorkflow("download_sku_report")}
      >
        {stubBusy === "download_sku_report" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          "Download SKU Level Report"
        )}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="border-blue-400 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950/30 h-auto min-h-11 w-full whitespace-normal py-2"
        disabled={!canMutate || stubBusy !== null}
        onClick={() => void onStubWorkflow("download_pendency_pdf")}
      >
        {stubBusy === "download_pendency_pdf" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          "Download Pendency PDF"
        )}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="border-blue-400 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950/30 h-auto min-h-11 w-full whitespace-normal py-2"
        disabled={!canMutate || stubBusy !== null}
        onClick={() => void onStubWorkflow("generate_product_labels")}
      >
        {stubBusy === "generate_product_labels" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          "Generate Product Labels"
        )}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="border-blue-400 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950/30 h-auto min-h-11 w-full whitespace-normal py-2"
        disabled={!canMutate || stubBusy !== null}
        onClick={() => void onStubWorkflow("generate_phase1_box_labels")}
      >
        {stubBusy === "generate_phase1_box_labels" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          "Generate Phase 1 Box Labels"
        )}
      </Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1800px] space-y-4 px-2 py-4 md:px-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="gap-1">
          <Link href={isPartial ? "/outbound/partial" : "/outbound"}>
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList variant="line" className="bg-primary/15 w-full flex-wrap justify-start gap-1 p-1">
          <TabsTrigger value="details" className="min-w-[120px]">
            PO Details
          </TabsTrigger>
          <TabsTrigger value="consignments" className="min-w-[140px]">
            PO Consignments
          </TabsTrigger>
          <TabsTrigger value="postdispatch" className="min-w-[160px]">
            Post Dispatch Documents
          </TabsTrigger>
          <TabsTrigger value="logs" className="min-w-[100px]">
            PO Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4 space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1fr_minmax(260px,300px)]">
            <div className="min-w-0 space-y-6">
              {filesTable}

              {po.calculated_po_status ? (
                <div
                  className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
                  role="status"
                >
                  PO Status: {po.calculated_po_status}
                </div>
              ) : null}

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Purchase order</CardTitle>
                  <CardDescription>{po.po_number}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                  <Field label="Marked WIP?">
                    <span
                      className={cn(
                        "font-semibold",
                        wip === "NO" && "text-red-600 dark:text-red-400",
                        wip === "YES" && "text-green-600 dark:text-green-500"
                      )}
                    >
                      {po.is_wip ?? "—"}
                    </span>
                  </Field>
                  <Field label="Buyer Company Name">{po.company_name ?? "—"}</Field>
                  <Field label="PO Number">{po.po_number}</Field>
                  <EditableRow
                    label="PO Type"
                    canEdit={canMutate}
                    onEdit={() =>
                      openEdit("po_type", "PO Type", po.po_type ?? "")
                    }
                  >
                    {po.po_type ?? "—"}
                  </EditableRow>
                  <Field label="Sold Via">{po.sold_via ?? "—"}</Field>
                  <EditableRow
                    label="Reference Location"
                    canEdit={canMutate}
                    onEdit={() =>
                      openEdit("delivery_city", "Reference Location", po.delivery_city ?? "")
                    }
                  >
                    {po.delivery_city ?? "—"}
                  </EditableRow>
                  <div className="lg:col-span-2">
                    <EditableRow
                      label="Delivery Address"
                      canEdit={canMutate}
                      onEdit={() =>
                        openEdit(
                          "delivery_address",
                          "Delivery Address",
                          po.delivery_address ?? ""
                        )
                      }
                    >
                      <p className="text-muted-foreground font-normal whitespace-pre-wrap">
                        {po.delivery_address ?? "—"}
                      </p>
                    </EditableRow>
                  </div>
                  <div className="lg:col-span-2">
                    <EditableRow
                      label="Billing Address"
                      canEdit={canMutate}
                      onEdit={() =>
                        openEdit(
                          "billing_address",
                          "Billing Address",
                          po.billing_address ?? ""
                        )
                      }
                    >
                      <p className="text-muted-foreground font-normal whitespace-pre-wrap">
                        {po.billing_address ?? "—"}
                      </p>
                    </EditableRow>
                  </div>
                  <Field label="Buyer GSTIN">
                    <span className="font-mono text-xs">{po.buyer_gstin ?? "—"}</span>
                  </Field>
                  <Field label="PO Release Date">{fmtDay(po.po_issue_date)}</Field>
                  <EditableRow
                    label="Expiry Date"
                    canEdit={canMutate}
                    onEdit={() =>
                      openEdit(
                        "expiry_date",
                        "Expiry Date",
                        po.expiry_date
                          ? String(po.expiry_date).replace(" ", "T").slice(0, 10)
                          : ""
                      )
                    }
                  >
                    {fmtDay(po.expiry_date)}
                  </EditableRow>
                  <div className="bg-amber-50/80 dark:bg-amber-950/20 lg:col-span-2 rounded-md border border-amber-200/80 p-3 dark:border-amber-900/50">
                    <EditableRow
                      label="Remarks"
                      canEdit={canMutate}
                      onEdit={() => openEdit("remarks", "Remarks", po.remarks ?? "")}
                    >
                      <p className="text-muted-foreground font-normal whitespace-pre-wrap">
                        {po.remarks?.trim() ? po.remarks : "—"}
                      </p>
                    </EditableRow>
                  </div>
                  <Field label="Created by">{po.created_by ?? "—"}</Field>
                  <Field label="Created At">{fmtDateTime(po.created_at)}</Field>
                  <Field label="PO creation status">{po.po_creation_status ?? "—"}</Field>
                  <Field label="Acknowledgement">{po.po_acknowledgement_status ?? "—"}</Field>
                  <Field label="Fulfillment">{po.po_fulfillment_status ?? "—"}</Field>
                  <Field label="Updated at">{fmtDateTime(po.updated_at)}</Field>
                </CardContent>
              </Card>

              {summaryTable}

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">SKU line items</CardTitle>
                  <CardDescription>From listings / paginated sync</CardDescription>
                </CardHeader>
                <CardContent>
                  <OutboundPoLineItemsTable listings={listingsEnvelope} />
                </CardContent>
              </Card>

              {data.zapAttachments.length > 0 ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Files uploaded in Zap</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-sm">
                        <thead>
                          <tr className="bg-muted/50 border-b">
                            <th className="px-3 py-2 font-semibold">ID</th>
                            <th className="px-3 py-2 font-semibold">Uploaded at</th>
                            <th className="px-3 py-2 font-semibold">File name</th>
                            <th className="px-3 py-2 font-semibold">Kind</th>
                            <th className="px-3 py-2 font-semibold">Download</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.zapAttachments.map((a) => (
                            <tr key={a.id} className="border-b">
                              <td className="px-3 py-2 tabular-nums">{a.id}</td>
                              <td className="px-3 py-2">{fmtDateTime(a.created_at)}</td>
                              <td className="max-w-[240px] truncate px-3 py-2">
                                {a.original_filename}
                              </td>
                              <td className="px-3 py-2">{a.kind}</td>
                              <td className="px-3 py-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="text-primary h-8 w-8"
                                  disabled={dlBusy === `zap-${a.id}`}
                                  aria-label={`Download ${a.original_filename}`}
                                  onClick={() => void onDownloadZap(a.id, a.original_filename)}
                                >
                                  {dlBusy === `zap-${a.id}` ? (
                                    <Loader2 className="size-4 animate-spin" />
                                  ) : (
                                    <Download className="size-4" />
                                  )}
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {canMutate ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Upload received PO</CardTitle>
                    <CardDescription>
                      PDF or spreadsheet/CSV, max 2MB.{" "}
                      <Link
                        href="/samples/outbound/sample_po_line_items_spreadsheet.csv"
                        className="text-primary font-medium underline-offset-2 hover:underline"
                        download
                      >
                        Download sample file
                      </Link>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-end gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="po-upload">Choose file</Label>
                      <Input
                        id="po-upload"
                        type="file"
                        accept=".pdf,.csv,.xlsx,.xls"
                        className="max-w-xs cursor-pointer"
                        onChange={(e) => {
                          setFile(e.target.files?.[0] ?? null);
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      disabled={!file || uploading}
                      onClick={() => void onUpload()}
                    >
                      {uploading ? "Uploading…" : "Upload"}
                    </Button>
                  </CardContent>
                </Card>
              ) : null}
            </div>

            <div className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:self-start">
              <Card className="border-primary/20 overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
                  {workflowButtons}
                  {canMutate && isPartial ? (
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={deleting || stubBusy !== null}
                      onClick={() => void onDelete()}
                      className="inline-flex h-auto min-h-10 w-full items-center justify-center gap-2 whitespace-normal py-2"
                    >
                      {deleting ? (
                        <Loader2 className="size-4 shrink-0 animate-spin" />
                      ) : (
                        <Trash2 className="size-4 shrink-0" />
                      )}
                      <span>Delete this partial purchase order</span>
                    </Button>
                  ) : (
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {isPartial
                        ? "You need create permission on purchase orders to delete partial POs."
                        : "Delete is only available for partially created (PARTIAL) POs."}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="consignments" className="mt-4 space-y-3">
          <p className="text-muted-foreground text-sm">
            Consignments are listed on the main consignments page. Open it filtered by this PO
            number.
          </p>
          <Button variant="outline" asChild>
            <Link
              href={`/outbound/consignments?search=${encodeURIComponent(po.po_number)}`}
            >
              Open consignments for {po.po_number}
            </Link>
          </Button>
        </TabsContent>

        <TabsContent value="postdispatch" className="mt-4">
          <p className="text-muted-foreground text-sm">
            Post dispatch documents are not wired in Zap yet. When the eAutomate API is available,
            this tab will list uploads and status.
          </p>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <p className="text-muted-foreground text-sm">
            PO activity logs are not wired in Zap yet.
          </p>
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {editLabel}</DialogTitle>
            <DialogDescription>
              Saving calls Zap (stub) until the eAutomate update endpoint is configured.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="edit-val">Value</Label>
            {editField === "remarks" ||
            editField === "delivery_address" ||
            editField === "billing_address" ? (
              <textarea
                id="edit-val"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={5}
                className={textareaClass}
              />
            ) : (
              <Input
                id="edit-val"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
              />
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={stubBusy === "save_field"}
              onClick={() => void onSaveEdit()}
            >
              {stubBusy === "save_field" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
