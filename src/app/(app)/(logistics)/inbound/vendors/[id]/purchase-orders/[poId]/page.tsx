"use client";

/* eslint-disable @next/next/no-img-element */

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileText,
  Pencil,
  XCircle,
  Package,
  Download,
  Plus,
  Info,
} from "lucide-react";
import { apiFetch, apiUrl, getStoredToken } from "@/lib/api-browser";
import { formatGrnLabel, formatPoLabel } from "@/lib/idDisplay";
import { grnStatusDisplay } from "@/lib/inboundGrnStatus";
import {
  canCancelPo,
  poCancelBlockReason,
  type PoCancelGrnRow,
} from "@/lib/inboundPoCancelGuard";
import {
  deriveDisplayName,
  deriveFillPct,
  deriveLocation,
  derivePoDisplayStatus,
  isZapCancelled as deriveIsZapCancelled,
  numberStringOrDash,
} from "@/lib/inboundPoDetailUi";
import {
  applyInvoiceBoxCountChange,
  buildPoLinePreviewRows,
  initialNewGrnBoxFieldState,
  mergeActualBoxCountChange,
} from "@/lib/inboundNewGrnModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FillRateBar } from "@/components/ui/fill-rate-bar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type JsonRecord = Record<string, unknown>;

type PoLineRow = {
  line_index: number;
  sku_id: string | null;
  raw: JsonRecord;
};

type PoGrnRow = {
  sort_index: number;
  grn_id: number | null;
  raw: JsonRecord;
};

type CreatedGrnRow = { grn_id: number };

function parseNonNegativeInt(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return null;
  return n;
}

type PoDetailHeader = {
  po_id: number;
  vendor_id: number;
  vendor_name: string | null;
  vendor_city: string | null;
  vendor_state: string | null;
  expected_date: string | null;
  status: string | null;
  po_remarks: string | null;
  created_by: string | null;
  modified_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  date_published: string | null;
  sku_count: number;
  total_quantity: number;
  number_of_grns: number;
  total_invoice_quantity: number;
  total_accepted_quantity: number;
  total_rejected_quantity: number;
  sku_fill_rate: number;
  quantity_fill_rate: number;
  /** Drives ZP- prefix in the page title. Doctrine #5. */
  source: "zap" | "eautomate";
};

type PoDetailBundle = {
  header: PoDetailHeader;
  snapshot: {
    po_id: number;
    vendor_id: number;
    synced_at: string | null;
    vendor_raw: JsonRecord;
    vendor_listings_raw: unknown;
    sku_names_raw: unknown;
    po_raw: JsonRecord;
  };
  lines: PoLineRow[];
  grns: PoGrnRow[];
};

const displayFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function formatDt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return displayFormatter.format(d);
}

function pick(raw: JsonRecord | null | undefined, keys: string[]): string {
  if (!raw) return "—";
  for (const k of keys) {
    const v = raw[k];
    if (v != null && v !== "") return String(v);
  }
  return "—";
}

function numStr(raw: JsonRecord | null | undefined, keys: string[]): string {
  if (!raw) return "—";
  for (const k of keys) {
    const v = raw[k];
    if (v != null && v !== "") return String(v);
  }
  const listing = raw.listing as JsonRecord | undefined;
  if (listing) {
    for (const k of keys) {
      const v = listing[k];
      if (v != null && v !== "") return String(v);
    }
  }
  return "—";
}

function asRecord(v: unknown): JsonRecord | null {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as JsonRecord;
  return null;
}

function buildSkuNameMap(names: unknown): Map<string, string> {
  const m = new Map<string, string>();
  if (!Array.isArray(names)) return m;
  for (const row of names) {
    const r = row as JsonRecord;
    const sku = String(r.sku_id ?? r.skuId ?? "").trim();
    if (!sku) continue;
    const name = String(
      r.description ??
        r.name ??
        r.title ??
        r.listing_title ??
        r.product_name ??
        ""
    ).trim();
    if (name) m.set(sku, name);
  }
  return m;
}

function buildListingBySku(items: unknown): Map<string, JsonRecord> {
  const m = new Map<string, JsonRecord>();
  if (!Array.isArray(items)) return m;
  for (const it of items) {
    const row = it as JsonRecord;
    const sku = String(row.sku_id ?? "").trim();
    const L = asRecord(row.listing);
    if (L?.sku_id) {
      m.set(String(L.sku_id), L);
    } else if (sku && L) {
      m.set(sku, L);
    } else if (sku) {
      m.set(sku, row);
    }
  }
  return m;
}

function listingImageUrl(L: JsonRecord | null | undefined): string | null {
  if (!L) return null;
  const u = pick(L, [
    "img_hd",
    "img_white",
    "img_wdim",
    "img_link1",
    "image_url",
    "thumbnail_url",
    "thumbnail",
  ]);
  return u === "—" ? null : u;
}

function statusPublishedClass(s: string | null | undefined): string {
  if (!s) return "";
  const up = s.trim().toUpperCase();
  if (up === "CANCELLED") {
    return "bg-destructive/15 text-destructive border-destructive/30";
  }
  if (up === "PUBLISHED" || up === "ACTIVE") {
    return "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/30";
  }
  if (up === "PENDING") {
    return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
  }
  return "";
}

function statusClosedClass(s: string | null | undefined): string {
  if (!s) return "";
  const up = s.trim().toUpperCase();
  if (up === "CLOSED" || up === "DONE" || up === "COMPLETED") {
    return "text-violet-600 dark:text-violet-400 font-medium";
  }
  return "";
}

type PoStatusTooltip = {
  meaning: string;
  nextActions: string[];
};

function poStatusTooltip(
  displayStatus: string,
  ctx: {
    grnCount: number;
    poCancelAllowed: boolean;
  }
): PoStatusTooltip | null {
  switch (displayStatus.trim().toUpperCase()) {
    case "PENDING":
      return {
        meaning:
          "PO has been created but not yet published/issued to the vendor. GRNs can still be opened against it.",
        nextActions:
          ctx.grnCount === 0
            ? [
                "Open New GRN when goods arrive",
                "Add internal notes for your team",
                ...(ctx.poCancelAllowed
                  ? ["Cancel PO only before receipt starts"]
                  : []),
              ]
            : [
                "Continue receiving in the GRN section below",
                "Download PDF or Excel to share with the vendor",
              ],
      };
    case "PUBLISHED":
      return {
        meaning: "PO is published and active for receiving.",
        nextActions:
          ctx.grnCount === 0
            ? ["Open New GRN to start receiving goods"]
            : [
                "Enter quantities and prices on the GRN",
                "Upload vendor invoice on the GRN before close",
              ],
      };
    case "CANCELLED":
      return {
        meaning: "PO has been cancelled; no further GRNs should be created.",
        nextActions: [],
      };
    case "MODIFICATION":
      return {
        meaning: "A modification has been requested on this PO.",
        nextActions: [
          "Review updated line quantities with the vendor",
          "Pause new receipts until changes are confirmed",
        ],
      };
    default:
      return null;
  }
}

function PoStatusTooltipBody({
  meaning,
  nextActions,
  vendorId,
}: PoStatusTooltip & { vendorId: string }) {
  const listingsHref = `/inbound/vendors/${encodeURIComponent(vendorId)}?tab=listings`;
  return (
    <div className="space-y-2">
      <p>{meaning}</p>
      {nextActions.length > 0 ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-background/75">
            Next steps
          </p>
          <ul className="mt-1 space-y-0.5">
            {nextActions.map((action) => (
              <li key={action} className="flex gap-1.5 text-xs leading-snug">
                <span aria-hidden className="text-background/60">
                  ·
                </span>
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Link
        href={listingsHref}
        className="inline-block text-xs font-medium underline underline-offset-2 hover:text-background/90"
      >
        View vendor SKU list →
      </Link>
    </div>
  );
}

function ActionButtonTooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        delay={150}
        render={<span className="inline-flex">{children}</span>}
      />
      <TooltipContent side="bottom" className="max-w-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function grnIdFromRow(g: PoGrnRow): number | null {
  if (g.grn_id != null && Number.isFinite(Number(g.grn_id))) return Number(g.grn_id);
  const p = pick(g.raw, ["grn_id", "grnId"]);
  if (p === "—") return null;
  const n = Number(p);
  return Number.isFinite(n) ? n : null;
}

export default function InboundPoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const vendorId = typeof params.id === "string" ? params.id : "";
  const poId = typeof params.poId === "string" ? params.poId : "";
  const [bundle, setBundle] = React.useState<PoDetailBundle | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [modifyOpen, setModifyOpen] = React.useState(false);
  const [modifyNotes, setModifyNotes] = React.useState("");
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [actionBusy, setActionBusy] = React.useState(false);

  const [newGrnOpen, setNewGrnOpen] = React.useState(false);
  const [newGrnInvoice, setNewGrnInvoice] = React.useState("");
  const [newGrnBoxInvoice, setNewGrnBoxInvoice] = React.useState("");
  const [newGrnActualBox, setNewGrnActualBox] = React.useState("");
  const [newGrnActualBoxManual, setNewGrnActualBoxManual] = React.useState(false);
  const [newGrnBusy, setNewGrnBusy] = React.useState(false);

  const newGrnMissingFields = React.useMemo(() => {
    const missing: string[] = [];
    if (newGrnInvoice.trim() === "") missing.push("vendor invoice number");
    if (parseNonNegativeInt(newGrnBoxInvoice) === null)
      missing.push("box count in invoice");
    if (parseNonNegativeInt(newGrnActualBox) === null)
      missing.push("actual box count received");
    return missing;
  }, [newGrnInvoice, newGrnBoxInvoice, newGrnActualBox]);

  const newGrnCanSubmit = newGrnMissingFields.length === 0;

  const reloadBundle = React.useCallback(async () => {
    if (!vendorId || !poId) return;
    setLoading(true);
    try {
      const data = await apiFetch<PoDetailBundle>(
        `/api/inbound/vendors/${encodeURIComponent(vendorId)}/purchase-orders/${encodeURIComponent(poId)}/details`
      );
      setBundle(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load PO");
      setBundle(null);
    } finally {
      setLoading(false);
    }
  }, [vendorId, poId]);

  React.useEffect(() => {
    if (!vendorId || !poId) {
      setLoading(false);
      return;
    }
    let c = false;
    (async () => {
      setLoading(true);
      try {
        const data = await apiFetch<PoDetailBundle>(
          `/api/inbound/vendors/${encodeURIComponent(vendorId)}/purchase-orders/${encodeURIComponent(poId)}/details`
        );
        if (!c) setBundle(data);
      } catch (e) {
        if (!c) {
          toast.error(e instanceof Error ? e.message : "Failed to load PO");
          setBundle(null);
        }
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [vendorId, poId]);

  const downloadPoDocument = async (format: "pdf" | "xlsx") => {
    setActionBusy(true);
    try {
      const token = getStoredToken();
      const headers = new Headers();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const res = await fetch(
        apiUrl(
          `/api/inbound/vendors/${encodeURIComponent(vendorId)}/purchase-orders/${encodeURIComponent(poId)}/document?format=${format}`
        ),
        { headers }
      );
      if (!res.ok) throw new Error((await res.text()).slice(0, 200));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${poId}_purchase_order.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} download started`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setActionBusy(false);
    }
  };

  const downloadGrnReport = async () => {
    setActionBusy(true);
    try {
      const token = getStoredToken();
      const headers = new Headers();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const res = await fetch(
        apiUrl(
          `/api/inbound/vendors/${encodeURIComponent(vendorId)}/purchase-orders/${encodeURIComponent(poId)}/grn-report`
        ),
        { headers }
      );
      if (!res.ok) throw new Error((await res.text()).slice(0, 200));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `po-${poId}-grn-report.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV download started");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setActionBusy(false);
    }
  };

  const openModify = () => {
    const raw = bundle?.snapshot?.po_raw as Record<string, unknown> | undefined;
    const n = raw?.zap_notes;
    setModifyNotes(typeof n === "string" ? n : "");
    setModifyOpen(true);
  };

  const saveModify = async () => {
    const notes = modifyNotes.trim();
    if (!notes) {
      toast.error("Notes are required");
      return;
    }
    setActionBusy(true);
    try {
      await apiFetch(
        `/api/inbound/vendors/${encodeURIComponent(vendorId)}/purchase-orders/${encodeURIComponent(poId)}/modify`,
        {
          method: "PATCH",
          body: JSON.stringify({ zap_notes: notes }),
        }
      );
      toast.success("PO notes saved");
      setModifyOpen(false);
      setBundle((prev) =>
        prev
          ? {
              ...prev,
              snapshot: {
                ...prev.snapshot,
                po_raw: {
                  ...(prev.snapshot?.po_raw ?? {}),
                  zap_notes: notes,
                },
              },
            }
          : prev
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setActionBusy(false);
    }
  };

  const confirmCancel = async () => {
    setActionBusy(true);
    try {
      await apiFetch(
        `/api/inbound/vendors/${encodeURIComponent(vendorId)}/purchase-orders/${encodeURIComponent(poId)}/cancel`,
        { method: "PATCH" }
      );
      toast.success("Purchase order marked as cancelled");
      setCancelOpen(false);
      await reloadBundle();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setActionBusy(false);
    }
  };

  const openNewGrn = () => {
    const initial = initialNewGrnBoxFieldState();
    setNewGrnInvoice("");
    setNewGrnBoxInvoice(initial.boxInvoice);
    setNewGrnActualBox(initial.boxActual);
    setNewGrnActualBoxManual(initial.actualBoxManuallyEdited);
    setNewGrnOpen(true);
  };

  const onNewGrnInvoiceBoxChange = (value: string) => {
    const next = applyInvoiceBoxCountChange(value, {
      boxActual: newGrnActualBox,
      actualBoxManuallyEdited: newGrnActualBoxManual,
    });
    setNewGrnBoxInvoice(next.boxInvoice);
    setNewGrnActualBox(next.boxActual);
  };

  const onNewGrnActualBoxChange = (value: string) => {
    const next = mergeActualBoxCountChange(value, {
      boxInvoice: newGrnBoxInvoice,
      actualBoxManuallyEdited: newGrnActualBoxManual,
    });
    setNewGrnActualBox(next.boxActual);
    setNewGrnActualBoxManual(next.actualBoxManuallyEdited);
  };

  const resetNewGrnModal = () => {
    const initial = initialNewGrnBoxFieldState();
    setNewGrnInvoice("");
    setNewGrnBoxInvoice(initial.boxInvoice);
    setNewGrnActualBox(initial.boxActual);
    setNewGrnActualBoxManual(initial.actualBoxManuallyEdited);
  };

  const submitNewGrn = async () => {
    const vid = Number(vendorId);
    const pid = Number(poId);
    const boxInv = parseNonNegativeInt(newGrnBoxInvoice);
    const boxAct = parseNonNegativeInt(newGrnActualBox);
    if (
      !Number.isFinite(vid) ||
      !Number.isFinite(pid) ||
      newGrnInvoice.trim() === "" ||
      boxInv === null ||
      boxAct === null
    ) {
      return;
    }
    setNewGrnBusy(true);
    try {
      const row = await apiFetch<CreatedGrnRow>(`/api/inbound/grns`, {
        method: "POST",
        body: JSON.stringify({
          vendor_id: vid,
          po_id: pid,
          vendor_invoice_number: newGrnInvoice.trim(),
          box_count_invoice: boxInv,
          actual_box_count_received: boxAct,
        }),
      });
      toast.success("Draft GRN created");
      setNewGrnOpen(false);
      router.push(`/inbound/grns/${row.grn_id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create GRN");
    } finally {
      setNewGrnBusy(false);
    }
  };

  const snap = bundle?.snapshot;
  const header = bundle?.header;
  const poRaw = snap?.po_raw ?? {};
  const poNotes =
    typeof (poRaw as Record<string, unknown>).zap_notes === "string"
      ? ((poRaw as Record<string, unknown>).zap_notes as string).trim()
      : "";
  const newGrnLinePreview = React.useMemo(
    () => buildPoLinePreviewRows(bundle?.lines ?? []),
    [bundle?.lines]
  );
  const nameBySku = React.useMemo(
    () => buildSkuNameMap(snap?.sku_names_raw),
    [snap?.sku_names_raw]
  );
  const listingBySku = React.useMemo(
    () => buildListingBySku(snap?.vendor_listings_raw),
    [snap?.vendor_listings_raw]
  );

  /** Latest activity across all GRNs on this PO (from merged zap canonical +
   * snapshot data). Falls back to the PO snapshot's po_raw timestamps. */
  const latestGrnActivityIso = React.useMemo<string | null>(() => {
    let best: number | null = null;
    const consider = (raw: unknown): void => {
      if (!raw || typeof raw !== "object") return;
      const r = raw as Record<string, unknown>;
      for (const key of ["updated_at", "createdAt", "created_at", "updatedAt"]) {
        const v = r[key];
        if (typeof v !== "string" || !v) continue;
        const t = new Date(v).getTime();
        if (Number.isFinite(t) && (best == null || t > best)) best = t;
      }
    };
    for (const g of bundle?.grns ?? []) consider(g.raw);
    if (best == null) {
      consider(snap?.po_raw);
    }
    return best == null ? null : new Date(best).toISOString();
  }, [bundle?.grns, snap?.po_raw]);

  const isZapCancelled = deriveIsZapCancelled(poRaw.zap_status);
  const poCancelGrnRows = React.useMemo((): PoCancelGrnRow[] => {
    return (bundle?.grns ?? []).map((g) => {
      const r =
        g.raw && typeof g.raw === "object" && !Array.isArray(g.raw)
          ? (g.raw as Record<string, unknown>)
          : {};
      return { grn_id: grnIdFromRow(g), raw: r };
    });
  }, [bundle?.grns]);
  const poCancelBlock = React.useMemo(
    () => poCancelBlockReason(poCancelGrnRows),
    [poCancelGrnRows]
  );
  const poCancelAllowed = canCancelPo(poCancelGrnRows, isZapCancelled);
  const poStatus = derivePoDisplayStatus(isZapCancelled, header?.status ?? null);
  const poStatusTip = React.useMemo(
    () =>
      poStatusTooltip(poStatus, {
        grnCount: header?.number_of_grns ?? bundle?.grns.length ?? 0,
        poCancelAllowed,
      }),
    [poStatus, header?.number_of_grns, bundle?.grns.length, poCancelAllowed]
  );
  const totalSkus = numberStringOrDash(header?.sku_count);
  const totalReq = numberStringOrDash(header?.total_quantity);
  const totalInv = numberStringOrDash(header?.total_invoice_quantity);
  const totalRej = numberStringOrDash(header?.total_rejected_quantity);
  const skuFill = numberStringOrDash(header?.sku_fill_rate);
  const qtyFill = numberStringOrDash(header?.quantity_fill_rate);

  const invN = header?.total_invoice_quantity ?? 0;
  const accN = header?.total_accepted_quantity ?? 0;
  const rejN = header?.total_rejected_quantity ?? 0;
  const acceptPct = deriveFillPct(accN, invN);
  const rejectPct = deriveFillPct(rejN, invN);

  const vendorName = deriveDisplayName(header?.vendor_name);
  const location = deriveLocation(header?.vendor_city, header?.vendor_state);

  const expiryStr = header?.expected_date ?? null;
  const createdBy = deriveDisplayName(header?.created_by);
  const createdAtStr = header?.created_at ?? null;

  return (
    <TooltipProvider>
    <div className="mx-auto max-w-[1600px] space-y-5 px-2 py-4 md:px-4">
      {/* ── Top bar: breadcrumbs ── */}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href={`/inbound/vendors/${encodeURIComponent(vendorId)}?tab=purchase-orders`}>
            ← Purchase orders
          </Link>
        </Button>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href={`/inbound/vendors/${encodeURIComponent(vendorId)}`}>
            Vendor {vendorId}
          </Link>
        </Button>
      </div>

      <div className="mb-6 space-y-1.5">
        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.12em]">
          Purchase Order
        </p>
        {loading ? (
          <Skeleton className="h-8 w-56" />
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="text-primary font-mono text-3xl font-bold tracking-tight">
              {formatPoLabel(poId, header?.source ?? null)}
            </h1>
            {!loading && bundle && poStatus !== "—" ? (
              (() => {
                const badge = (
                  <Badge
                    variant="outline"
                    className={cn(
                      "gap-1 text-xs",
                      statusPublishedClass(poStatus),
                      poStatusTip && "cursor-help"
                    )}
                  >
                    {poStatus}
                    {poStatusTip ? <Info className="size-3 opacity-70" /> : null}
                  </Badge>
                );
                return poStatusTip ? (
                  <Tooltip>
                    <TooltipTrigger delay={150} render={badge} />
                    <TooltipContent side="bottom" className="max-w-xs">
                      <PoStatusTooltipBody {...poStatusTip} vendorId={vendorId} />
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  badge
                );
              })()
            ) : null}
          </div>
        )}
        <p className="text-muted-foreground max-w-3xl text-sm leading-relaxed">
          Line items, GRNs, and summary for this purchase order.
        </p>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full rounded-lg" />
      ) : null}

      {!loading && !bundle ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Not found</CardTitle>
            <CardDescription>
              Could not load this purchase order. Check that the vendor ID and PO ID are correct.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {!loading && bundle && snap ? (
        <>
          {/* ── Header card: metadata columns + actions ── */}
          <Card className="border-primary/10">
            <CardContent className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4 lg:flex lg:flex-wrap lg:gap-x-12">
                <div className="space-y-0.5">
                  <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                    Vendor
                  </p>
                  <p className="text-sm font-medium leading-snug">{vendorName}</p>
                  {location !== "—" ? (
                    <p className="text-muted-foreground text-xs">{location}</p>
                  ) : null}
                  <Link
                    href={`/inbound/vendors/${encodeURIComponent(vendorId)}`}
                    className="text-primary inline-block text-xs font-medium underline-offset-4 hover:underline"
                  >
                    Vendor {vendorId} →
                  </Link>
                </div>
                <div className="space-y-0.5">
                  <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                    Expiry
                  </p>
                  <p className="text-sm font-medium leading-snug">
                    {formatDt(expiryStr)}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                    Created by
                  </p>
                  <p className="text-sm font-medium leading-snug">{createdBy}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatDt(createdAtStr)}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                    GRNs
                  </p>
                  <p className="text-sm font-medium leading-snug">
                    {numberStringOrDash(header?.number_of_grns)}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-2">
                <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                  Actions
                </p>
                <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center overflow-hidden rounded-md border">
                  <ActionButtonTooltip label="Download PO as PDF">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 rounded-none px-2.5"
                      disabled={actionBusy}
                      onClick={() => void downloadPoDocument("pdf")}
                    >
                      <FileText className="size-3.5" />
                      PDF
                    </Button>
                  </ActionButtonTooltip>
                  <span className="bg-border h-5 w-px" aria-hidden />
                  <ActionButtonTooltip label="Download PO as Excel">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 rounded-none px-2.5"
                      disabled={actionBusy}
                      onClick={() => void downloadPoDocument("xlsx")}
                    >
                      <FileText className="size-3.5" />
                      Excel
                    </Button>
                  </ActionButtonTooltip>
                </div>
                <ActionButtonTooltip label="Add or edit internal team notes">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    disabled={actionBusy}
                    onClick={openModify}
                  >
                    <Pencil className="size-3.5" />
                    Notes
                  </Button>
                </ActionButtonTooltip>
                <ActionButtonTooltip
                  label={
                    !poCancelAllowed
                      ? poCancelBlock?.reason ??
                        (isZapCancelled
                          ? "PO is already cancelled."
                          : "Cannot cancel this PO.")
                      : "Cancel this purchase order before goods receipt starts"
                  }
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive h-8 gap-1.5"
                    disabled={actionBusy || !poCancelAllowed}
                    onClick={() => setCancelOpen(true)}
                  >
                    <XCircle className="size-3.5" />
                    Cancel PO
                  </Button>
                </ActionButtonTooltip>
                </div>
              </div>
              </div>

              <div className="border-t pt-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                    Internal notes
                  </p>
                  {poNotes ? (
                    <p className="text-foreground whitespace-pre-wrap text-sm leading-snug">
                      {poNotes}
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      No internal notes yet — visible to your team only.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Metric strip ── */}
          <div>
            <h2 className="text-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
              PO Summary
            </h2>
            <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-4 xl:grid-cols-8">
              {[
                { label: "Total SKUs", value: totalSkus },
                { label: "Required qty", value: totalReq },
                { label: "Received qty", value: totalInv },
                { label: "Rejected qty", value: totalRej },
              ].map((m) => (
                <Card key={m.label} className="border-primary/10">
                  <CardHeader className="px-3 pb-1 pt-2.5">
                    <CardDescription className="text-[10px] uppercase tracking-wider">
                      {m.label}
                    </CardDescription>
                    <CardTitle className="text-lg font-semibold leading-tight">
                      {m.value}
                    </CardTitle>
                  </CardHeader>
                </Card>
              ))}
              {[
                { label: "SKU fill", value: skuFill },
                { label: "Qty fill", value: qtyFill },
              ].map((m) => (
                <Card key={m.label} className="border-primary/10">
                  <CardHeader className="px-3 pb-1 pt-2.5">
                    <CardDescription className="text-[10px] uppercase tracking-wider">
                      {m.label}
                    </CardDescription>
                    <CardTitle className="pt-0.5">
                      <FillRateBar value={m.value === "—" ? null : Number(m.value)} />
                    </CardTitle>
                  </CardHeader>
                </Card>
              ))}
              {acceptPct != null && (
                <Card className="border-primary/10">
                  <CardHeader className="px-3 pb-1 pt-2.5">
                    <CardDescription className="text-[10px] uppercase tracking-wider">
                      Acceptance %
                    </CardDescription>
                    <CardTitle className="text-lg font-semibold leading-tight text-emerald-600 dark:text-emerald-400">
                      {acceptPct}%
                    </CardTitle>
                  </CardHeader>
                </Card>
              )}
              {rejectPct != null && (
                <Card className="border-primary/10">
                  <CardHeader className="px-3 pb-1 pt-2.5">
                    <CardDescription className="text-[10px] uppercase tracking-wider">
                      Rejection %
                    </CardDescription>
                    <CardTitle className="text-lg font-semibold leading-tight text-red-600 dark:text-red-400">
                      {rejectPct}%
                    </CardTitle>
                  </CardHeader>
                </Card>
              )}
            </div>
          </div>

          {/* ── GRN section (full width, above SKU lines) ── */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-foreground text-sm font-semibold">
                  Goods Receipt Notes
                </h2>
                <Badge variant="secondary" className="text-xs">
                  {bundle.grns.length}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="gap-1.5"
                  disabled={actionBusy || newGrnBusy}
                  onClick={openNewGrn}
                >
                  <Plus className="size-3.5" />
                  Open new GRN
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={actionBusy}
                  onClick={() => void downloadGrnReport()}
                >
                  <Download className="size-3.5" />
                  GRN report
                </Button>
              </div>
            </div>
            <p className="text-muted-foreground text-[11px] leading-snug">
              {header?.source === "zap" ? (
                <span>GRNs are managed in Zap.</span>
              ) : (
                <>
                  <span>GRN data is supplemented by eAutomate sync via </span>
                  <code className="text-[10px]">npm run sync:po:details*</code>
                  <span>.</span>
                </>
              )}
              {latestGrnActivityIso ? (
                <>
                  <span> Last activity: </span>
                  <span className="text-foreground font-medium">
                    {formatDt(latestGrnActivityIso)}
                  </span>
                  <span>.</span>
                </>
              ) : (
                <span> No GRN activity yet.</span>
              )}
              {" "}
              <Link href="/flows" className="text-primary underline-offset-4 hover:underline">
                Workflow guide
              </Link>
            </p>

            {bundle.grns.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No GRNs linked to this PO yet.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {bundle.grns.map((g) => {
                  const r = g.raw;
                  const gid = grnIdFromRow(g);
                  const isZapBacked = r.zap_origin === "zap" || r.zap_origin === "draft";
                  const href = gid != null && isZapBacked ? `/inbound/grns/${gid}` : null;
                  const grnSource: "zap" | "draft" | "eautomate" = isZapBacked
                    ? (r.zap_origin as "zap" | "draft")
                    : "eautomate";
                  const grnLabel =
                    gid != null ? formatGrnLabel(gid, grnSource) : "—";
                  const grnStatusRaw = pick(r, ["grn_status", "status"]);
                  const grnStatus = grnStatusDisplay(grnStatusRaw);
                  return (
                    <Card key={g.sort_index} className="border-primary/20">
                      <CardHeader className="space-y-1.5 pb-2">
                        <CardTitle className="text-sm">
                          {href ? (
                            <Link
                              href={href}
                              className="text-primary underline-offset-4 hover:underline"
                            >
                              GRN {grnLabel}
                            </Link>
                          ) : (
                            <span
                              className="text-foreground"
                              title={
                                gid != null
                                  ? "This GRN exists upstream but has not been imported into zap. Run `npm run sync:grns:all` to enable navigation."
                                  : "GRN id not available"
                              }
                            >
                              GRN {grnLabel}
                            </span>
                          )}
                        </CardTitle>
                        {grnStatus.label !== "—" ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "w-fit text-[10px]",
                              grnStatus.className,
                              grnStatus.help && "cursor-help"
                            )}
                            title={grnStatus.help}
                          >
                            {grnStatus.label}
                          </Badge>
                        ) : null}
                      </CardHeader>
                      <CardContent className="space-y-1.5 text-xs">
                        <div className="grid grid-cols-3 gap-1 text-center">
                          <div>
                            <p className="text-muted-foreground text-[10px]">Accepted</p>
                            <p className="font-medium text-emerald-600 dark:text-emerald-400">
                              {pick(r, ["grn_accepted_quantity", "accepted_quantity"])}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-[10px]">Rejected</p>
                            <p className="font-medium text-red-600 dark:text-red-400">
                              {pick(r, ["grn_rejected_quantity", "rejected_quantity"])}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-[10px]">Shortage</p>
                            <p className="font-medium">
                              {pick(r, ["grn_shortage_quantity", "shortage_quantity"])}
                            </p>
                          </div>
                        </div>
                        <div className="border-t pt-1.5 text-muted-foreground space-y-0.5">
                          <p>
                            Audit: <span className={statusClosedClass(pick(r, ["grn_audit_status", "audit_status"]))}>{pick(r, ["grn_audit_status", "audit_status"])}</span>
                          </p>
                          <p>SKUs: {pick(r, ["grn_sku_count", "sku_count"])}</p>
                          {pick(r, ["grn_sku_count", "sku_count"]) === "0" &&
                          ["OPEN", "CLOSED"].includes(
                            pick(r, ["grn_status", "status"]).toUpperCase()
                          ) ? (
                            <p className="text-[10px]">
                              Totals are derived from GRN line items; run migrate or
                              re-save lines if this looks stale.
                            </p>
                          ) : null}
                          <p>
                            Boxes: {pick(r, ["box_count_invoice", "box_count"])} inv / {pick(r, [
                              "actual_box_count_received",
                              "actual_box_count_recieved",
                            ])} actual
                          </p>
                          <p>Invoice: {pick(r, ["vendor_invoice_number", "invoice"])}</p>
                          <p>
                            {pick(r, ["created_by", "createdBy"])} · {formatDt(
                              String(r.created_at ?? r.createdAt ?? "") || null
                            )}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── SKU lines (full width) ── */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-foreground text-sm font-semibold">
                  SKU Lines
                </h2>
                <Badge variant="secondary" className="text-xs">
                  {bundle.lines.length}
                </Badge>
              </div>
              <Link
                href={`/inbound/vendors/${encodeURIComponent(vendorId)}?tab=listings`}
                className="text-primary text-xs font-medium underline-offset-4 hover:underline"
              >
                Vendor SKU list →
              </Link>
            </div>

            {bundle.lines.length === 0 ? (
              <div className="text-muted-foreground space-y-1 text-sm">
                <p>No line items ingested for this PO.</p>
                {header?.source === "eautomate" &&
                (header.sku_count ?? 0) > 0 ? (
                  <p className="text-xs leading-relaxed">
                    Header reports {header.sku_count} SKU
                    {header.sku_count === 1 ? "" : "s"} — run{" "}
                    <code className="text-[11px]">
                      npm run sync:po:details -- --vendor {vendorId} --po{" "}
                      {poId}
                    </code>{" "}
                    or{" "}
                    <code className="text-[11px]">
                      npm run sync:po:details:if-needed -- --po {poId}
                    </code>
                    .
                  </p>
                ) : null}
              </div>
            ) : (
              <Card className="overflow-hidden p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-muted-foreground text-[11px] uppercase tracking-wide">
                        <th className="px-3 py-2.5 text-left font-medium">
                          SKU
                        </th>
                        <th className="px-3 py-2.5 text-right font-medium">
                          Required
                        </th>
                        <th className="px-3 py-2.5 text-right font-medium">
                          Received
                        </th>
                        <th className="px-3 py-2.5 text-right font-medium">
                          Accepted
                        </th>
                        <th className="px-3 py-2.5 text-right font-medium">
                          Rejected
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {bundle.lines.map((line) => {
                        const sku =
                          line.sku_id ??
                          (pick(line.raw, ["sku_id", "skuId"]) !== "—"
                            ? pick(line.raw, ["sku_id", "skuId"])
                            : "—");
                        const lineListing = asRecord(
                          (line.raw as JsonRecord | undefined)?.listing
                        );
                        const L =
                          (sku !== "—" ? listingBySku.get(sku) ?? null : null) ??
                          lineListing ??
                          (line.raw as JsonRecord | undefined) ??
                          null;
                        const img = listingImageUrl(L);
                        const title =
                          sku !== "—"
                            ? nameBySku.get(sku) ??
                              pick(L ?? {}, ["description", "title"])
                            : "—";
                        return (
                          <tr
                            key={line.line_index}
                            className="hover:bg-muted/30 transition-colors"
                          >
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-3">
                                <div className="bg-muted relative size-10 shrink-0 overflow-hidden rounded-md">
                                  {img ? (
                                    <img
                                      src={img}
                                      alt=""
                                      className="size-full object-cover"
                                    />
                                  ) : (
                                    <div className="text-muted-foreground flex size-full items-center justify-center">
                                      <Package className="size-5 opacity-40" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  {sku !== "—" ? (
                                    <Link
                                      href={`/listings/${encodeURIComponent(sku)}`}
                                      className="text-primary font-mono text-xs font-medium truncate underline-offset-2 hover:underline"
                                    >
                                      {sku}
                                    </Link>
                                  ) : (
                                    <p className="font-mono text-xs font-medium truncate">
                                      {sku}
                                    </p>
                                  )}
                                  {title !== "—" ? (
                                    <p className="text-muted-foreground line-clamp-1 text-xs">
                                      {title}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              {numStr(line.raw, [
                                "quantity",
                                "ordered_quantity",
                                "orderedQuantity",
                                "po_quantity",
                              ])}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              {numStr(line.raw, [
                                "received_quantity",
                                "receivedQuantity",
                                "invoice_quantity",
                                "invoiceQuantity",
                              ])}
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                              {numStr(line.raw, [
                                "accepted_quantity",
                                "acceptedQuantity",
                              ])}
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium tabular-nums text-red-600 dark:text-red-400">
                              {numStr(line.raw, [
                                "rejected_quantity",
                                "rejectedQuantity",
                              ])}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>

          <Dialog
            open={newGrnOpen}
            onOpenChange={(open) => {
              setNewGrnOpen(open);
              if (!open) resetNewGrnModal();
            }}
          >
            <DialogContent className="flex max-h-[85dvh] flex-col gap-0 p-0 sm:max-w-lg">
              <DialogHeader className="shrink-0 border-b px-6 py-4">
                <DialogTitle>Open New GRN</DialogTitle>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Creates a draft GRN on this PO. Line items are seeded from the
                  PO when you open the GRN — enter the vendor invoice and box
                  counts for this receipt.
                </p>
              </DialogHeader>
              <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
              {header ? (
                <div className="bg-muted/50 rounded-md border px-3 py-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2 border-b pb-2">
                    <span className="font-medium">
                      {formatPoLabel(poId, header.source)}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      Will be GRN #{header.number_of_grns + 1}
                    </Badge>
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 pt-2">
                    <dt className="text-muted-foreground">Vendor</dt>
                    <dd>{deriveDisplayName(header.vendor_name)}</dd>
                    <dt className="text-muted-foreground">Ordered</dt>
                    <dd>
                      {numberStringOrDash(header.sku_count)} SKUs ·{" "}
                      {numberStringOrDash(header.total_quantity)} qty
                    </dd>
                    <dt className="text-muted-foreground">Existing GRNs</dt>
                    <dd>{numberStringOrDash(header.number_of_grns)}</dd>
                    <dt className="text-muted-foreground">Source</dt>
                    <dd className="capitalize">{header.source}</dd>
                  </dl>
                </div>
              ) : null}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  What will be seeded
                </p>
                {newGrnLinePreview.total === 0 ? (
                  <p className="text-amber-700 dark:text-amber-400 text-xs leading-relaxed">
                    No PO lines are loaded. The draft GRN may open without line
                    items until PO detail data is available (sync or open this PO
                    once if lines were recently added).
                  </p>
                ) : (
                  <>
                    <p className="text-muted-foreground text-xs">
                      {newGrnLinePreview.total} line
                      {newGrnLinePreview.total === 1 ? "" : "s"} will be copied
                      to the new GRN:
                    </p>
                    <ul className="max-h-44 divide-y overflow-y-auto rounded-md border text-xs">
                      {newGrnLinePreview.rows.map((row) => (
                        <li
                          key={row.line_index}
                          className="bg-background flex justify-between gap-2 px-2.5 py-1.5 font-mono"
                        >
                          <span className="truncate">{row.sku_id}</span>
                          <span className="text-muted-foreground shrink-0">
                            qty{" "}
                            {row.ordered_qty != null
                              ? String(row.ordered_qty)
                              : "—"}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {newGrnLinePreview.remaining > 0 ? (
                      <p className="text-muted-foreground text-[11px]">
                        +{newGrnLinePreview.remaining} more line
                        {newGrnLinePreview.remaining === 1 ? "" : "s"}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="new-grn-vendor-invoice"
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Vendor Invoice Number
                  </Label>
                  <Input
                    id="new-grn-vendor-invoice"
                    placeholder="Enter vendor invoice number"
                    value={newGrnInvoice}
                    onChange={(e) => setNewGrnInvoice(e.target.value)}
                    disabled={newGrnBusy}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="new-grn-box-invoice"
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Box Count in Invoice
                  </Label>
                  <Input
                    id="new-grn-box-invoice"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    placeholder="Enter box count"
                    value={newGrnBoxInvoice}
                    onChange={(e) => onNewGrnInvoiceBoxChange(e.target.value)}
                    disabled={newGrnBusy}
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="new-grn-actual-box"
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Actual Box Count Received
                  </Label>
                  <Input
                    id="new-grn-actual-box"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    placeholder="Enter actual box count"
                    value={newGrnActualBox}
                    onChange={(e) => onNewGrnActualBoxChange(e.target.value)}
                    disabled={newGrnBusy}
                  />
                  {!newGrnActualBoxManual && newGrnBoxInvoice.trim() !== "" ? (
                    <p className="text-muted-foreground text-[11px]">
                      Matches invoice box count until you change this field.
                    </p>
                  ) : null}
                </div>
              </div>
              </div>
              <DialogFooter className="shrink-0 flex-col items-stretch gap-2 border-t px-6 py-4 sm:flex-col sm:items-stretch sm:gap-2">
                {!newGrnCanSubmit && !newGrnBusy ? (
                  <p className="text-muted-foreground text-[11px] sm:text-right">
                    Enter {newGrnMissingFields.join(", ")} to enable Submit.
                  </p>
                ) : null}
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={newGrnBusy}
                    onClick={() => setNewGrnOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={newGrnBusy || !newGrnCanSubmit}
                    title={
                      !newGrnCanSubmit
                        ? `Enter ${newGrnMissingFields.join(", ")} first`
                        : undefined
                    }
                    onClick={() => void submitNewGrn()}
                  >
                    {newGrnBusy ? "Submitting…" : "Submit"}
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={modifyOpen} onOpenChange={setModifyOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>PO internal notes</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 py-2">
                <p className="text-muted-foreground text-xs">
                  Notes are stored on this PO record only; they do not change vendor master data.
                </p>
                <textarea
                  value={modifyNotes}
                  onChange={(e) => setModifyNotes(e.target.value)}
                  placeholder="Notes"
                  className={cn(
                    "border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring",
                    "flex min-h-[120px] w-full rounded-md border px-3 py-2 text-sm shadow-sm",
                    "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setModifyOpen(false)}>
                  Close
                </Button>
                <Button type="button" disabled={actionBusy} onClick={() => void saveModify()}>
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel this purchase order?</AlertDialogTitle>
                <AlertDialogDescription>
                  This records the PO as cancelled in the app. It does not cancel the order in an external system.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={actionBusy}>Back</AlertDialogCancel>
                <AlertDialogAction
                  disabled={actionBusy}
                  onClick={(e) => {
                    e.preventDefault();
                    void confirmCancel();
                  }}
                >
                  Confirm cancel
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </div>
    </TooltipProvider>
  );
}
