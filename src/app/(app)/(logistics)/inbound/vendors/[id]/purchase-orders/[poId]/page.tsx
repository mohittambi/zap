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
} from "lucide-react";
import { apiFetch, apiUrl, getStoredToken } from "@/lib/api-browser";
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
import { AppPageTitle } from "@/components/layout/app-page-shell";
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

type PoDetailBundle = {
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
  const [newGrnBusy, setNewGrnBusy] = React.useState(false);

  const newGrnCanSubmit =
    newGrnInvoice.trim() !== "" &&
    parseNonNegativeInt(newGrnBoxInvoice) !== null &&
    parseNonNegativeInt(newGrnActualBox) !== null;

  const reloadBundle = React.useCallback(async () => {
    if (!vendorId || !poId) return;
    setLoading(true);
    try {
      const data = await apiFetch<PoDetailBundle>(
        `/api/inbound/vendors/${encodeURIComponent(vendorId)}/purchase-orders/${encodeURIComponent(poId)}/details?refresh=1`
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
          `/api/inbound/vendors/${encodeURIComponent(vendorId)}/purchase-orders/${encodeURIComponent(poId)}/details?refresh=1`
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

  const downloadPdf = async () => {
    setActionBusy(true);
    try {
      const token = getStoredToken();
      const headers = new Headers();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const res = await fetch(
        apiUrl(
          `/api/inbound/vendors/${encodeURIComponent(vendorId)}/purchase-orders/${encodeURIComponent(poId)}/document`
        ),
        { headers }
      );
      if (!res.ok) throw new Error((await res.text()).slice(0, 200));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `po-${poId}-document.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF download started");
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
      await reloadBundle();
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
    setNewGrnInvoice("");
    setNewGrnBoxInvoice("");
    setNewGrnActualBox("");
    setNewGrnOpen(true);
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
  const poRaw = snap?.po_raw ?? {};
  const vendorRaw = snap?.vendor_raw ?? {};
  const nameBySku = React.useMemo(
    () => buildSkuNameMap(snap?.sku_names_raw),
    [snap?.sku_names_raw]
  );
  const listingBySku = React.useMemo(
    () => buildListingBySku(snap?.vendor_listings_raw),
    [snap?.vendor_listings_raw]
  );

  const isZapCancelled =
    String(poRaw.zap_status ?? "").trim().toUpperCase() === "CANCELLED";
  const poStatus = isZapCancelled
    ? "Cancelled"
    : pick(poRaw, ["status", "po_status", "Status"]);
  const totalSkus = pick(poRaw, ["sku_count", "skuCount"]);
  const totalReq = pick(poRaw, ["total_quantity", "totalQuantity"]);
  const totalInv = pick(poRaw, [
    "total_invoice_quantity",
    "totalInvoiceQuantity",
  ]);
  const totalAcc = pick(poRaw, [
    "total_accepted_quantity",
    "totalAcceptedQuantity",
  ]);
  const totalRej = pick(poRaw, [
    "total_rejected_quantity",
    "totalRejectedQuantity",
  ]);
  const skuFill = pick(poRaw, ["sku_fill_rate", "skuFillRate"]);
  const qtyFill = pick(poRaw, ["quantity_fill_rate", "quantityFillRate"]);

  const invN = Number(totalInv) || 0;
  const accN = Number(totalAcc) || 0;
  const rejN = Number(totalRej) || 0;
  const acceptPct =
    invN > 0 ? Math.round((accN / invN) * 1000) / 10 : null;
  const rejectPct =
    invN > 0 ? Math.round((rejN / invN) * 1000) / 10 : null;

  const vendorName = pick(vendorRaw, [
    "vendor_name",
    "vendorName",
    "name",
  ]);
  const vendorCity = pick(vendorRaw, ["vendor_city", "vendorCity", "city"]);
  const vendorState = pick(vendorRaw, ["vendor_state", "vendorState", "state"]);
  const location =
    vendorCity !== "—" || vendorState !== "—"
      ? [vendorCity, vendorState].filter((x) => x !== "—").join(", ")
      : "—";

  const expiryRaw =
    poRaw.expected_date ?? poRaw.expectedDate ?? poRaw.expiry_date;
  const expiryStr =
    expiryRaw != null && expiryRaw !== "" ? String(expiryRaw) : null;

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 px-2 py-4 md:px-4">
      <div className="flex flex-wrap items-center gap-3">
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

      <AppPageTitle
        title={loading ? "Purchase order" : `PO ${poId}`}
        description="Line items, GRNs, and summary for this purchase order."
      />

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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              {poStatus !== "—" ? (
                <Badge
                  variant="outline"
                  className={cn("text-xs", statusPublishedClass(poStatus))}
                >
                  {poStatus}
                </Badge>
              ) : null}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span>
                  <span className="text-muted-foreground">PO ID:</span>{" "}
                  <span className="font-mono font-medium">{poId}</span>
                </span>
                <span>
                  <span className="text-muted-foreground">Vendor ID:</span>{" "}
                  <Link
                    href={`/inbound/vendors/${encodeURIComponent(vendorId)}`}
                    className="text-primary font-mono font-medium underline-offset-4 hover:underline"
                  >
                    {vendorId}
                  </Link>
                </span>
              </div>
              <p className="text-muted-foreground text-sm">
                <span className="text-foreground font-medium">
                  Vendor name:
                </span>{" "}
                {vendorName}
                {location !== "—" ? (
                  <>
                    {" "}
                    <span className="text-muted-foreground">| Location:</span>{" "}
                    {location}
                  </>
                ) : null}
              </p>
              <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span>PO expiry: {formatDt(expiryStr)}</span>
                <span>
                  PO created by:{" "}
                  {pick(poRaw, ["created_by", "createdBy"])}
                </span>
                <span>
                  Creation time:{" "}
                  {formatDt(
                    String(poRaw.created_at ?? poRaw.createdAt ?? "") || null
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="gap-2"
              disabled={actionBusy}
              onClick={() => void downloadPdf()}
            >
              <FileText className="size-4" />
              Generate PO document
            </Button>
            <Button
              type="button"
              variant="default"
              className="gap-2"
              disabled={actionBusy}
              onClick={openModify}
            >
              <Pencil className="size-4" />
              Modify PO
            </Button>
            <Button
              type="button"
              variant="default"
              className="gap-2"
              disabled={actionBusy || isZapCancelled}
              onClick={() => setCancelOpen(true)}
            >
              <XCircle className="size-4" />
              Cancel PO
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            {[
              { label: "Total SKUs", value: totalSkus },
              { label: "Total required qty", value: totalReq },
              { label: "Total received qty", value: totalInv },
              { label: "Total rejected qty", value: totalRej },
            ].map((m) => (
              <Card key={m.label} className="border-primary/10">
                <CardHeader className="pb-1 pt-3">
                  <CardDescription className="text-xs uppercase">
                    {m.label}
                  </CardDescription>
                  <CardTitle className="text-lg font-semibold">
                    {m.value}
                  </CardTitle>
                </CardHeader>
              </Card>
            ))}
            {[
              { label: "SKU fill rate", value: skuFill },
              { label: "Quantity fill rate", value: qtyFill },
            ].map((m) => (
              <Card key={m.label} className="border-primary/10">
                <CardHeader className="pb-1 pt-3">
                  <CardDescription className="text-xs uppercase">
                    {m.label}
                  </CardDescription>
                  <CardTitle className="pt-1">
                    <FillRateBar value={m.value === "—" ? null : Number(m.value)} />
                  </CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>

          {(acceptPct != null || rejectPct != null) && (
            <div className="grid gap-3 sm:grid-cols-2 lg:max-w-md">
              <Card className="border-primary/10">
                <CardHeader className="pb-1 pt-3">
                  <CardDescription className="text-xs uppercase">
                    Acceptance rate
                  </CardDescription>
                  <CardTitle className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                    {acceptPct != null ? `${acceptPct}%` : "—"}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-primary/10">
                <CardHeader className="pb-1 pt-3">
                  <CardDescription className="text-xs uppercase">
                    Rejection rate
                  </CardDescription>
                  <CardTitle className="text-lg font-semibold text-red-600 dark:text-red-400">
                    {rejectPct != null ? `${rejectPct}%` : "—"}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>
          )}

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1 space-y-4">
              <h2 className="text-foreground text-sm font-semibold">
                SKU lines
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {bundle.lines.map((line) => {
                  const sku =
                    line.sku_id ??
                    (pick(line.raw, ["sku_id", "skuId"]) !== "—"
                      ? pick(line.raw, ["sku_id", "skuId"])
                      : "—");
                  const L =
                    sku !== "—" ? listingBySku.get(sku) ?? null : null;
                  const img = listingImageUrl(L);
                  const title =
                    sku !== "—"
                      ? nameBySku.get(sku) ??
                        pick(L ?? {}, ["description", "title"])
                      : "—";
                  return (
                    <Card
                      key={line.line_index}
                      className="border-primary/10 overflow-hidden"
                    >
                      <div className="flex gap-3 p-3">
                        <div className="bg-muted relative size-20 shrink-0 overflow-hidden rounded-md">
                          {img ? (
                            <img
                              src={img}
                              alt=""
                              className="size-full object-cover"
                            />
                          ) : (
                            <div className="text-muted-foreground flex size-full items-center justify-center">
                              <Package className="size-8 opacity-40" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1 space-y-1 text-sm">
                          <p className="font-mono text-xs font-medium">
                            SKU: {sku}
                          </p>
                          {title !== "—" ? (
                            <p className="text-muted-foreground line-clamp-2 text-xs">
                              {title}
                            </p>
                          ) : null}
                          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs">
                            <span className="text-muted-foreground">
                              Required
                            </span>
                            <span>
                              {numStr(line.raw, [
                                "quantity",
                                "ordered_quantity",
                                "orderedQuantity",
                                "po_quantity",
                              ])}
                            </span>
                            <span className="text-muted-foreground">
                              Received
                            </span>
                            <span>
                              {numStr(line.raw, [
                                "received_quantity",
                                "receivedQuantity",
                                "invoice_quantity",
                                "invoiceQuantity",
                              ])}
                            </span>
                            <span className="text-muted-foreground">
                              Accepted
                            </span>
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">
                              {numStr(line.raw, [
                                "accepted_quantity",
                                "acceptedQuantity",
                              ])}
                            </span>
                            <span className="text-muted-foreground">
                              Rejected
                            </span>
                            <span className="font-medium text-red-600 dark:text-red-400">
                              {numStr(line.raw, [
                                "rejected_quantity",
                                "rejectedQuantity",
                              ])}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
              {bundle.lines.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No line items ingested for this PO.
                </p>
              ) : null}
            </div>

            <div className="w-full shrink-0 space-y-4 lg:w-80 xl:w-96">
              <div className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm font-semibold">
                GRN section
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="gap-1"
                  disabled={actionBusy || newGrnBusy}
                  onClick={openNewGrn}
                >
                  <Plus className="size-3.5" />
                  Open new GRN
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="gap-1"
                  disabled={actionBusy}
                  onClick={() => void downloadGrnReport()}
                >
                  <Download className="size-3.5" />
                  Download GRN report
                </Button>
              </div>
              <div className="space-y-3">
                {bundle.grns.map((g) => {
                  const r = g.raw;
                  const gid = grnIdFromRow(g);
                  const href =
                    gid != null ? `/inbound/grns/${gid}` : null;
                  return (
                    <Card key={g.sort_index} className="border-primary/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">
                          {href ? (
                            <Link
                              href={href}
                              className="text-primary underline-offset-4 hover:underline"
                            >
                              GRN #{gid}
                            </Link>
                          ) : (
                            <span>GRN</span>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1 text-xs">
                        <p>
                          <span className="text-muted-foreground">Accepted</span>{" "}
                          {pick(r, ["grn_accepted_quantity", "accepted_quantity"])}
                          {" · "}
                          <span className="text-muted-foreground">Rejected</span>{" "}
                          {pick(r, ["grn_rejected_quantity", "rejected_quantity"])}
                          {" · "}
                          <span className="text-muted-foreground">Shortage</span>{" "}
                          {pick(r, ["grn_shortage_quantity", "shortage_quantity"])}
                        </p>
                        <p className={statusClosedClass(pick(r, ["grn_status", "status"]))}>
                          GRN status: {pick(r, ["grn_status", "status"])}
                        </p>
                        <p className={statusClosedClass(pick(r, ["grn_audit_status", "audit_status"]))}>
                          Audit: {pick(r, ["grn_audit_status", "audit_status"])}
                        </p>
                        <p>SKU count: {pick(r, ["grn_sku_count", "sku_count"])}</p>
                        <p>Box count: {pick(r, ["box_count_invoice", "box_count"])}</p>
                        <p>
                          Actual boxes:{" "}
                          {pick(r, [
                            "actual_box_count_received",
                            "actual_box_count_recieved",
                          ])}
                        </p>
                        <p>Invoice: {pick(r, ["vendor_invoice_number", "invoice"])}</p>
                        <p>Created by: {pick(r, ["created_by", "createdBy"])}</p>
                        <p>
                          Created at:{" "}
                          {formatDt(
                            String(r.created_at ?? r.createdAt ?? "") || null
                          )}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              {bundle.grns.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No GRNs linked to this PO.
                </p>
              ) : null}
            </div>
          </div>

          <Dialog
            open={newGrnOpen}
            onOpenChange={(open) => {
              setNewGrnOpen(open);
              if (!open) {
                setNewGrnInvoice("");
                setNewGrnBoxInvoice("");
                setNewGrnActualBox("");
              }
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Open New GRN</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-2">
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
                    onChange={(e) => setNewGrnBoxInvoice(e.target.value)}
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
                    onChange={(e) => setNewGrnActualBox(e.target.value)}
                    disabled={newGrnBusy}
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
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
                  onClick={() => void submitNewGrn()}
                >
                  {newGrnBusy ? "Submitting…" : "Submit"}
                </Button>
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
  );
}
