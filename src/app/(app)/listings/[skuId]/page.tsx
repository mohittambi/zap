"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api-browser";
import { formatLogDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  ListingDetail,
  ListingOrderDetailRow,
  OutboundSummaryResponse,
  PaginatedLogs,
  PaginatedPurchaseOrders,
  SkuAnalytics,
} from "@/types/listing";
import { AvailableQuantityCard, ListingInfoCard } from "./listing-detail-cards";

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatInr(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return INR.format(n);
}

function formatPct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(2)}%`;
}

function collectGalleryUrls(l: ListingDetail): { url: string; label: string }[] {
  const pairs: { key: keyof ListingDetail; label: string }[] = [
    { key: "img_hd", label: "HD" },
    { key: "img_white", label: "White BG" },
    { key: "img_wdim", label: "With Dimensions" },
    { key: "img_link1", label: "Alt 1" },
    { key: "img_link2", label: "Alt 2" },
  ];
  const out: { url: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const { key, label } of pairs) {
    const v = l[key] as string | null | undefined;
    if (typeof v === "string" && v.trim() && !seen.has(v.trim())) {
      seen.add(v.trim());
      out.push({ url: v.trim(), label });
    }
  }
  return out;
}

type VendorBySkuApi = {
  id: number;
  vendor_id: number;
  sku_id: string;
  cost_price: number;
  vendor: { vendor_name?: string | null };
};

export default function ListingDetailPage() {
  const params = useParams();
  const skuId = decodeURIComponent(String(params.skuId ?? ""));

  const [listing, setListing] = React.useState<ListingDetail | null>(null);
  const [analytics, setAnalytics] = React.useState<SkuAnalytics | null>(null);
  const [logs, setLogs] = React.useState<PaginatedLogs | null>(null);
  const [logsUnavailable, setLogsUnavailable] = React.useState(false);
  const [logPage, setLogPage] = React.useState(1);
  const [outboundSummary, setOutboundSummary] =
    React.useState<OutboundSummaryResponse | null>(null);
  const [poData, setPoData] = React.useState<PaginatedPurchaseOrders | null>(null);
  const [poPage, setPoPage] = React.useState(1);
  const [vendors, setVendors] = React.useState<VendorBySkuApi[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [thumbIndex, setThumbIndex] = React.useState(0);
  const [imageEditing, setImageEditing] = React.useState(false);
  const [imageDraft, setImageDraft] = React.useState({ img_hd: "", img_white: "", img_wdim: "", img_link1: "", img_link2: "" });
  const [imageSaving, setImageSaving] = React.useState(false);

  const loadCore = React.useCallback(async () => {
    if (!skuId) return;
    setLoading(true);
    try {
      const [l, a] = await Promise.all([
        apiFetch<ListingDetail>(
          `/api/listings/sku/${encodeURIComponent(skuId)}`
        ),
        apiFetch<SkuAnalytics>(
          `/api/listings/analytics/sku/${encodeURIComponent(skuId)}`
        ),
      ]);
      setListing(l);
      setAnalytics(a);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load SKU");
      setListing(null);
    } finally {
      setLoading(false);
    }
  }, [skuId]);

  React.useEffect(() => {
    void loadCore();
  }, [loadCore]);

  React.useEffect(() => {
    if (!skuId) return;
    setLogsUnavailable(false);
    let cancelled = false;
    void (async () => {
      try {
        const settled = await Promise.allSettled([
          apiFetch<PaginatedLogs>(
            `/api/warehouse_inventory_dump/sku_id/by_page/${encodeURIComponent(skuId)}?page=${logPage}&count=200`
          ),
          apiFetch<OutboundSummaryResponse>(
            `/api/listings/sku/${encodeURIComponent(skuId)}/outbound-summary`
          ),
          apiFetch<PaginatedPurchaseOrders>(
            `/api/incoming_purchase_orders/listing_order_details/${encodeURIComponent(skuId)}?page=${poPage}&count=200`
          ),
          apiFetch<VendorBySkuApi[]>(
            `/api/vendors/sku/${encodeURIComponent(skuId)}`
          ),
        ]);
        if (cancelled) return;
        const [lg, ob, po, vn] = settled;
        if (lg.status === "fulfilled") {
          setLogs(lg.value);
          setLogsUnavailable(false);
        } else {
          setLogs(null);
          setLogsUnavailable(true);
        }
        if (ob.status === "fulfilled") setOutboundSummary(ob.value);
        else setOutboundSummary(null);
        if (po.status === "fulfilled") setPoData(po.value);
        else setPoData(null);
        if (vn.status === "fulfilled") setVendors(vn.value);
        else setVendors([]);
      } catch {
        /* handled per settled */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [skuId, logPage, poPage]);

  const handleListingUpdated = React.useCallback((updated: ListingDetail) => {
    setListing(updated);
  }, []);

  function startImageEdit() {
    if (!listing) return;
    setImageDraft({
      img_hd: listing.img_hd ?? "",
      img_white: listing.img_white ?? "",
      img_wdim: listing.img_wdim ?? "",
      img_link1: listing.img_link1 ?? "",
      img_link2: listing.img_link2 ?? "",
    });
    setImageEditing(true);
  }

  async function saveImageEdit() {
    if (!listing) return;
    setImageSaving(true);
    try {
      const body: Record<string, string | null> = {
        img_hd: imageDraft.img_hd.trim() || null,
        img_white: imageDraft.img_white.trim() || null,
        img_wdim: imageDraft.img_wdim.trim() || null,
        img_link1: imageDraft.img_link1.trim() || null,
        img_link2: imageDraft.img_link2.trim() || null,
      };
      const updated = await apiFetch<ListingDetail>(
        `/api/listings/sku/${encodeURIComponent(skuId)}`,
        { method: "PATCH", body: JSON.stringify(body) }
      );
      setListing(updated);
      setImageEditing(false);
      toast.success("Images saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save images");
    } finally {
      setImageSaving(false);
    }
  }

  React.useEffect(() => {
    setThumbIndex(0);
  }, [skuId, listing?.img_hd]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-muted-foreground text-sm">SKU not found.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/listings/warehouse">Back to warehouse listings</Link>
        </Button>
      </div>
    );
  }

  const gallery = collectGalleryUrls(listing);
  const mainImage = gallery[thumbIndex]?.url ?? gallery[0]?.url;
  const mainLabel = gallery[thumbIndex]?.label ?? "img_hd";

  const avgVendorCost =
    vendors.length > 0
      ? vendors.reduce((s, v) => s + (v.cost_price ?? 0), 0) / vendors.length
      : null;

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-3 py-4 md:px-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/listings/warehouse">← Warehouse listings</Link>
      </Button>

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="bg-primary text-primary-foreground flex h-auto w-full flex-wrap justify-start gap-0 rounded-none border-0 p-0">
          {(
            [
              ["details", "Listing Details"],
              ["logs", "Inventory Logs"],
              ["outbound", "Outbound Details"],
              ["inbound", "Inbound Details"],
            ] as const
          ).map(([value, label]) => (
            <TabsTrigger
              key={value}
              value={value}
              className={cn(
                "shrink-0 rounded-none border-b-2 border-transparent px-3 py-3 text-sm font-medium data-[state=active]:border-white data-[state=active]:bg-white data-[state=active]:text-primary md:px-4",
                "text-primary-foreground/90 hover:bg-white/10 data-[state=active]:hover:bg-white"
              )}
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="details" className="mt-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            {/* Gallery */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex shrink-0 flex-row gap-2 sm:flex-col sm:overflow-y-auto">
                {gallery.map((g, i) => (
                  <button
                    key={`${g.url}-${i}`}
                    type="button"
                    title={g.label}
                    onClick={() => setThumbIndex(i)}
                    className={cn(
                      "group relative shrink-0 overflow-hidden rounded border-2 bg-muted",
                      "size-16 sm:size-20",
                      thumbIndex === i
                        ? "border-primary"
                        : "border-transparent opacity-80 hover:opacity-100"
                    )}
                  >
                    <Image
                      src={g.url}
                      alt={g.label}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                    <span className="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-1 py-0.5 text-center text-[9px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {g.label}
                    </span>
                  </button>
                ))}
                {gallery.length === 0 && (
                  <div className="text-muted-foreground flex size-20 items-center justify-center rounded border text-xs">
                    No image
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div className="relative aspect-square w-full max-w-xl overflow-hidden rounded-lg border bg-muted">
                  {mainImage ? (
                    <Image
                      src={mainImage}
                      alt=""
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  ) : (
                    <div className="text-muted-foreground flex size-full items-center justify-center">
                      No image
                    </div>
                  )}
                </div>
                {imageEditing ? (
                  <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs font-medium">Edit image URLs</p>
                    {(["img_hd", "img_white", "img_wdim", "img_link1", "img_link2"] as const).map((key) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{key}</Label>
                        <Input
                          value={imageDraft[key]}
                          onChange={(e) => setImageDraft((d) => ({ ...d, [key]: e.target.value }))}
                          placeholder={`https://…`}
                          className="h-8 font-mono text-xs"
                        />
                      </div>
                    ))}
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" disabled={imageSaving} onClick={() => void saveImageEdit()}>
                        <Check className="mr-1 h-3 w-3" />
                        {imageSaving ? "Saving…" : "Save"}
                      </Button>
                      <Button size="sm" variant="outline" disabled={imageSaving} onClick={() => setImageEditing(false)}>
                        <X className="mr-1 h-3 w-3" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-sm">
                    <span className="text-primary font-medium">{mainLabel}</span>
                    <button
                      type="button"
                      title="Edit image URLs"
                      onClick={startImageEdit}
                      className="mt-0.5 shrink-0 text-primary opacity-60 hover:opacity-100"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <span className="text-muted-foreground break-all font-mono text-xs">
                      {mainImage ?? "—"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Right column cards */}
            <div className="space-y-4">
              <ListingInfoCard
                listing={listing}
                skuId={skuId}
                onSaved={handleListingUpdated}
              />

              {/* ── Outward Data Card ─────────────────────────────────── */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-primary text-base">OUTWARD DATA</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <div className="text-muted-foreground mb-2 grid grid-cols-3 gap-2 text-center text-xs font-medium">
                      <div>Last 30 Days Inward</div>
                      <div>Last 60 Days Inward</div>
                      <div>Last 90 Days Inward</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-sm tabular-nums">
                      <div>{analytics?.inward_30d ?? 0}</div>
                      <div>{analytics?.inward_60d ?? 0}</div>
                      <div>{analytics?.inward_90d ?? 0}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-2 grid grid-cols-3 gap-2 text-center text-xs font-medium">
                      <div>Last 30 Days Outward</div>
                      <div>Last 60 Days Outward</div>
                      <div>Last 90 Days Outward</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-sm tabular-nums">
                      <div>{analytics?.outward_30d ?? 0}</div>
                      <div>{analytics?.outward_60d ?? 0}</div>
                      <div>{analytics?.outward_90d ?? 0}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <AvailableQuantityCard listing={listing} skuId={skuId} onSaved={handleListingUpdated} />
            </div>
          </div>
        </TabsContent>

        {/* ── Inventory Logs Tab ─────────────────────────────────────── */}
        <TabsContent value="logs" className="mt-6 space-y-4">
          <p className="text-muted-foreground text-sm">
            {logsUnavailable
              ? "Inventory logs unavailable (check warehouse_inventory permission)."
              : logs
                ? `Showing ${logs.curr_page_count} of ${logs.total} Log(s).`
                : "Loading logs…"}
          </p>
          {!logs && !logsUnavailable ? (
            <Skeleton className="h-64 w-full" />
          ) : logs ? (
            <>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Operation</TableHead>
                      <TableHead className="text-center">Quantity</TableHead>
                      <TableHead className="text-center">SKU ID</TableHead>
                      <TableHead className="text-center">Bin ID</TableHead>
                      <TableHead>Performed By</TableHead>
                      <TableHead>Created At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.content.map((row, idx) => {
                      const isAdd =
                        String(row.inventory_operation_type).toUpperCase() === "ADD";
                      return (
                        <TableRow
                          key={`${row.created_at}-${idx}`}
                          className="odd:bg-muted/20"
                        >
                          <TableCell>
                            <span
                              className={cn(
                                "inline-block rounded px-2 py-0.5 text-xs font-semibold",
                                isAdd
                                  ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
                                  : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
                              )}
                            >
                              {row.inventory_operation_type}
                            </span>
                          </TableCell>
                          <TableCell className="text-center tabular-nums">
                            {row.quantity}
                          </TableCell>
                          <TableCell className="text-center font-mono text-sm">
                            {row.sku_id}
                          </TableCell>
                          <TableCell className="text-center font-mono text-sm">
                            {row.bin_id}
                          </TableCell>
                          <TableCell className="text-sm">{row.user_id}</TableCell>
                          <TableCell className="text-sm">
                            {formatLogDate(row.created_at)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-between gap-2">
                <Button
                  variant="outline"
                  disabled={logPage <= 1}
                  onClick={() => setLogPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={!logs || logs.content.length < (logs.per_page_count || 200)}
                  onClick={() => setLogPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          ) : null}
        </TabsContent>

        {/* ── Outbound Details Tab ───────────────────────────────────── */}
        <TabsContent value="outbound" className="mt-6 space-y-6">
          <div>
            <h2 className="text-primary text-lg font-semibold">Recieved Order Summary</h2>
            <p className="text-muted-foreground mt-1 text-xs">
              *Provided summary is calculated based on loaded data. Loading more data will change
              this summary.
            </p>
          </div>
          {outboundSummary ? (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Company</TableHead>
                    <TableHead className="text-right">Total Demand</TableHead>
                    <TableHead className="text-right">Fulfilled</TableHead>
                    <TableHead className="text-right">Unfulfilled</TableHead>
                    <TableHead className="text-right">Revenue Gain</TableHead>
                    <TableHead className="text-right">Revenue Loss</TableHead>
                    <TableHead className="text-right">Avg. Price (incl. Tax)</TableHead>
                    <TableHead className="text-right">Loss %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">
                      {outboundSummary.overall.company}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {outboundSummary.overall.total_demand}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {outboundSummary.overall.total_fulfilled}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {outboundSummary.overall.total_unfulfilled}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatInr(outboundSummary.overall.revenue_gain)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatInr(outboundSummary.overall.revenue_loss)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatInr(outboundSummary.overall.avg_price_incl_tax ?? undefined)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPct(outboundSummary.overall.loss_pct ?? undefined)}
                    </TableCell>
                  </TableRow>
                  {outboundSummary.by_company.map((row) => (
                    <TableRow key={row.company}>
                      <TableCell>{row.company}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.total_demand}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.total_fulfilled}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.total_unfulfilled}
                      </TableCell>
                      <TableCell className="text-right">{formatInr(row.revenue_gain)}</TableCell>
                      <TableCell className="text-right">{formatInr(row.revenue_loss)}</TableCell>
                      <TableCell className="text-right">
                        {formatInr(row.avg_price_incl_tax ?? undefined)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPct(row.loss_pct ?? undefined)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Summary unavailable (check purchase_orders permission).
            </p>
          )}

          <p className="text-muted-foreground text-sm">
            {poData
              ? `Showing ${poData.curr_page_count} of ${poData.total} Purchase Order(s).`
              : "Loading purchase orders…"}
          </p>
          {!poData ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>PO #</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead className="text-right">Demand</TableHead>
                      <TableHead className="text-right">Dispatched</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>PO date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {poData.content.map((row: ListingOrderDetailRow) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-sm">
                          {row.po_number ?? "—"}
                        </TableCell>
                        <TableCell>{row.company_name ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.demand ?? 0}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.dispatched_quantity ?? 0}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.calculated_po_status ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {row.po_issue_date
                            ? formatLogDate(row.po_issue_date)
                            : row.created_at
                              ? formatLogDate(row.created_at)
                              : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-between gap-2">
                <Button
                  variant="outline"
                  disabled={poPage <= 1}
                  onClick={() => setPoPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={!poData || poData.content.length < (poData.per_page_count || 200)}
                  onClick={() => setPoPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Inbound Details Tab ────────────────────────────────────── */}
        <TabsContent value="inbound" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-primary text-base">ASSOCIATED VENDORS</CardTitle>
              <p className="text-sm font-medium">
                [Cumulative Average Associated Cost Price :{" "}
                {avgVendorCost != null && Number.isFinite(avgVendorCost)
                  ? `${avgVendorCost.toFixed(0)} Rs.`
                  : "—"}
                ]
              </p>
              <p className="text-muted-foreground text-xs">
                *Please note that the associated cost price refers to the expected cost price that
                the vendor is expected to bill us.
              </p>
            </CardHeader>
            <CardContent>
              {vendors.length === 0 ? (
                <p className="text-muted-foreground text-sm">No associated vendors.</p>
              ) : (
                <div className="flex flex-wrap gap-4">
                  {vendors.map((v) => (
                    <div
                      key={v.id}
                      className="min-w-[200px] flex-1 rounded-lg border bg-card p-4 shadow-sm"
                    >
                      <p className="font-mono text-sm font-semibold">{v.vendor_id}</p>
                      <p className="mt-1 font-medium">{v.vendor?.vendor_name ?? "—"}</p>
                      <p className="text-muted-foreground mt-2 text-sm">
                        Associated Cost Price : {v.cost_price ?? 0} Rs.
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-primary text-base">VENDOR BILLING SUMMARY</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">No billing details were found.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-primary text-base">PURCHASE ORDERS SUMMARY</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4 text-sm">
                For line-level purchase orders for this SKU, see <strong>Outbound Details</strong>.
                Inbound-specific PO breakdown will appear here when product rules define inbound vs
                outbound order types.
              </p>
              {poData && poData.total === 0 ? (
                <p className="text-muted-foreground text-sm">No purchase orders were found.</p>
              ) : poData && poData.total > 0 ? (
                <p className="text-sm">
                  {poData.total} purchase order line(s) exist for this SKU — view the full table
                  under Outbound Details.
                </p>
              ) : (
                <p className="text-muted-foreground text-sm">Loading…</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
