"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { useAuth } from "@/contexts/auth-context";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";
import { Download, Loader2, Plus, Trash2 } from "lucide-react";

export type VendorListingRow = {
  id: number;
  vendor_id: number;
  sku_id: string;
  cost_price: number;
  listing: {
    sku_id: string;
    category: string | null;
    description: string;
    eautomate_sku_name?: string | null;
    sku_type?: string | null;
    available_quantity: number;
    img_hd?: string;
    img_white?: string;
    img_wdim?: string;
    img_link1?: string;
    img_link2?: string;
    bins: {
      id: number;
      warehouse_id: number;
      sku_id: string;
      bin_id: string;
      available_quantity: number;
    }[];
  } | null;
};

type ListingsSearchRow = {
  sku_id: string;
  description: string | null;
  category: string | null;
  img_hd?: string | null;
  img_white?: string | null;
  img_wdim?: string | null;
  img_link1?: string | null;
  img_link2?: string | null;
  available_quantity?: number;
};

type ListingsPageResponse = {
  total: number;
  content: ListingsSearchRow[];
};

function pickThumb(l: {
  img_hd?: string | null;
  img_white?: string | null;
  img_wdim?: string | null;
  img_link1?: string | null;
  img_link2?: string | null;
} | null): string | null {
  if (!l) return null;
  const urls = [l.img_hd, l.img_white, l.img_wdim, l.img_link1, l.img_link2].filter(
    (u): u is string => Boolean(u && String(u).trim())
  );
  return urls[0] ?? null;
}

function matchesSearch(row: VendorListingRow, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  const sku = (row.sku_id ?? "").toLowerCase();
  const desc = (row.listing?.description ?? "").toLowerCase();
  const cat = (row.listing?.category ?? "").toLowerCase();
  return sku.includes(s) || desc.includes(s) || cat.includes(s);
}

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const str = String(v);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function downloadListingsCsv(rows: VendorListingRow[], vendorId: string) {
  const headers = [
    "sku_id",
    "description",
    "category",
    "cost_price",
    "available_quantity",
    "bin_count",
  ];
  const lines = [headers.join(",")];
  for (const row of rows) {
    const L = row.listing;
    const binCount = L?.bins?.length ?? 0;
    lines.push(
      [
        row.sku_id,
        L?.description ?? "",
        L?.category ?? "",
        row.cost_price,
        L?.available_quantity ?? "",
        binCount,
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `vendor_${vendorId}_listings.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast.success("Downloaded listings CSV");
}

export function InboundVendorListingsTable({
  vendorId,
}: Readonly<{ vendorId: string }>) {
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("vendors", "write");

  const [data, setData] = React.useState<VendorListingRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [selectedSku, setSelectedSku] = React.useState<string | null>(null);

  const [mapOpen, setMapOpen] = React.useState(false);
  const [mapSearch, setMapSearch] = React.useState("");
  const [mapDebounced, setMapDebounced] = React.useState("");
  const [mapLoading, setMapLoading] = React.useState(false);
  const [mapResults, setMapResults] = React.useState<ListingsSearchRow[]>([]);
  const [mapPick, setMapPick] = React.useState<ListingsSearchRow | null>(null);
  const [mapCost, setMapCost] = React.useState("");
  const [mapSubmitting, setMapSubmitting] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<VendorListingRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<VendorListingRow[]>(
        `/api/vendors/listings/${encodeURIComponent(vendorId)}`
      );
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load listings");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    const t = window.setTimeout(() => setMapDebounced(mapSearch), 300);
    return () => window.clearTimeout(t);
  }, [mapSearch]);

  React.useEffect(() => {
    if (!mapOpen) return;
    let cancelled = false;
    (async () => {
      setMapLoading(true);
      try {
        const q = new URLSearchParams({
          search_keyword: mapDebounced.trim(),
          page: "1",
          count: "20",
        });
        const res = await apiFetch<ListingsPageResponse>(
          `/api/listings/by_page_v4?${q}`
        );
        if (!cancelled) setMapResults(res.content ?? []);
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Search failed");
          setMapResults([]);
        }
      } finally {
        if (!cancelled) setMapLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mapDebounced, mapOpen]);

  const filtered = React.useMemo(
    () => data.filter((r) => matchesSearch(r, search)),
    [data, search]
  );

  React.useEffect(() => {
    if (filtered.length === 0) {
      setSelectedSku(null);
      return;
    }
    if (!selectedSku || !filtered.some((r) => r.sku_id === selectedSku)) {
      setSelectedSku(filtered[0].sku_id);
    }
  }, [filtered, selectedSku]);

  const selectedRow = React.useMemo(
    () => filtered.find((r) => r.sku_id === selectedSku) ?? filtered[0] ?? null,
    [filtered, selectedSku]
  );

  async function confirmMap() {
    if (!mapPick) {
      toast.error("Select a listing");
      return;
    }
    setMapSubmitting(true);
    try {
      const body = await apiFetch<{ duplicate?: boolean }>(
        `/api/vendors/${encodeURIComponent(vendorId)}/listings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sku_id: mapPick.sku_id,
            cost_price: mapCost.trim() ? Number(mapCost) : undefined,
          }),
        }
      );
      toast.success(body.duplicate ? "Listing already mapped (updated if cost set)" : "Listing mapped");
      setMapOpen(false);
      setMapSearch("");
      setMapPick(null);
      setMapCost("");
      await load();
      setSelectedSku(mapPick.sku_id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Map failed");
    } finally {
      setMapSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(
        `/api/vendors/${encodeURIComponent(vendorId)}/listings/${encodeURIComponent(deleteTarget.sku_id)}`,
        { method: "DELETE" }
      );
      toast.success("Mapping removed");
      setDeleteTarget(null);
      setSelectedSku(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  function resetMapDialog(open: boolean) {
    setMapOpen(open);
    if (!open) {
      setMapSearch("");
      setMapPick(null);
      setMapCost("");
      setMapResults([]);
    }
  }

  const previewListing = selectedRow?.listing ?? null;

  return (
    <Card className="border-primary/10 shadow-sm">
      <CardHeader className="space-y-4 pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">Vendor listings</CardTitle>
            <p className="text-muted-foreground mt-1 text-xs">
              Listings associated to this vendor. Showing {filtered.length} of{" "}
              {data.length} listing{data.length === 1 ? "" : "s"}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Download CSV"
              disabled={data.length === 0}
              onClick={() => downloadListingsCsv(data, vendorId)}
            >
              <Download className="h-4 w-4" />
            </Button>
            {canWrite ? (
              <Button type="button" size="sm" onClick={() => setMapOpen(true)}>
                <Plus className="mr-1 h-4 w-4" />
                Map New Listing To This Vendor
              </Button>
            ) : null}
          </div>
        </div>
        <div className="max-w-md">
          <Label htmlFor="vendor-listings-search" className="sr-only">
            Search vendor listings
          </Label>
          <Input
            id="vendor-listings-search"
            placeholder="Search vendor listings…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-0 p-0">
        {loading ? (
          <div className="space-y-2 px-6 py-4">
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : null}
        {!loading && data.length === 0 ? (
          <div className="px-6 py-8">
            <EmptyState
              title="No SKUs"
              description="This vendor has no vendor listing rows yet. Map a SKU or sync from inventory."
            />
          </div>
        ) : null}
        {!loading && data.length > 0 && filtered.length === 0 ? (
          <div className="px-6 py-8">
            <EmptyState
              title="No matches"
              description="Try a different search term."
            />
          </div>
        ) : null}

        {!loading && filtered.length > 0 ? (
          <div className="flex flex-col gap-4 border-t lg:flex-row">
            {/* Preview panel */}
            <div className="bg-muted/20 w-full shrink-0 border-b p-4 lg:w-[300px] lg:border-r lg:border-b-0 lg:p-5">
              {selectedRow && previewListing ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">Listing preview</p>
                    <Link
                      href={`/listings/${encodeURIComponent(selectedRow.sku_id)}`}
                      className="text-primary text-xs font-medium underline-offset-2 hover:underline"
                    >
                      View details →
                    </Link>
                  </div>
                  <div className="bg-background relative overflow-hidden rounded-lg border">
                    {(() => {
                      const mainImg = pickThumb(previewListing);
                      return mainImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={mainImg}
                          alt=""
                          className="aspect-square w-full object-contain p-2"
                        />
                      ) : (
                        <div className="text-muted-foreground flex aspect-square items-center justify-center text-xs">
                          No image
                        </div>
                      );
                    })()}
                  </div>
                  {canWrite ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => setDeleteTarget(selectedRow)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Mapping
                    </Button>
                  ) : null}
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs font-medium uppercase">
                        SKU ID
                      </p>
                      <p className="font-mono text-xs break-all font-semibold">
                        {selectedRow.sku_id}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs font-medium uppercase">
                        Description
                      </p>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {previewListing.description?.trim()
                          ? previewListing.description
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs font-medium uppercase">
                        SKU Type
                      </p>
                      <p className="text-sm">{previewListing.sku_type ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs font-medium uppercase">
                        On hand
                      </p>
                      <p className="font-mono text-sm">
                        {previewListing.available_quantity ?? "—"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : selectedRow && !previewListing ? (
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Listing preview</p>
                  <p className="text-muted-foreground text-sm">
                    Listing not loaded in Zap for SKU{" "}
                    <span className="font-mono">{selectedRow.sku_id}</span>.
                  </p>
                  {canWrite ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteTarget(selectedRow)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Mapping
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Grid */}
            <div className="flex-1 p-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {filtered.map((row) => {
                  const L = row.listing;
                  const thumb = pickThumb(L);
                  const selected = selectedRow?.sku_id === row.sku_id;
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setSelectedSku(row.sku_id)}
                      className={cn(
                        "group flex flex-col overflow-hidden rounded-lg border bg-card text-left shadow-sm transition-all",
                        selected
                          ? "border-primary ring-primary/30 ring-2"
                          : "border-border hover:border-primary/40"
                      )}
                    >
                      <div className="bg-muted/30 relative aspect-square w-full">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumb}
                            alt=""
                            className="h-full w-full object-contain p-1"
                          />
                        ) : (
                          <div className="text-muted-foreground flex h-full items-center justify-center text-[10px]">
                            No img
                          </div>
                        )}
                      </div>
                      <div className="space-y-1 p-2">
                        <p className="line-clamp-2 font-mono text-[10px] leading-tight break-all">
                          {row.sku_id}
                        </p>
                        <p className="text-muted-foreground text-[10px]">
                          Quantity:{" "}
                          <span className="text-foreground font-mono">
                            {L?.available_quantity ?? "—"}
                          </span>
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>

      <Dialog open={mapOpen} onOpenChange={resetMapDialog}>
        <DialogContent className="max-h-[min(90vh,640px)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Map New Listing To This Vendor</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="map-sku-search">Select Listing (SKU ID)</Label>
              <Input
                id="map-sku-search"
                placeholder="Search by SKU or description…"
                value={mapSearch}
                onChange={(e) => {
                  setMapSearch(e.target.value);
                  setMapPick(null);
                }}
              />
              <div className="border-input bg-muted/40 max-h-48 overflow-y-auto rounded-md border text-sm">
                {mapLoading ? (
                  <div className="text-muted-foreground flex items-center gap-2 p-3 text-xs">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching…
                  </div>
                ) : mapResults.length === 0 ? (
                  <p className="text-muted-foreground p-3 text-xs">
                    No listings found. Adjust search.
                  </p>
                ) : (
                  mapResults.map((row) => (
                    <button
                      key={row.sku_id}
                      type="button"
                      onClick={() => setMapPick(row)}
                      className={cn(
                        "hover:bg-accent block w-full border-b px-3 py-2 text-left text-xs last:border-0",
                        mapPick?.sku_id === row.sku_id && "bg-accent"
                      )}
                    >
                      <span className="font-mono">{row.sku_id}</span>
                      {row.description ? (
                        <span className="text-muted-foreground block truncate">
                          {row.description}
                        </span>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
            </div>
            {mapPick ? (
              <div className="space-y-2">
                <Label>Listing Images</Label>
                <div className="flex flex-wrap gap-2">
                  {[mapPick.img_hd, mapPick.img_white, mapPick.img_wdim, mapPick.img_link1, mapPick.img_link2]
                    .filter((u): u is string => Boolean(u && String(u).trim()))
                    .map((url, idx) => (
                      <a
                        key={`${mapPick.sku_id}-img-${idx}`}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-muted ring-border hover:ring-primary/50 h-16 w-16 shrink-0 overflow-hidden rounded-md ring-1 transition"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="h-full w-full object-contain" />
                      </a>
                    ))}
                </div>
                {![mapPick.img_hd, mapPick.img_white, mapPick.img_wdim, mapPick.img_link1, mapPick.img_link2].some(
                  Boolean
                ) ? (
                  <p className="text-muted-foreground text-xs">No images for this listing.</p>
                ) : null}
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="map-cost">Cost price (optional)</Label>
              <Input
                id="map-cost"
                inputMode="decimal"
                placeholder="0.00"
                value={mapCost}
                onChange={(e) => setMapCost(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="flex-row gap-3 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => resetMapDialog(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={mapSubmitting || !mapPick}
              onClick={() => void confirmMap()}
            >
              {mapSubmitting ? "Saving…" : "Map Listing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove listing mapping?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the vendor link for SKU{" "}
              <strong className="font-mono">{deleteTarget?.sku_id}</strong>. You can map it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 sm:justify-end">
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? "Removing…" : "Delete mapping"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
