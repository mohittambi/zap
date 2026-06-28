"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, Star } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { useListQueryState } from "@/hooks/use-list-query-state";
import { ListingsFilters } from "@/components/listings/listings-filters";
import { ListingsSort } from "@/components/listings/listings-sort";
import { CreateListingDialog } from "@/components/listings/create-listing-dialog";

type Row = {
  sku_id: string;
  description?: string;
  category?: string;
  available_quantity?: number;
  live_bin_qty?: number;
  img_hd?: string | null;
};

type PageResponse = {
  total: number;
  current_page: number;
  per_page_count: number;
  content: Row[];
};

const PAGE_SIZE = 24;

export default function WarehouseListingsPage() {
  const { state, set, toApiParams, clearAll } = useListQueryState();
  const [draft, setDraft] = React.useState(state.search);
  const [data, setData] = React.useState<PageResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<Row | null>(null);
  const [detail, setDetail] = React.useState<Record<string, unknown> | null>(null);
  const [focusLoading, setFocusLoading] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);

  // Keep the local draft in sync if the URL search param changes externally.
  React.useEffect(() => {
    setDraft(state.search);
  }, [state.search]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const sp = toApiParams();
      sp.set("count", String(PAGE_SIZE));
      const res = await apiFetch<PageResponse>(
        `/api/listings/by_page_v4?${sp.toString()}`
      );
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load listings");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [toApiParams]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!selected?.sku_id) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const d = await apiFetch<Record<string, unknown>>(
          `/api/listings/sku/${encodeURIComponent(selected.sku_id)}`
        );
        if (!cancelled) setDetail(d);
      } catch {
        if (!cancelled) setDetail(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected?.sku_id]);

  async function addToDefaultFocusList() {
    if (!selected?.sku_id) return;
    setFocusLoading(true);
    try {
      const lists = await apiFetch<{ id: number; title: string }[]>(
        "/api/focus-lists?is_public=true"
      );
      const def =
        lists.find((l) => l.title === "Default Focus List") ?? lists[0];
      if (!def) {
        toast.error("No public focus list found");
        return;
      }
      await apiFetch(`/api/focus-lists/${def.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku_id: selected.sku_id }),
      });
      toast.success("Added to focus list");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setFocusLoading(false);
    }
  }

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.per_page_count))
    : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-primary text-2xl font-semibold tracking-tight">
            Warehouse Listings
          </h1>
          <p className="text-sm text-muted-foreground">
            Browse master SKUs with images and add items to a focus list.{" "}
            <Link
              href="/listings/bulk"
              className="text-primary font-medium underline-offset-2 hover:underline"
            >
              Bulk CSV import
            </Link>{" "}
            for many SKUs at once.
          </p>
        </div>
        <div className="flex w-full max-w-md flex-col gap-2 lg:w-auto">
          <Label htmlFor="wh-search">Search Warehouse Only Listing</Label>
          <div className="flex gap-2">
            <Input
              id="wh-search"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") set({ search: draft });
              }}
              placeholder="Search…"
              className="min-h-11"
            />
            <Button
              type="button"
              className="min-h-11 shrink-0"
              onClick={() => set({ search: draft })}
            >
              <Search className="mr-2 size-4" />
              Search
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 shrink-0"
              onClick={() => setCreateOpen(true)}
            >
              + New Listing
            </Button>
          </div>
        </div>
      </div>

      <CreateListingDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(skuId) => {
          set({ search: skuId, page: 1 });
        }}
      />

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <ListingsFilters
          state={state}
          onChange={set}
          onClearAll={clearAll}
        />
        <ListingsSort value={state.sort} onChange={(v) => set({ sort: v })} />
      </div>

      <p className="text-sm text-muted-foreground">
        Showing {data?.content?.length ?? 0} of {data?.total ?? 0} listings available
      </p>

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(280px,360px)]">
        <div>
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-xl" />
              ))}
            </div>
          ) : !data?.content?.length ? (
            <EmptyState title="No listings" description="Try another search or clear filters." />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {data.content.map((row) => {
                  const img = row.img_hd || "";
                  const active = selected?.sku_id === row.sku_id;
                  const qty = row.live_bin_qty ?? row.available_quantity ?? "—";
                  return (
                    <button
                      key={row.sku_id}
                      type="button"
                      onClick={() => setSelected(row)}
                      className={cn(
                        "overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-all",
                        active ? "ring-2 ring-primary" : "hover:border-primary/40"
                      )}
                    >
                      <div className="relative aspect-square bg-muted">
                        {img ? (
                          <Image
                            src={img}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 50vw, 200px"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                            No image
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="font-mono text-xs font-semibold">{row.sku_id}</p>
                        <p className="text-muted-foreground text-xs">
                          Quantity: {qty}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
                <Button
                  variant="outline"
                  disabled={state.page <= 1}
                  onClick={() => set({ page: Math.max(1, state.page - 1) })}
                >
                  Load previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {data.current_page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={data.current_page >= totalPages}
                  onClick={() => set({ page: state.page + 1 })}
                >
                  Load more
                </Button>
              </div>
            </>
          )}
        </div>

        <Card className="h-fit p-4 lg:sticky lg:top-24">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-semibold">Listing Preview</h2>
            {selected && (
              <Button variant="link" size="sm" className="h-auto p-0" asChild>
                <Link href={`/listings/${encodeURIComponent(selected.sku_id)}`}>
                  View Details →
                </Link>
              </Button>
            )}
          </div>
          {!selected ? (
            <p className="text-sm text-muted-foreground">Select a product card.</p>
          ) : (
            <div className="space-y-3">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                {selected.img_hd ? (
                  <Image
                    src={selected.img_hd}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="360px"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No image
                  </div>
                )}
              </div>
              <Button
                className="w-full gap-2"
                onClick={() => void addToDefaultFocusList()}
                disabled={focusLoading}
              >
                <Star className="size-4" />
                Add to Focus List
              </Button>
              <dl className="space-y-1 text-sm">
                <div>
                  <dt className="text-muted-foreground">SKU ID</dt>
                  <dd className="font-mono">{selected.sku_id}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Description</dt>
                  <dd>{String(detail?.description ?? selected.description ?? "—")}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Available Quantity</dt>
                  <dd className="tabular-nums">
                    {String(detail?.available_quantity ?? selected.available_quantity ?? "—")}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
