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
import { Badge } from "@/components/ui/badge";
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
  zap_storage_path?: string | null;
};

type ZapAtt = {
  id: number;
  original_filename: string;
  kind: string;
  created_at: string | null;
};

type PostDispatchKind = "invoice" | "bilty" | "pod" | "return";

/** Classify synced file rows for Post Dispatch vs Original PO (Details tab). */
function postDispatchCategory(f: EaFile): PostDispatchKind | null {
  const t = (f.file_type ?? "").toLowerCase();
  if (!t) return null;
  if (t.includes("return")) return "return";
  if (t.includes("pod") || t.includes("proof")) return "pod";
  if (t.includes("bilty") || t.includes("billty") || t.includes("bilt")) return "bilty";
  if (t.includes("invoice")) return "invoice";
  return null;
}

function originalEaFiles(files: EaFile[]): EaFile[] {
  return files.filter((f) => postDispatchCategory(f) == null);
}

function eaFilesForKind(files: EaFile[], kind: PostDispatchKind): EaFile[] {
  return files.filter((f) => postDispatchCategory(f) === kind);
}

type ConsignmentRow = {
  id: number;
  po_number: string | null;
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
  created_at: string | null;
  marked_rtd_at: string | null;
  marked_rtd_by: string | null;
  raw?: Record<string, unknown>;
};

type ConsignmentsListPayload = {
  total: number;
  content: ConsignmentRow[];
};

type PoLogRow = {
  id: number;
  po_number: string | null;
  consignment_id: number | null;
  foreign_key: number | null;
  operation: string | null;
  remarks: string | null;
  created_by: string | null;
  created_at: string | null;
};

function pickRaw(r: Record<string, unknown> | undefined, keys: string[]): string | null {
  if (!r) return null;
  for (const k of keys) {
    const v = r[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return null;
}

type DetailPayload = {
  po: OutboundPoDetail;
  listings: Record<string, unknown>;
  eautomateFiles: EaFile[];
  zapAttachments: ZapAtt[];
  sync: { ok: boolean; message?: string };
  eautomateDownloadConfigured: boolean;
  zapStorageConfigured?: boolean;
  poFileDownloadEnabled?: boolean;
  legacyOutboundFileFetchEnabled?: boolean;
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
  const canWritePo = hasPermission("purchase_orders", "write");
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<DetailPayload | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [dlBusy, setDlBusy] = React.useState<number | string | null>(null);
  const eaZapInputRef = React.useRef<HTMLInputElement>(null);
  const [eaZapUploading, setEaZapUploading] = React.useState(false);
  const [stubBusy, setStubBusy] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState("details");
  const [editOpen, setEditOpen] = React.useState(false);
  const [editField, setEditField] = React.useState<SaveFieldKey | null>(null);
  const [editLabel, setEditLabel] = React.useState("");
  const [editValue, setEditValue] = React.useState("");
  const [consignmentsData, setConsignmentsData] =
    React.useState<ConsignmentsListPayload | null>(null);
  const [consignmentsLoading, setConsignmentsLoading] = React.useState(false);
  const [logsPayload, setLogsPayload] = React.useState<PoLogRow[] | null>(null);
  const [logsLoading, setLogsLoading] = React.useState(false);
  const [createConsignmentOpen, setCreateConsignmentOpen] = React.useState(false);
  const [createConsignmentBusy, setCreateConsignmentBusy] = React.useState(false);

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

  React.useEffect(() => {
    if (tab !== "consignments") return;
    let cancelled = false;
    (async () => {
      setConsignmentsLoading(true);
      try {
        const res = await authFetchRaw(
          `/api/outbound/purchase-orders/${poId}/consignments?page=1&count=200`
        );
        const j = (await res.json()) as ConsignmentsListPayload & { error?: string };
        if (!cancelled) {
          if (res.ok) setConsignmentsData(j);
          else setConsignmentsData(null);
        }
      } catch {
        if (!cancelled) setConsignmentsData(null);
      } finally {
        if (!cancelled) setConsignmentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, poId]);

  React.useEffect(() => {
    if (tab !== "logs") return;
    let cancelled = false;
    (async () => {
      setLogsLoading(true);
      try {
        const res = await authFetchRaw(`/api/outbound/purchase-orders/${poId}/logs`);
        const j = (await res.json()) as { logs?: PoLogRow[]; error?: string };
        if (!cancelled) {
          if (res.ok && Array.isArray(j.logs)) setLogsPayload(j.logs);
          else setLogsPayload([]);
        }
      } catch {
        if (!cancelled) setLogsPayload([]);
      } finally {
        if (!cancelled) setLogsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, poId]);

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
      if (!res.ok) throw new Error(j.error ?? res.statusText);
      toast.success("Saved");
      setEditOpen(false);
      await load();
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
      const ct = res.headers.get("content-type") ?? "";
      if (
        res.ok &&
        ct &&
        !ct.includes("application/json") &&
        (action === "download_sku_report" || action === "download_pendency_pdf")
      ) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const pn = (data?.po?.po_number ?? "po").replace(/[/\\?%*:|"<>]/g, "_");
        a.download =
          action === "download_sku_report"
            ? `sku-report-${pn}.csv`
            : `pendency-${pn}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Download started");
        return;
      }
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        action?: string;
        detail?: string;
        hint?: string;
        upstream_url?: string;
      };
      if (!res.ok) {
        const parts = [
          j.error ?? j.detail ?? j.message ?? res.statusText,
          j.hint,
          j.upstream_url ? `URL: ${j.upstream_url}` : "",
        ].filter(Boolean);
        throw new Error(parts.join(" — "));
      }
      toast.success(
        action === "acknowledge"
          ? "Purchase order acknowledged"
          : action === "cancel"
            ? "Cancel request sent"
            : "Done"
      );
      await load();
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
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        listingsUpdated?: boolean;
      };
      if (!res.ok) throw new Error(j.error ?? res.statusText);
      toast.success(
        j.listingsUpdated
          ? "File uploaded and line items updated from spreadsheet."
          : "File uploaded"
      );
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

  const onUploadEaZap = async () => {
    const input = eaZapInputRef.current;
    const f = input?.files?.[0];
    if (!f || !canWritePo) return;
    setEaZapUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", f);
      const token = getStoredToken();
      const headers = new Headers();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const res = await fetch(apiUrl(`/api/outbound/purchase-orders/${poId}/files-zap`), {
        method: "POST",
        headers,
        body: fd,
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? res.statusText);
      toast.success("File stored in Zap Storage");
      input.value = "";
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setEaZapUploading(false);
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

  const legacyFetch = data.legacyOutboundFileFetchEnabled === true;
  const zapReady = data.zapStorageConfigured === true;
  const originalFiles = originalEaFiles(data.eautomateFiles);

  const filesTable = (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Original PO files</CardTitle>
        {!zapReady && !data.eautomateDownloadConfigured ? (
          <CardDescription>
            Upload files to Zap Storage (configure Supabase keys), or set the legacy outbound file URL template on the server to enable downloads from the sync source.
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        {canWritePo && zapReady ? (
          <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
            <input ref={eaZapInputRef} type="file" className="hidden" />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => eaZapInputRef.current?.click()}
            >
              Choose file
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void onUploadEaZap()}
              disabled={eaZapUploading}
            >
              {eaZapUploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Upload to Zap Storage"
              )}
            </Button>
          </div>
        ) : null}
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
              {originalFiles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-muted-foreground px-3 py-4 text-center">
                    No synced files yet — open this page again after sync, or upload a copy to Zap Storage.
                  </td>
                </tr>
              ) : (
                originalFiles.map((f) => (
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
                          !(f.zap_storage_path || legacyFetch) ||
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

        <TabsContent value="consignments" className="mt-4 space-y-4">
          {wip === "YES" && canMutate ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={() => setCreateConsignmentOpen(true)}
              >
                Create New Consignment
              </Button>
              <p className="text-muted-foreground text-xs">
                A consignment can only be created once a PO is marked as WIP.
              </p>
            </div>
          ) : wip !== "YES" ? (
            <p className="text-muted-foreground rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950/30">
              Mark this PO as WIP in eCraft/eAutomate before creating consignments.
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-3 py-2 font-semibold">Consignment ID</th>
                  <th className="px-3 py-2 font-semibold">PO Number</th>
                  <th className="px-3 py-2 font-semibold">Consignment Status</th>
                  <th className="px-3 py-2 font-semibold">Invoice Number Status</th>
                  <th className="px-3 py-2 font-semibold">Invoice Number</th>
                  <th className="px-3 py-2 font-semibold">Invoice Upload Status</th>
                  <th className="px-3 py-2 font-semibold">Boxes</th>
                  <th className="px-3 py-2 font-semibold">SKU Count</th>
                  <th className="px-3 py-2 font-semibold">Total Qty</th>
                  <th className="px-3 py-2 font-semibold">Transporter</th>
                  <th className="px-3 py-2 font-semibold">Vehicle / Docket</th>
                  <th className="px-3 py-2 font-semibold">Created At</th>
                  <th className="px-3 py-2 font-semibold">Created By</th>
                  <th className="px-3 py-2 font-semibold">Marked RTD At</th>
                  <th className="px-3 py-2 font-semibold">Marked RTD By</th>
                </tr>
              </thead>
              <tbody>
                {consignmentsLoading ? (
                  <tr>
                    <td colSpan={15} className="text-muted-foreground px-3 py-6 text-center">
                      <Loader2 className="inline size-4 animate-spin" /> Loading…
                    </td>
                  </tr>
                ) : !consignmentsData?.content?.length ? (
                  <tr>
                    <td colSpan={15} className="text-muted-foreground px-3 py-6 text-center">
                      No consignments synced for this PO yet.
                    </td>
                  </tr>
                ) : (
                  consignmentsData.content.map((row) => {
                    const raw = row.raw ?? {};
                    const createdBy =
                      pickRaw(raw as Record<string, unknown>, [
                        "consignment_created_by",
                        "created_by",
                        "consignmentCreatedBy",
                      ]) ?? "—";
                    const vehicle =
                      [row.vehicle_number, row.docket_number]
                        .filter(Boolean)
                        .join(" / ") || "—";
                    return (
                      <tr key={row.id} className="border-b">
                        <td className="px-3 py-2">
                          <Link
                            className="text-primary font-medium underline-offset-2 hover:underline"
                            href={`/outbound/consignments/${row.id}`}
                          >
                            {row.id}
                          </Link>
                        </td>
                        <td className="px-3 py-2 tabular-nums">{row.po_number ?? "—"}</td>
                        <td className="px-3 py-2">
                          {row.consignment_status ? (
                            <Badge variant="outline" className="font-normal">
                              {row.consignment_status}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {row.invoice_number_status ? (
                            <Badge variant="secondary" className="font-normal">
                              {row.invoice_number_status}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="max-w-[140px] truncate px-3 py-2 font-mono text-xs">
                          {row.invoice_number ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          {row.invoice_upload_status ? (
                            <Badge variant="outline" className="font-normal">
                              {row.invoice_upload_status}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2 tabular-nums">{row.boxes_count ?? "—"}</td>
                        <td className="px-3 py-2 tabular-nums">{row.sku_count ?? "—"}</td>
                        <td className="px-3 py-2 tabular-nums">{row.total_quantity ?? "—"}</td>
                        <td className="max-w-[120px] truncate px-3 py-2">
                          {row.transporter_name ?? "—"}
                        </td>
                        <td className="max-w-[140px] truncate px-3 py-2 font-mono text-xs">
                          {vehicle}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {fmtDateTime(row.created_at)}
                        </td>
                        <td className="max-w-[120px] truncate px-3 py-2 text-xs">
                          {createdBy}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {fmtDateTime(row.marked_rtd_at)}
                        </td>
                        <td className="max-w-[120px] truncate px-3 py-2 text-xs">
                          {row.marked_rtd_by ?? "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <Button variant="outline" asChild>
            <Link
              href={`/outbound/consignments?search=${encodeURIComponent(po.po_number)}`}
            >
              Open full consignments list (filtered)
            </Link>
          </Button>
        </TabsContent>

        <TabsContent value="postdispatch" className="mt-4 space-y-6">
          <p className="text-muted-foreground text-sm">
            Documents synced from eAutomate for this PO (by file type). Configure download paths on the server if needed.
          </p>
          {(
            [
              ["Invoice", "invoice" as PostDispatchKind],
              ["Bilty", "bilty" as PostDispatchKind],
              ["Proof of Delivery", "pod" as PostDispatchKind],
              ["Return Invoice", "return" as PostDispatchKind],
            ] as const
          ).map(([label, kind]) => {
            const sectionFiles = eaFilesForKind(data.eautomateFiles, kind);
            return (
              <Card key={kind}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{label}</CardTitle>
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
                        {sectionFiles.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="text-muted-foreground px-3 py-8 text-center"
                            >
                              No document was found
                            </td>
                          </tr>
                        ) : (
                          sectionFiles.map((f) => (
                            <tr key={`${kind}-${f.eautomate_file_id}`} className="border-b">
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
                                    !(f.zap_storage_path || legacyFetch) ||
                                    dlBusy === `ea-${f.eautomate_file_id}`
                                  }
                                  aria-label={`Download ${f.file_name}`}
                                  onClick={() =>
                                    void onDownloadEa(f.eautomate_file_id, f.file_name)
                                  }
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
          })}
        </TabsContent>

        <TabsContent value="logs" className="mt-4 space-y-3">
          {logsLoading ? (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Loading logs…
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="px-3 py-2 font-semibold">Log ID</th>
                    <th className="px-3 py-2 font-semibold">Operation Performed</th>
                    <th className="px-3 py-2 font-semibold">PO Number</th>
                    <th className="px-3 py-2 font-semibold">Consignment ID</th>
                    <th className="px-3 py-2 font-semibold">Foreign Key</th>
                    <th className="px-3 py-2 font-semibold">Remarks</th>
                    <th className="px-3 py-2 font-semibold">Created By</th>
                    <th className="px-3 py-2 font-semibold">Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {!logsPayload?.length ? (
                    <tr>
                      <td colSpan={8} className="text-muted-foreground px-3 py-6 text-center">
                        No logs loaded. Sync runs when eAutomate is configured; override URL with
                        EAUTOMATE_PO_LOGS_URL if needed.
                      </td>
                    </tr>
                  ) : (
                    logsPayload.map((log) => (
                      <tr key={log.id} className="border-b">
                        <td className="px-3 py-2 tabular-nums">{log.id}</td>
                        <td className="max-w-[180px] truncate px-3 py-2 text-xs">
                          {log.operation ?? "—"}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{log.po_number ?? "—"}</td>
                        <td className="px-3 py-2 tabular-nums">
                          {log.consignment_id ?? "—"}
                        </td>
                        <td className="px-3 py-2 tabular-nums">{log.foreign_key ?? "—"}</td>
                        <td className="max-w-[280px] px-3 py-2 text-xs whitespace-pre-wrap">
                          {log.remarks ?? "—"}
                        </td>
                        <td className="max-w-[140px] truncate px-3 py-2 text-xs">
                          {log.created_by ?? "—"}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {fmtDateTime(log.created_at)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {editLabel}</DialogTitle>
            <DialogDescription>
              Saves to Zap and refreshes from eAutomate when configured.
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

      <Dialog open={createConsignmentOpen} onOpenChange={setCreateConsignmentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Consignment</DialogTitle>
            <DialogDescription>
              Calls eAutomate to create a consignment for PO {po.po_number}. A consignment can
              only be created once a PO is marked as WIP. Override the URL on the server with
              EAUTOMATE_CREATE_CONSIGNMENT_URL if the default path does not match your build.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateConsignmentOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={createConsignmentBusy}
              onClick={() => {
                void (async () => {
                  setCreateConsignmentBusy(true);
                  try {
                    const res = await authFetchRaw(
                      `/api/outbound/purchase-orders/${poId}/consignments`,
                      { method: "POST" }
                    );
                    const j = (await res.json().catch(() => ({}))) as {
                      error?: string;
                      detail?: string;
                    };
                    if (!res.ok) {
                      throw new Error(j.error ?? j.detail ?? "Failed to create consignment");
                    }
                    toast.success("Consignment created");
                    setCreateConsignmentOpen(false);
                    await load();
                    const cr = await authFetchRaw(
                      `/api/outbound/purchase-orders/${poId}/consignments?page=1&count=200`
                    );
                    const cj = (await cr.json()) as ConsignmentsListPayload;
                    if (cr.ok) setConsignmentsData(cj);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Failed");
                  } finally {
                    setCreateConsignmentBusy(false);
                  }
                })();
              }}
            >
              {createConsignmentBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Confirm"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
