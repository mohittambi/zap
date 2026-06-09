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
import { CompanyNameWithLogo } from "@/components/company/company-logo";
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
import { SearchableSelect } from "@/components/outbound/searchable-select";
import { CreateConsignmentDialog } from "@/components/outbound/create-consignment-dialog";
import {
  TripletDatePicker,
  formatUtcDateOnly,
  parseDateOnlyString,
} from "@/components/outbound/triplet-date-picker";
import { OUTBOUND_PO_TYPES } from "@/lib/outbound-po-types";
import { isOutboundPoAcknowledged } from "@/lib/outbound-po-acknowledgement";
import { isOutboundPoWip } from "@/lib/outbound-po-wip";
import { cn } from "@/lib/utils";

const textareaClass =
  "border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[100px] w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";
import {
  OutboundPoLineItemsTable,
  type OutboundListingsEnvelope,
} from "./outbound-po-detail-line-items-table";
import {
  OutboundPoAddDocumentUpload,
  OutboundPoDocumentsSection,
  type EaFile,
  type ZapAtt,
} from "./outbound-po-documents-section";

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
  eautomate_synced_at?: string | null;
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
  | "remarks"
  | "is_wip";

type LabelRow = {
  po_secondary_sku: string;
  company_code_primary: string;
  company_code_secondary: string;
  ean_code: string;
  zap_ean: string;
  universal_ean: string;
  size: string;
  color: string;
  one_set_contains: string;
  material: string;
  mrp_now: string;
  mrp_at_po_creation: string;
  img_url: string;
  master_sku: string;
  inventory_sku_id: string;
  pack_combo_sku_id: string;
  sku_type: string;
  title: string;
  warehouse_quantity: string;
  demand_quantity: string;
  dispatched_quantity: string;
};

const LABEL_CONTACT_OPTIONS = [
  "ECIPL, Warehouse 1, Jaat Colony, Khasra 1660, Bhakrota, Jaipur, Rajasthan, 302026, Tel. no: 8100418100 & e-Mail: cs@ecraftindia.com",
];

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
  { key: "boxes_packed", label: "Boxes packed" },
  { key: "total_before_tax", label: "Po Value Before Tax", format: "rs" },
  { key: "sku_fill_rate", label: "SKU Fill Rate %", format: "pct" },
  { key: "quantity_fill_rate", label: "Quantity Fill Rate %", format: "pct" },
  { key: "total_consignments", label: "Total Consignments" },
  { key: "total_dispatched", label: "Total Dispatched Quantity" },
  { key: "boxes_dispatched", label: "Boxes Dispatched" },
  { key: "total_after_tax", label: "Po Value After Tax", format: "rs" },
];

const SUMMARY_CHIP_ACCENT: Record<string, string> = {
  sku_count:
    "border-l-[3px] border-sky-500 from-sky-50/95 to-transparent dark:from-sky-950/30",
  total_demand:
    "border-l-[3px] border-violet-500 from-violet-50/95 to-transparent dark:from-violet-950/30",
  total_pending:
    "border-l-[3px] border-amber-500 from-amber-50/95 to-transparent dark:from-amber-950/30",
  total_packed:
    "border-l-[3px] border-emerald-500 from-emerald-50/95 to-transparent dark:from-emerald-950/30",
  sku_fill_rate:
    "border-l-[3px] border-indigo-500 from-indigo-50/95 to-transparent dark:from-indigo-950/30",
  quantity_fill_rate:
    "border-l-[3px] border-fuchsia-500 from-fuchsia-50/95 to-transparent dark:from-fuchsia-950/30",
  total_dispatched:
    "border-l-[3px] border-teal-500 from-teal-50/95 to-transparent dark:from-teal-950/30",
  boxes_packed:
    "border-l-[3px] border-cyan-600 from-cyan-50/95 to-transparent dark:from-cyan-950/25",
  boxes_dispatched:
    "border-l-[3px] border-blue-500 from-blue-50/95 to-transparent dark:from-blue-950/30",
  total_consignments:
    "border-l-[3px] border-slate-500 from-slate-50/95 to-transparent dark:from-slate-950/35",
  total_before_tax:
    "border-l-[3px] border-orange-500 from-orange-50/95 to-transparent dark:from-orange-950/25",
  total_after_tax:
    "border-l-[3px] border-orange-600 from-orange-50/98 to-transparent dark:from-orange-950/30",
};

const SUMMARY_GROUP_DEFS: { title: string; keys: readonly string[]; gridClassName: string }[] = [
  {
    title: "Line fulfilment",
    keys: [
      "sku_count",
      "total_demand",
      "total_pending",
      "total_packed",
      "sku_fill_rate",
      "quantity_fill_rate",
    ],
    gridClassName: "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6",
  },
  {
    title: "Dispatch and logistics",
    keys: ["total_dispatched", "boxes_packed", "boxes_dispatched", "total_consignments"],
    gridClassName: "grid grid-cols-2 gap-3 sm:grid-cols-4",
  },
  {
    title: "Commercial",
    keys: ["total_before_tax", "total_after_tax"],
    gridClassName: "grid grid-cols-1 gap-3 sm:grid-cols-2",
  },
];

function omitGraphicsReportFromAnalytics(ao: Record<string, unknown>): Record<string, unknown> {
  const o = { ...ao };
  delete o.graphics_report;
  delete o.Graphics_Report;
  return o;
}

/** Normalise analytics payload and drop non-KPI blobs (same keys stripped server-side when syncing). */
function parseOutboundAnalyticsForSummary(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return omitGraphicsReportFromAnalytics(value as Record<string, unknown>);
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return omitGraphicsReportFromAnalytics(parsed as Record<string, unknown>);
      }
    } catch {
      /* not JSON */
    }
  }
  return {};
}

function isLikelyStructuredJsonString(s: string): boolean {
  const t = s.trim();
  if (!t.startsWith("{") && !t.startsWith("[")) return false;
  try {
    JSON.parse(t);
    return true;
  } catch {
    return false;
  }
}

/** KPI cells only — never expose embedded JSON blobs (including mis-mapped upstream fields). */
function formatSummaryMetric(raw: unknown, format?: "rs" | "pct"): string {
  if (raw == null) return "—";
  if (typeof raw === "object") return "—";
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return "—";
    if (isLikelyStructuredJsonString(t)) return "—";
  }
  if (format === "rs") return fmtRs(raw);
  if (format === "pct") return `${fmtNum(raw)}%`;
  return fmtNum(raw);
}

function outboundSummaryMeta(key: string) {
  return SUMMARY_ROWS.find((r) => r.key === key);
}

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

function OutboundAnalyticsStatChip({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-gradient-to-br px-3 py-2.5 shadow-sm backdrop-blur-sm",
        className
      )}
    >
      <p className="text-muted-foreground mb-1 truncate text-[10px] font-semibold uppercase tracking-wide">
        {label}
      </p>
      <p className="font-mono text-lg leading-tight font-semibold tracking-tight break-words tabular-nums">
        {value}
      </p>
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
  const [eaZapFile, setEaZapFile] = React.useState<File | null>(null);
  const [eaZapUploadInputKey, setEaZapUploadInputKey] = React.useState(0);
  const [eaZapUploading, setEaZapUploading] = React.useState(false);
  const [stubBusy, setStubBusy] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState("details");
  const [editOpen, setEditOpen] = React.useState(false);
  const [editField, setEditField] = React.useState<SaveFieldKey | null>(null);
  const [editLabel, setEditLabel] = React.useState("");
  const [editValue, setEditValue] = React.useState("");
  const [editDateValue, setEditDateValue] = React.useState<Date | null>(null);
  const [consignmentsData, setConsignmentsData] =
    React.useState<ConsignmentsListPayload | null>(null);
  const [consignmentsLoading, setConsignmentsLoading] = React.useState(false);
  const [logsPayload, setLogsPayload] = React.useState<PoLogRow[] | null>(null);
  const [logsLoading, setLogsLoading] = React.useState(false);
  const [createConsignmentOpen, setCreateConsignmentOpen] = React.useState(false);
  const [packingConsignmentId, setPackingConsignmentId] = React.useState<number | null>(null);
  const [labelDialogOpen, setLabelDialogOpen] = React.useState(false);
  const [labelRows, setLabelRows] = React.useState<LabelRow[]>([]);
  const [labelStep, setLabelStep] = React.useState<1 | 2 | 3 | 4>(1);
  const [marketedBy, setMarketedBy] = React.useState(LABEL_CONTACT_OPTIONS[0]);
  const [manufacturedBy, setManufacturedBy] = React.useState(LABEL_CONTACT_OPTIONS[0]);
  const [dateOfManufacture, setDateOfManufacture] = React.useState(() =>
    new Date().toLocaleString("en-US", { month: "short", year: "numeric" })
  );
  const [brand, setBrand] = React.useState("eCraftIndia");
  const [countryOfOrigin, setCountryOfOrigin] = React.useState("India");
  const [labelCounts, setLabelCounts] = React.useState<Record<string, number>>({});
  const [labelSize, setLabelSize] = React.useState<"70x40" | "75x38">("70x40");
  const [labelsGenerating, setLabelsGenerating] = React.useState(false);
  const [phase1DialogOpen, setPhase1DialogOpen] = React.useState(false);
  const [phase1StartBox, setPhase1StartBox] = React.useState("");
  const [phase1EndBox, setPhase1EndBox] = React.useState("");
  const [phase1LabelSize, setPhase1LabelSize] = React.useState<"70x40" | "75x38">("70x40");
  const [phase1Generating, setPhase1Generating] = React.useState(false);
  const [wipBusy, setWipBusy] = React.useState(false);

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
    if (!consignmentsData?.content?.length) {
      setPackingConsignmentId(null);
      return;
    }
    setPackingConsignmentId((prev) => {
      if (prev != null && consignmentsData.content.some((c) => c.id === prev)) {
        return prev;
      }
      return consignmentsData.content[0]?.id ?? null;
    });
  }, [consignmentsData]);

  async function reloadConsignmentsTab() {
    setConsignmentsLoading(true);
    try {
      const res = await authFetchRaw(
        `/api/outbound/purchase-orders/${poId}/consignments?page=1&count=200`
      );
      const j = (await res.json()) as ConsignmentsListPayload & { error?: string };
      if (res.ok) setConsignmentsData(j);
      else setConsignmentsData(null);
    } catch {
      setConsignmentsData(null);
    } finally {
      setConsignmentsLoading(false);
    }
  }

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

  React.useEffect(() => {
    if (!labelDialogOpen) return;
    setLabelStep(1);
    setLabelSize("70x40");
  }, [labelDialogOpen]);

  React.useEffect(() => {
    if (!phase1DialogOpen) return;
    setPhase1LabelSize("70x40");
  }, [phase1DialogOpen]);

  const po = data?.po;
  const isPartial =
    (po?.po_creation_status ?? "").toUpperCase().trim() === "PARTIAL";

  const poTypeOptions = React.useMemo(
    () => OUTBOUND_PO_TYPES.map((t) => ({ key: t, label: t })),
    []
  );

  const openEdit = (field: SaveFieldKey, label: string, value: string) => {
    setEditField(field);
    setEditLabel(label);
    setEditValue(value);
    setEditDateValue(field === "expiry_date" ? parseDateOnlyString(value) : null);
    setEditOpen(true);
  };

  const onSaveEdit = async () => {
    if (!editField) return;

    let valueToSave = editValue;
    if (editField === "expiry_date") {
      if (!editDateValue) {
        toast.error("Set the date using Year / Month / Day, then the Set button.");
        return;
      }
      const release = parseDateOnlyString(po?.po_issue_date ?? "");
      if (release && editDateValue.getTime() <= release.getTime()) {
        toast.error("Expiry date must be after the release date.");
        return;
      }
      valueToSave = formatUtcDateOnly(editDateValue);
    }
    if (editField === "po_type" && !editValue.trim()) {
      toast.error("Select a PO type.");
      return;
    }

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
            value: valueToSave,
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

  const toggleWip = async (newVal: "Y" | "N") => {
    setWipBusy(true);
    try {
      const res = await authFetchRaw(
        `/api/outbound/purchase-orders/${poId}/eautomate-actions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "save_field", field: "is_wip", value: newVal }),
        }
      );
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? res.statusText);
      toast.success(`WIP marked as ${newVal === "Y" ? "Yes" : "No"}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update WIP");
    } finally {
      setWipBusy(false);
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
            ? `sku-report-${pn}.xlsx`
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
        rows?: LabelRow[];
      };
      if (!res.ok) {
        const parts = [
          j.error ?? j.detail ?? j.message ?? res.statusText,
          j.hint,
          j.upstream_url ? `URL: ${j.upstream_url}` : "",
        ].filter(Boolean);
        throw new Error(parts.join(" — "));
      }
      if (action === "generate_product_labels" && Array.isArray(j.rows)) {
        const rows = j.rows as LabelRow[];
        const counts: Record<string, number> = {};
        for (const row of rows) counts[row.po_secondary_sku] = 0;
        setLabelRows(rows);
        setLabelCounts(counts);
        setLabelStep(1);
        setLabelDialogOpen(true);
        return;
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
        parseResult?: { rowsParsed?: number };
      };
      if (!res.ok) throw new Error(j.error ?? res.statusText);
      const isSpreadsheet =
        file.name.toLowerCase().endsWith(".csv") ||
        file.name.toLowerCase().endsWith(".xlsx") ||
        file.name.toLowerCase().endsWith(".xls");
      if (j.listingsUpdated) {
        toast.success(
          `File uploaded and ${j.parseResult?.rowsParsed ?? 0} line items extracted.`
        );
      } else if (isSpreadsheet) {
        toast.warning(
          "File uploaded but no line items were extracted. Check that column headers match the expected format (download the sample file for reference)."
        );
      } else {
        toast.success("File uploaded");
      }
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
    const f = eaZapFile;
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
      setEaZapFile(null);
      setEaZapUploadInputKey((k) => k + 1);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setEaZapUploading(false);
    }
  };

  const onDownloadLabelsCSV = () => {
    const headers = [
      "Image URL",
      "PO Secondary SKU",
      "Master SKU",
      "Inventory SKU",
      "Pack-Combo SKU",
      "SKU Type",
      "Company Code Primary",
      "Company Code Secondary",
      "EAN Code",
      "Zap EAN",
      "Universal EAN",
      "Size",
      "Color",
      "Title",
      "One Set Contains",
      "Material",
      "Warehouse Quantity",
      "Demand Quantity",
      "Dispatched Quantity",
      "Pending Quantity",
      "MRP at the moment",
      "MRP at the time of PO creation",
    ];
    function esc(v: string): string {
      if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
      return v;
    }
    const lines = [
      headers.map(esc).join(","),
      ...labelRows.map((r) =>
        [
          r.img_url,
          r.po_secondary_sku,
          r.master_sku,
          r.inventory_sku_id,
          r.pack_combo_sku_id,
          r.sku_type,
          r.company_code_primary,
          r.company_code_secondary,
          r.ean_code,
          r.zap_ean ?? "",
          r.universal_ean ?? "",
          r.size,
          r.color,
          r.title,
          r.one_set_contains,
          r.material,
          r.warehouse_quantity,
          r.demand_quantity,
          r.dispatched_quantity,
          String(
            Math.max(
              0,
              (Number(r.demand_quantity) || 0) - (Number(r.dispatched_quantity) || 0)
            )
          ),
          r.mrp_now,
          r.mrp_at_po_creation,
        ]
          .map(esc)
          .join(",")
      ),
    ];
    const csv = "\ufeff" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const pn = (data?.po?.po_number ?? "po").replace(/[/\\?%*:|"<>]/g, "_");
    a.download = `product-labels-data-${pn}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onGenerateLabels = async () => {
    const payloadRows = labelRows
      .filter((r) => (labelCounts[r.po_secondary_sku] ?? 0) > 0)
      .map((r) => ({
        barcode: r.ean_code,
        marketedBy: marketedBy,
        manufacturedBy: manufacturedBy,
        title: r.title || r.po_secondary_sku,
        dateOfManufacture: dateOfManufacture,
        color: r.color,
        brand: brand,
        material: r.material,
        netQuantity: "1",
        productDimension: r.size,
        oneSetContains: r.one_set_contains,
        modelNumber: r.po_secondary_sku,
        mrp: r.mrp_now || r.mrp_at_po_creation,
        countryOfOrigin: countryOfOrigin,
        styleId: r.po_secondary_sku,
        qrSequence: "",
        labelCount: String(labelCounts[r.po_secondary_sku] ?? 0),
      }));

    if (payloadRows.length === 0) {
      toast.error("Enter label count greater than 0 for at least one SKU");
      return;
    }

    setLabelsGenerating(true);
    try {
      const token = getStoredToken();
      const headers = new Headers({ "Content-Type": "application/json" });
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const res = await fetch(apiUrl("/api/labels/generate"), {
        method: "POST",
        headers,
        body: JSON.stringify({
          rows: payloadRows,
          labelSize,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? res.statusText);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const pn = (data?.po?.po_number ?? "po").replace(/[/\\?%*:|"<>]/g, "_");
      a.href = url;
      a.download = `product-labels-${pn}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Label PDF generated");
      setLabelDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate labels");
    } finally {
      setLabelsGenerating(false);
    }
  };

  const onGeneratePhase1Labels = async () => {
    const startBox = Number.parseInt(phase1StartBox, 10);
    const endBox = Number.parseInt(phase1EndBox, 10);
    if (!Number.isFinite(startBox) || !Number.isFinite(endBox)) {
      toast.error("Enter valid start and end box numbers");
      return;
    }
    if (startBox < 1 || endBox < startBox) {
      toast.error("Ensure box range is valid (start <= end)");
      return;
    }

    setPhase1Generating(true);
    try {
      const res = await authFetchRaw(
        `/api/outbound/purchase-orders/${poId}/eautomate-actions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "generate_phase1_box_labels",
            startBox,
            endBox,
            labelSize: phase1LabelSize,
          }),
        }
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string; hint?: string };
        throw new Error([j.error ?? res.statusText, j.hint].filter(Boolean).join(" — "));
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const pn = (data?.po?.po_number ?? "po").replace(/[/\\?%*:|"<>]/g, "_");
      a.href = url;
      a.download = `phase1-${pn}-${startBox}-${endBox}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Phase 1 box labels generated");
      setPhase1DialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate phase 1 box labels");
    } finally {
      setPhase1Generating(false);
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

  const analytics = parseOutboundAnalyticsForSummary(po.analytics_object);
  const wipIsYes = isOutboundPoWip(po.is_wip);
  const ackIsYes = isOutboundPoAcknowledged(po.po_acknowledgement_status);
  const canCreateConsignment = wipIsYes && ackIsYes && canMutate;
  const wip = (po.is_wip ?? "").toUpperCase().trim();
  const listingsEnvelope = (data.listings ?? {}) as OutboundListingsEnvelope;

  const legacyFetch = data.legacyOutboundFileFetchEnabled === true;
  const zapReady = data.zapStorageConfigured === true;
  const summaryTable = (
    <Card className="border-primary/10 shadow-sm overflow-hidden">
      <CardHeader className="border-b bg-gradient-to-r from-primary/8 via-muted/40 to-transparent pb-4">
        <CardTitle className="text-base">Current purchase order summary</CardTitle>
        <CardDescription>
          Live SKU, dispatch and value KPIs — non-metric payloads (such as embedded form data) stay out of
          this block.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8 p-4 sm:p-6">
        {SUMMARY_GROUP_DEFS.map(({ title, keys, gridClassName }) => (
          <section key={title} className="space-y-2">
            <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
              {title}
            </h3>
            <div className={gridClassName}>
              {keys.map((key) => {
                const meta = outboundSummaryMeta(key);
                if (!meta) return null;
                const display = formatSummaryMetric(analytics[key], meta.format);
                return (
                  <OutboundAnalyticsStatChip
                    key={key}
                    label={meta.label}
                    value={display}
                    className={
                      SUMMARY_CHIP_ACCENT[key] ??
                      "border-l-[3px] border-primary/40 from-muted/50 to-transparent"
                    }
                  />
                );
              })}
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  );

  const workflowButtons = (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="border-primary text-primary hover:bg-primary/5 h-auto min-h-11 w-full whitespace-normal py-2"
        disabled={!canMutate || stubBusy !== null || ackIsYes}
        onClick={() => void onStubWorkflow("acknowledge")}
      >
        {stubBusy === "acknowledge" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : ackIsYes ? (
          "Purchase order acknowledged"
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
        onClick={() => setPhase1DialogOpen(true)}
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
              {po.calculated_po_status ? (
                <div
                  className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
                  role="status"
                >
                  PO Status: {po.calculated_po_status}
                </div>
              ) : null}

              <Card className="border-primary/10 shadow-sm">
                <CardHeader className="border-b bg-gradient-to-r from-primary/8 via-muted/40 to-transparent pb-4">
                  <CardTitle className="text-lg">Purchase order</CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-mono font-semibold text-foreground">{po.po_number}</span>
                    {po.company_name ? (
                      <>
                        <span className="text-muted-foreground" aria-hidden>
                          ·
                        </span>
                        <CompanyNameWithLogo
                          name={po.company_name}
                          size={18}
                          className="text-muted-foreground"
                        />
                      </>
                    ) : null}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 p-4 sm:p-6">

                  {/* ── PO details: location & dates ── */}
                  <div className="grid gap-x-6 gap-y-4 rounded-lg border bg-muted/25 p-3 sm:grid-cols-3">
                    <EditableRow
                      label="Reference Location"
                      canEdit={canMutate}
                      onEdit={() =>
                        openEdit("delivery_city", "Reference Location", po.delivery_city ?? "")
                      }
                    >
                      {po.delivery_city ?? "—"}
                    </EditableRow>
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
                  </div>

                  {/* ── Identity & workflow ── */}
                  <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="WIP status">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "font-semibold",
                            !wipIsYes && "text-muted-foreground",
                            wipIsYes && "text-green-600 dark:text-green-500"
                          )}
                        >
                          {wipIsYes ? "Yes" : wip === "N" || wip === "NO" ? "No" : (po.is_wip ?? "—")}
                        </span>
                        {canMutate && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant={wipIsYes ? "default" : "outline"}
                              className="h-6 px-2 text-xs"
                              disabled={wipBusy || wipIsYes}
                              onClick={() => void toggleWip("Y")}
                            >
                              Y
                            </Button>
                            <Button
                              size="sm"
                              variant={wip === "N" || wip === "NO" ? "default" : "outline"}
                              className="h-6 px-2 text-xs"
                              disabled={wipBusy || wip === "N" || wip === "NO"}
                              onClick={() => void toggleWip("N")}
                            >
                              N
                            </Button>
                          </div>
                        )}
                      </div>
                    </Field>
                    <Field label="Sold Via">{po.sold_via ?? "—"}</Field>
                    <EditableRow
                      label="PO Type"
                      canEdit={canMutate}
                      onEdit={() => openEdit("po_type", "PO Type", po.po_type ?? "")}
                    >
                      {po.po_type ?? "—"}
                    </EditableRow>
                  </div>

                  {/* ── Row 2: Operational status ── */}
                  <div className="grid gap-x-6 gap-y-4 rounded-lg border bg-muted/20 p-3 sm:grid-cols-3">
                    <Field label="PO creation status">{po.po_creation_status ?? "—"}</Field>
                    <Field label="Acknowledgement">{po.po_acknowledgement_status ?? "—"}</Field>
                    <Field label="Fulfillment">{po.po_fulfillment_status ?? "—"}</Field>
                  </div>

                  {/* ── Row 3: Addresses side-by-side ── */}
                  <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                    <div className="rounded-md border bg-muted/10 p-3">
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
                        <p className="text-muted-foreground font-normal whitespace-pre-wrap text-xs leading-relaxed">
                          {po.delivery_address ?? "—"}
                        </p>
                      </EditableRow>
                    </div>
                    <div className="rounded-md border bg-muted/10 p-3">
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
                        <p className="text-muted-foreground font-normal whitespace-pre-wrap text-xs leading-relaxed">
                          {po.billing_address ?? "—"}
                        </p>
                      </EditableRow>
                    </div>
                  </div>

                  {/* ── Row 4: Buyer details ── */}
                  <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Buyer Company">
                      <CompanyNameWithLogo name={po.company_name} size={22} />
                    </Field>
                    <Field label="Buyer GSTIN">
                      <span className="font-mono text-xs">{po.buyer_gstin ?? "—"}</span>
                    </Field>
                    <Field label="PO Number">
                      <span className="font-mono">{po.po_number}</span>
                    </Field>
                  </div>

                  {/* ── Row 5: Remarks ── */}
                  <div className="rounded-md border border-amber-200/80 bg-amber-50/80 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                    <EditableRow
                      label="Remarks"
                      canEdit={canMutate}
                      onEdit={() => openEdit("remarks", "Remarks", po.remarks ?? "")}
                    >
                      <p className="text-muted-foreground font-normal whitespace-pre-wrap text-sm">
                        {po.remarks?.trim() ? po.remarks : "—"}
                      </p>
                    </EditableRow>
                  </div>

                  {/* ── Row 6: Audit trail — least important, compact ── */}
                  <div className="grid gap-x-6 gap-y-3 border-t pt-4 sm:grid-cols-3">
                    <Field label="Created by">{po.created_by ?? "—"}</Field>
                    <Field label="Created at">{fmtDateTime(po.created_at)}</Field>
                    <Field label="Updated at">{fmtDateTime(po.updated_at)}</Field>
                  </div>
                </CardContent>
              </Card>

              <OutboundPoDocumentsSection
                zapAttachments={data.zapAttachments}
                eautomateFiles={data.eautomateFiles}
                legacyFetch={legacyFetch}
                zapReady={zapReady}
                eautomateDownloadConfigured={data.eautomateDownloadConfigured === true}
                canMutate={canMutate}
                canWritePo={canWritePo}
                dlBusy={dlBusy}
                onDownloadZap={(id, name) => void onDownloadZap(id, name)}
                onDownloadEa={(id, name) => void onDownloadEa(id, name)}
                eaZapFile={eaZapFile}
                eaZapUploadInputKey={eaZapUploadInputKey}
                eaZapUploading={eaZapUploading}
                onEaZapFileChange={setEaZapFile}
                onUploadEaZap={() => void onUploadEaZap()}
                uploadSlot={
                  <OutboundPoAddDocumentUpload
                    canMutate={canMutate}
                    file={file}
                    uploading={uploading}
                    onFileChange={setFile}
                    onUpload={() => void onUpload()}
                  />
                }
              />

              {summaryTable}

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">SKU line items</CardTitle>
                  <CardDescription>
                    From uploaded spreadsheet or eAutomate sync.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <OutboundPoLineItemsTable listings={listingsEnvelope} />
                </CardContent>
              </Card>
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
          {canCreateConsignment ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={() => setCreateConsignmentOpen(true)}
              >
                Create New Consignment
              </Button>
              <p className="text-muted-foreground text-xs">
                Creates an empty consignment — enter line items on the consignment detail page.
              </p>
            </div>
          ) : !wipIsYes ? (
            <p className="text-muted-foreground rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950/30">
              Mark this PO as WIP on the Details tab (WIP status → Y) before creating consignments.
            </p>
          ) : !ackIsYes ? (
            <p className="text-muted-foreground rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950/30">
              Acknowledge this purchase order (Acknowledge Purchase Order on the workflow panel) before
              creating consignments.
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

          {canWritePo && consignmentsData?.content?.length ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Enter consignment lines</CardTitle>
                <CardDescription className="text-xs">
                  Line items (bin packing) are entered on each consignment&apos;s detail page after
                  creation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="max-w-sm space-y-1">
                  <Label className="text-xs">Consignment</Label>
                  <SearchableSelect
                    value={
                      packingConsignmentId != null
                        ? String(packingConsignmentId)
                        : null
                    }
                    onChange={(key) => setPackingConsignmentId(Number(key))}
                    options={consignmentsData.content.map((c) => ({
                      key: String(c.id),
                      label: `#${c.id} · ${c.consignment_status ?? "—"}`,
                    }))}
                    placeholder="Select consignment"
                  />
                </div>
                {packingConsignmentId != null ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/outbound/consignments/${packingConsignmentId}`}>
                      Open consignment #{packingConsignmentId} to enter lines
                    </Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

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
            {editField === "po_type" ? (
              <SearchableSelect
                value={editValue.trim() || null}
                onChange={setEditValue}
                options={poTypeOptions}
                placeholder="Select PO Type"
                emptyText="No PO types"
                variant="soft"
              />
            ) : editField === "expiry_date" ? (
              <TripletDatePicker
                title={editLabel}
                value={editDateValue}
                onSet={(d) => {
                  setEditDateValue(d);
                  setEditValue(formatUtcDateOnly(d));
                }}
                setButtonLabel="Set date"
                embedded
              />
            ) : (
              <>
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
              </>
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

      <CreateConsignmentDialog
        open={createConsignmentOpen}
        onOpenChange={setCreateConsignmentOpen}
        poId={po.id}
        poNumber={po.po_number}
        onCreated={() => {
          void load();
          void reloadConsignmentsTab();
        }}
      />

      <Dialog open={labelDialogOpen} onOpenChange={setLabelDialogOpen}>
        <DialogContent className="flex h-[90vh] max-h-[720px] w-[95vw] max-w-6xl flex-col gap-0 p-0">
          <div className="shrink-0 border-b px-6 py-4">
            <DialogTitle className="text-base font-semibold">Generate Product Labels</DialogTitle>
            <DialogDescription className="mt-1 text-sm">
              {labelStep === 1
                ? "Step 1: Data required to generate labels will be fetched here by the system. Verify the data to proceed."
                : labelStep === 2
                  ? "Step 2: Modify fixed label settings."
                  : labelStep === 3
                    ? "Step 3: Provide the number of labels to print."
                    : "Step 4: Select label size settings."}
            </DialogDescription>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {labelStep === 1 ? (
              <>
                <p className="mb-3 text-sm font-medium text-green-600 dark:text-green-400">
                  No error was found
                </p>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="bg-muted/60 border-b text-xs font-semibold uppercase tracking-wide">
                        <th className="px-3 py-2 whitespace-nowrap">PO Secondary SKU</th>
                        <th className="px-3 py-2 whitespace-nowrap">Company Code Primary</th>
                        <th className="px-3 py-2 whitespace-nowrap">Company Code Secondary</th>
                        <th className="px-3 py-2 whitespace-nowrap">EAN Code</th>
                        <th className="px-3 py-2 whitespace-nowrap">Zap EAN</th>
                        <th className="px-3 py-2 whitespace-nowrap">Universal EAN</th>
                        <th className="px-3 py-2 whitespace-nowrap">Size</th>
                        <th className="px-3 py-2 whitespace-nowrap">Color</th>
                        <th className="px-3 py-2 whitespace-nowrap">One Set Contains</th>
                        <th className="px-3 py-2 whitespace-nowrap">Material</th>
                        <th className="px-3 py-2 whitespace-nowrap">MRP at the moment</th>
                        <th className="px-3 py-2 whitespace-nowrap">MRP at the time of PO creation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {labelRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={12}
                            className="text-muted-foreground px-3 py-6 text-center text-sm"
                          >
                            No rows found.
                          </td>
                        </tr>
                      ) : (
                        labelRows.map((row, i) => (
                          <tr key={row.po_secondary_sku || i} className="hover:bg-muted/30 transition-colors">
                            <td className="px-3 py-2 font-mono text-xs font-medium">
                              {row.po_secondary_sku || "—"}
                            </td>
                            <td className="px-3 py-2 tabular-nums">{row.company_code_primary || "—"}</td>
                            <td className="px-3 py-2 font-mono text-xs">{row.company_code_secondary || "—"}</td>
                            <td className="px-3 py-2 font-mono text-xs tabular-nums">{row.ean_code || "—"}</td>
                            <td className="px-3 py-2 font-mono text-xs tabular-nums">
                              {row.zap_ean || "—"}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs tabular-nums">
                              {row.universal_ean || "—"}
                            </td>
                            <td className="px-3 py-2 text-xs">{row.size || "—"}</td>
                            <td className="px-3 py-2">{row.color || "—"}</td>
                            <td className="max-w-[220px] px-3 py-2 text-xs leading-snug">
                              {row.one_set_contains || "—"}
                            </td>
                            <td className="px-3 py-2">{row.material || "—"}</td>
                            <td className="px-3 py-2 tabular-nums font-medium">{row.mrp_now || "—"}</td>
                            <td className="px-3 py-2 tabular-nums">{row.mrp_at_po_creation || "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}

            {labelStep === 2 ? (
              <div className="max-w-3xl space-y-3">
                <div className="rounded-md border p-3">
                  <Label className="text-xs">Select Marketed By:</Label>
                  <select
                    className="border-input bg-background mt-2 h-9 w-full rounded-md border px-3 text-sm"
                    value={marketedBy}
                    onChange={(e) => setMarketedBy(e.target.value)}
                  >
                    {LABEL_CONTACT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded-md border p-3">
                  <Label className="text-xs">Select Manufactured By:</Label>
                  <select
                    className="border-input bg-background mt-2 h-9 w-full rounded-md border px-3 text-sm"
                    value={manufacturedBy}
                    onChange={(e) => setManufacturedBy(e.target.value)}
                  >
                    {LABEL_CONTACT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded-md border p-3">
                  <Label className="text-xs">Date of Manufacture</Label>
                  <Input
                    className="mt-2"
                    value={dateOfManufacture}
                    onChange={(e) => setDateOfManufacture(e.target.value)}
                  />
                </div>
                <div className="rounded-md border p-3">
                  <Label className="text-xs">Brand</Label>
                  <Input className="mt-2" value={brand} onChange={(e) => setBrand(e.target.value)} />
                </div>
                <div className="rounded-md border p-3">
                  <Label className="text-xs">Country of Origin</Label>
                  <Input
                    className="mt-2"
                    value={countryOfOrigin}
                    onChange={(e) => setCountryOfOrigin(e.target.value)}
                  />
                </div>
              </div>
            ) : null}

            {labelStep === 3 ? (
              <>
                <Button type="button" variant="outline" size="sm" onClick={onDownloadLabelsCSV}>
                  Download Labels Data
                </Button>
                <div className="mt-3 overflow-x-auto rounded-md border">
                  <table className="w-full min-w-[1800px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-muted/60 border-b">
                        <th className="px-2 py-2">Image</th>
                        <th className="px-2 py-2">PO Secondary SKU</th>
                        <th className="px-2 py-2">Master SKU</th>
                        <th className="px-2 py-2">Inventory SKU</th>
                        <th className="px-2 py-2">Pack-Combo SKU</th>
                        <th className="px-2 py-2">SKU Type</th>
                        <th className="px-2 py-2">Company Code Primary</th>
                        <th className="px-2 py-2">EAN Code</th>
                        <th className="px-2 py-2">Zap EAN</th>
                        <th className="px-2 py-2">Universal EAN</th>
                        <th className="px-2 py-2">Size</th>
                        <th className="px-2 py-2">Color</th>
                        <th className="px-2 py-2">MRP</th>
                        <th className="px-2 py-2">Title</th>
                        <th className="px-2 py-2">One Set Contains</th>
                        <th className="px-2 py-2">Warehouse Quantity</th>
                        <th className="px-2 py-2">Demand Quantity</th>
                        <th className="px-2 py-2">Packed Quantity</th>
                        <th className="px-2 py-2">Dispatched Quantity</th>
                        <th className="px-2 py-2">Pending Quantity</th>
                        <th className="px-2 py-2">Labels Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {labelRows.map((row, i) => {
                        const demand = Number(row.demand_quantity) || 0;
                        const dispatched = Number(row.dispatched_quantity) || 0;
                        const pending = Math.max(0, demand - dispatched);
                        return (
                          <tr key={row.po_secondary_sku || i} className="border-b align-top">
                            <td className="px-2 py-2">
                              {row.img_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={row.img_url} alt={row.po_secondary_sku} className="h-10 w-10 rounded object-cover" />
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-2 py-2 font-mono">{row.po_secondary_sku || "—"}</td>
                            <td className="px-2 py-2">{row.master_sku || "—"}</td>
                            <td className="px-2 py-2">{row.inventory_sku_id || "—"}</td>
                            <td className="px-2 py-2">{row.pack_combo_sku_id || "—"}</td>
                            <td className="px-2 py-2">{row.sku_type || "—"}</td>
                            <td className="px-2 py-2">{row.company_code_primary || "—"}</td>
                            <td className="px-2 py-2">{row.ean_code || "—"}</td>
                            <td className="px-2 py-2 font-mono text-xs tabular-nums">
                              {row.zap_ean || "—"}
                            </td>
                            <td className="px-2 py-2 font-mono text-xs tabular-nums">
                              {row.universal_ean || "—"}
                            </td>
                            <td className="px-2 py-2">{row.size || "—"}</td>
                            <td className="px-2 py-2">{row.color || "—"}</td>
                            <td className="px-2 py-2 tabular-nums">{row.mrp_now || row.mrp_at_po_creation || "—"}</td>
                            <td className="max-w-[260px] px-2 py-2">{row.title || "—"}</td>
                            <td className="max-w-[220px] px-2 py-2">{row.one_set_contains || "—"}</td>
                            <td className="px-2 py-2 tabular-nums">{row.warehouse_quantity || "0"}</td>
                            <td className="px-2 py-2 tabular-nums">{row.demand_quantity || "0"}</td>
                            <td className="px-2 py-2 tabular-nums">0</td>
                            <td className="px-2 py-2 tabular-nums">{row.dispatched_quantity || "0"}</td>
                            <td className="px-2 py-2 tabular-nums">{String(pending)}</td>
                            <td className="px-2 py-2">
                              <Input
                                type="number"
                                min={0}
                                value={String(labelCounts[row.po_secondary_sku] ?? 0)}
                                onChange={(e) =>
                                  setLabelCounts((prev) => ({
                                    ...prev,
                                    [row.po_secondary_sku]: Math.max(
                                      0,
                                      Number.parseInt(e.target.value || "0", 10) || 0
                                    ),
                                  }))
                                }
                                className="h-8 w-24"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}

            {labelStep === 4 ? (
              <div className="max-w-md rounded-md border p-4">
                <p className="mb-2 text-sm font-medium">Label Size Settings</p>
                <label className="mb-2 flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="label-size"
                    checked={labelSize === "70x40"}
                    onChange={() => setLabelSize("70x40")}
                  />
                  70 x 40 mm
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="label-size"
                    checked={labelSize === "75x38"}
                    onChange={() => setLabelSize("75x38")}
                  />
                  75 x 38 mm
                </label>
              </div>
            ) : null}
          </div>

          <div className="shrink-0 flex items-center justify-end gap-2 border-t bg-muted/20 px-6 py-3">
            <Button type="button" variant="outline" onClick={() => setLabelDialogOpen(false)}>
              Cancel
            </Button>
            {labelStep > 1 ? (
              <Button type="button" variant="outline" onClick={() => setLabelStep((s) => (s - 1) as 1 | 2 | 3 | 4)}>
                Back
              </Button>
            ) : null}
            {labelStep < 4 ? (
              <Button
                type="button"
                disabled={labelRows.length === 0}
                onClick={() => setLabelStep((s) => (s + 1) as 1 | 2 | 3 | 4)}
              >
                Next
              </Button>
            ) : (
              <Button type="button" disabled={labelsGenerating} onClick={() => void onGenerateLabels()}>
                {labelsGenerating ? <Loader2 className="size-4 animate-spin" /> : "Generate Labels"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={phase1DialogOpen} onOpenChange={setPhase1DialogOpen}>
        <DialogContent className="flex h-[86vh] max-h-[620px] w-[95vw] max-w-6xl flex-col gap-0 p-0">
          <div className="shrink-0 border-b px-6 py-4">
            <DialogTitle className="text-base font-semibold">Generate Phase 1 Box Labels</DialogTitle>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            <div className="max-w-md space-y-5">
              <div className="rounded-md border p-4">
                <p className="text-sm font-semibold">Label Count Settings</p>
                <div className="mt-3 space-y-3">
                  <div>
                    <Label className="text-muted-foreground text-xs">
                      Enter the starting box number.
                    </Label>
                    <Input
                      className="mt-1"
                      inputMode="numeric"
                      value={phase1StartBox}
                      onChange={(e) => setPhase1StartBox(e.target.value.replace(/[^\d]/g, ""))}
                    />
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">
                      Enter the ending box number.
                    </Label>
                    <Input
                      className="mt-1"
                      inputMode="numeric"
                      value={phase1EndBox}
                      onChange={(e) => setPhase1EndBox(e.target.value.replace(/[^\d]/g, ""))}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-md border p-4">
                <p className="mb-3 text-sm font-semibold">Label Size Settings</p>
                <label className="mb-2 flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="phase1-label-size"
                    checked={phase1LabelSize === "70x40"}
                    onChange={() => setPhase1LabelSize("70x40")}
                  />
                  70 x 40 mm
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="phase1-label-size"
                    checked={phase1LabelSize === "75x38"}
                    onChange={() => setPhase1LabelSize("75x38")}
                  />
                  75 x 38 mm
                </label>
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t bg-muted/20 px-6 py-3">
            <Button type="button" variant="outline" onClick={() => setPhase1DialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={phase1Generating} onClick={() => void onGeneratePhase1Labels()}>
              {phase1Generating ? <Loader2 className="size-4 animate-spin" /> : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
