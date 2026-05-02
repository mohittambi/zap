"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowDownAZ,
  ArrowRight,
  Filter,
  ImageOff,
  LayoutGrid,
  List as ListIcon,
  Package,
  Search,
  Star,
  Table as TableIcon,
  Tag,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

type Row = {
  sku_id: string;
  description?: string;
  category?: string;
  available_quantity?: number;
  img_hd?: string | null;
};

type PageResponse = {
  total: number;
  current_page: number;
  per_page_count: number;
  content: Row[];
};

export default function WarehouseListingsPage() {
  const [keyword, setKeyword] = React.useState("");
  const [draft, setDraft] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<PageResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<Row | null>(null);
  const [detail, setDetail] = React.useState<Record<string, unknown> | null>(null);
  const [focusLoading, setFocusLoading] = React.useState(false);
  const [view, setView] = React.useState<"grid" | "list" | "table">("list");

  const [listSearch, setListSearch] = React.useState("");
  const [stockFilter, setStockFilter] = React.useState<"all" | "in" | "out">("all");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [sortBy, setSortBy] = React.useState<
    "default" | "sku-asc" | "sku-desc" | "title-asc" | "title-desc" | "qty-asc" | "qty-desc"
  >("default");
  const [qtyMin, setQtyMin] = React.useState("");
  const [qtyMax, setQtyMax] = React.useState("");

  const categories = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of data?.content ?? []) {
      if (r.category) set.add(r.category);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const filteredRows = React.useMemo(() => {
    const rows = data?.content ?? [];
    const q = listSearch.trim().toLowerCase();
    const min = qtyMin === "" ? null : Number(qtyMin);
    const max = qtyMax === "" ? null : Number(qtyMax);
    const out = rows.filter((r) => {
      if (q) {
        const hay = `${r.sku_id} ${r.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const qty = r.available_quantity ?? 0;
      if (stockFilter === "in" && qty <= 0) return false;
      if (stockFilter === "out" && qty > 0) return false;
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      if (min !== null && Number.isFinite(min) && qty < min) return false;
      if (max !== null && Number.isFinite(max) && qty > max) return false;
      return true;
    });
    const sorted = [...out];
    switch (sortBy) {
      case "sku-asc":
        sorted.sort((a, b) => a.sku_id.localeCompare(b.sku_id));
        break;
      case "sku-desc":
        sorted.sort((a, b) => b.sku_id.localeCompare(a.sku_id));
        break;
      case "title-asc":
        sorted.sort((a, b) =>
          (a.description ?? "").localeCompare(b.description ?? "")
        );
        break;
      case "title-desc":
        sorted.sort((a, b) =>
          (b.description ?? "").localeCompare(a.description ?? "")
        );
        break;
      case "qty-asc":
        sorted.sort(
          (a, b) => (a.available_quantity ?? 0) - (b.available_quantity ?? 0)
        );
        break;
      case "qty-desc":
        sorted.sort(
          (a, b) => (b.available_quantity ?? 0) - (a.available_quantity ?? 0)
        );
        break;
    }
    return sorted;
  }, [data, listSearch, stockFilter, categoryFilter, qtyMin, qtyMax, sortBy]);

  const filtersActive =
    listSearch !== "" ||
    stockFilter !== "all" ||
    categoryFilter !== "all" ||
    sortBy !== "default" ||
    qtyMin !== "" ||
    qtyMax !== "";

  function clearFilters() {
    setListSearch("");
    setStockFilter("all");
    setCategoryFilter("all");
    setSortBy("default");
    setQtyMin("");
    setQtyMax("");
  }

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        page: String(page),
        count: "24",
      });
      if (keyword.trim()) q.set("search_keyword", keyword.trim());
      const res = await apiFetch<PageResponse>(
        `/api/listings/by_page_v4?${q.toString()}`
      );
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load listings");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [keyword, page]);

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h1 className="text-primary text-xl font-semibold tracking-tight">
              Warehouse Listings
            </h1>
            <span className="text-xs text-muted-foreground">
              {data?.content?.length ?? 0} of {data?.total ?? 0}
            </span>
          </div>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="wh-search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPage(1);
                setKeyword(draft);
              }
            }}
            placeholder="Search warehouse listings…"
            aria-label="Search warehouse listings"
            className="h-9 pl-8"
          />
        </div>
        <Button
          type="button"
          size="sm"
          className="h-9"
          onClick={() => {
            setPage(1);
            setKeyword(draft);
          }}
        >
          Search
        </Button>

        <div
          role="tablist"
          aria-label="View mode"
          className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-card/60 p-1 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/40"
        >
          {(
            [
              ["grid", "Grid", LayoutGrid],
              ["list", "List", ListIcon],
              ["table", "Table", TableIcon],
            ] as const
          ).map(([key, label, Icon]) => {
            const active = view === key;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setView(key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium outline-none transition-all duration-200",
                  "focus-visible:ring-2 focus-visible:ring-ring/60",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                <span className="hidden md:inline">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(280px,360px)]">
        <div>
          {loading ? (
            view === "grid" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-72 w-full rounded-xl" />
                ))}
              </div>
            ) : view === "table" ? (
              <Skeleton className="h-96 w-full rounded-xl" />
            ) : (
              <ul className="flex flex-col gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <li key={i}>
                    <Skeleton className="h-24 w-full rounded-xl sm:h-28" />
                  </li>
                ))}
              </ul>
            )
          ) : !data?.content?.length ? (
            <EmptyState title="No listings" description="Try another search." />
          ) : (
            <>
              <div className="mb-4 rounded-xl border border-border/60 bg-card/60 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/40">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Filter className="size-3.5" />
                    </span>
                    <h3 className="text-sm font-semibold tracking-tight">Filters</h3>
                    {filtersActive && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary ring-1 ring-primary/20">
                        Active
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    disabled={!filtersActive}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <X className="size-3.5" />
                    Clear filters
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  <div className="space-y-1.5 xl:col-span-2">
                    <Label htmlFor="list-search" className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Search
                    </Label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="list-search"
                        value={listSearch}
                        onChange={(e) => setListSearch(e.target.value)}
                        placeholder="SKU or title…"
                        className="h-9 pl-8"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="stock-filter" className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Stock status
                    </Label>
                    <select
                      id="stock-filter"
                      value={stockFilter}
                      onChange={(e) => setStockFilter(e.target.value as typeof stockFilter)}
                      className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    >
                      <option value="all">All stock</option>
                      <option value="in">In stock</option>
                      <option value="out">Out of stock</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="category-filter" className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Category
                    </Label>
                    <select
                      id="category-filter"
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    >
                      <option value="all">All categories</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="sort-by" className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Sort by
                    </Label>
                    <div className="relative">
                      <ArrowDownAZ className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <select
                        id="sort-by"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                        className="h-9 w-full rounded-lg border border-input bg-transparent pl-8 pr-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                      >
                        <option value="default">Default</option>
                        <option value="sku-asc">SKU (A → Z)</option>
                        <option value="sku-desc">SKU (Z → A)</option>
                        <option value="title-asc">Title (A → Z)</option>
                        <option value="title-desc">Title (Z → A)</option>
                        <option value="qty-asc">Quantity (low → high)</option>
                        <option value="qty-desc">Quantity (high → low)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Quantity range
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={0}
                        value={qtyMin}
                        onChange={(e) => setQtyMin(e.target.value)}
                        placeholder="Min"
                        aria-label="Minimum quantity"
                        className="h-9"
                      />
                      <span className="text-xs text-muted-foreground">–</span>
                      <Input
                        type="number"
                        min={0}
                        value={qtyMax}
                        onChange={(e) => setQtyMax(e.target.value)}
                        placeholder="Max"
                        aria-label="Maximum quantity"
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>

                {filtersActive && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Showing <span className="font-medium text-foreground">{filteredRows.length}</span> of {data.content.length} loaded items
                  </p>
                )}
              </div>

              {filteredRows.length === 0 ? (
                <EmptyState
                  title="No items match your filters"
                  description="Try clearing some filters or broadening your search."
                />
              ) : (
                <>
              {view === "grid" && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredRows.map((row) => {
                    const img = row.img_hd || "";
                    const active = selected?.sku_id === row.sku_id;
                    const qty = row.available_quantity ?? 0;
                    const inStock = qty > 0;
                    return (
                      <div
                        key={row.sku_id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelected(row)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelected(row);
                          }
                        }}
                        className={cn(
                          "group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all",
                          "hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg",
                          active &&
                            "border-primary/60 shadow-md ring-2 ring-primary/40"
                        )}
                      >
                        <div className="relative aspect-square overflow-hidden bg-muted">
                          {img ? (
                            <Image
                              src={img}
                              alt=""
                              fill
                              className="object-cover transition-transform duration-500 group-hover:scale-105"
                              sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                              <ImageOff className="size-6" />
                              <span className="text-xs">No image</span>
                            </div>
                          )}
                          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
                            <span className="rounded-md bg-background/80 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground shadow-sm ring-1 ring-border/60 backdrop-blur">
                              {row.sku_id}
                            </span>
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium shadow-sm backdrop-blur ring-1",
                                inStock
                                  ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                                  : "bg-red-500/15 text-red-300 ring-red-500/30"
                              )}
                            >
                              <span
                                className={cn(
                                  "size-1.5 rounded-full",
                                  inStock ? "bg-emerald-400" : "bg-red-400"
                                )}
                              />
                              {inStock ? "In stock" : "Out of stock"}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-1 flex-col gap-3 p-4">
                          <div className="space-y-1.5">
                            <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                              {row.description || "Untitled product"}
                            </p>
                            {row.category && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                <Tag className="size-3" />
                                {row.category}
                              </span>
                            )}
                          </div>
                          <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                            <div>
                              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                Quantity
                              </p>
                              <p className="text-lg font-semibold tabular-nums text-foreground">
                                {qty.toLocaleString()}
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="default"
                              asChild
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Link
                                href={`/listings/${encodeURIComponent(row.sku_id)}`}
                              >
                                View
                                <ArrowRight className="ml-1 size-3.5" />
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {view === "list" && (
                <ul className="flex flex-col gap-2">
                  {filteredRows.map((row) => {
                    const img = row.img_hd || "";
                    const active = selected?.sku_id === row.sku_id;
                    const qty = row.available_quantity ?? 0;
                    const inStock = qty > 0;
                    return (
                      <li key={row.sku_id}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelected(row)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelected(row);
                            }
                          }}
                          className={cn(
                            "group relative flex cursor-pointer items-center gap-4 rounded-xl border bg-card p-3 shadow-sm transition-all sm:gap-5 sm:p-4",
                            "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
                            active &&
                              "border-primary/60 shadow-md ring-2 ring-primary/40"
                          )}
                        >
                          <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border/60 sm:size-24">
                            {img ? (
                              <Image
                                src={img}
                                alt=""
                                fill
                                className="object-cover transition-transform duration-300 group-hover:scale-105"
                                sizes="96px"
                                unoptimized
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center px-1 text-center text-[10px] text-muted-foreground">
                                No image
                              </div>
                            )}
                          </div>

                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {row.sku_id}
                            </p>
                            <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground sm:text-base">
                              {row.description || "Untitled product"}
                            </p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2">
                              {row.category && (
                                <span className="rounded-md border border-border/60 bg-muted/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                  {row.category}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground sm:hidden">
                                <span
                                  className={cn(
                                    "size-1.5 rounded-full",
                                    inStock ? "bg-emerald-500" : "bg-red-500"
                                  )}
                                />
                                Qty <span className="tabular-nums font-medium text-foreground">{qty}</span>
                              </span>
                            </div>
                          </div>

                          <div className="hidden min-w-[96px] flex-col items-end gap-1.5 sm:flex">
                            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              Quantity
                            </span>
                            <span className="text-base font-semibold tabular-nums text-foreground">
                              {qty}
                            </span>
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                                inStock
                                  ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
                                  : "bg-red-500/10 text-red-400 ring-1 ring-red-500/20"
                              )}
                            >
                              <span
                                className={cn(
                                  "size-1.5 rounded-full",
                                  inStock ? "bg-emerald-500" : "bg-red-500"
                                )}
                              />
                              {inStock ? "In stock" : "Out of stock"}
                            </span>
                          </div>

                          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelected(row);
                              }}
                              className="hidden sm:inline-flex"
                            >
                              Preview
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="default"
                              asChild
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Link
                                href={`/listings/${encodeURIComponent(row.sku_id)}`}
                              >
                                View
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {view === "table" && (
                <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-border/60 bg-muted/40">
                        <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          <th scope="col" className="px-4 py-3 w-[72px]">Image</th>
                          <th scope="col" className="px-4 py-3">Product Code</th>
                          <th scope="col" className="px-4 py-3">Title</th>
                          <th scope="col" className="px-4 py-3 text-right">Quantity</th>
                          <th scope="col" className="px-4 py-3">Status</th>
                          <th scope="col" className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {filteredRows.map((row) => {
                          const img = row.img_hd || "";
                          const active = selected?.sku_id === row.sku_id;
                          const qty = row.available_quantity ?? 0;
                          const inStock = qty > 0;
                          return (
                            <tr
                              key={row.sku_id}
                              onClick={() => setSelected(row)}
                              className={cn(
                                "cursor-pointer transition-colors hover:bg-accent/40",
                                active && "bg-primary/5"
                              )}
                            >
                              <td className="px-4 py-3">
                                <div className="relative size-12 overflow-hidden rounded-md bg-muted ring-1 ring-border/60">
                                  {img ? (
                                    <Image
                                      src={img}
                                      alt=""
                                      fill
                                      className="object-cover"
                                      sizes="48px"
                                      unoptimized
                                    />
                                  ) : (
                                    <div className="flex h-full items-center justify-center text-muted-foreground">
                                      <ImageOff className="size-4" />
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
                                  {row.sku_id}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <p className="line-clamp-1 max-w-[420px] font-medium text-foreground">
                                  {row.description || "Untitled product"}
                                </p>
                                {row.category && (
                                  <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                                    {row.category}
                                  </p>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">
                                {qty.toLocaleString()}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1",
                                    inStock
                                      ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
                                      : "bg-red-500/10 text-red-400 ring-red-500/20"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "size-1.5 rounded-full",
                                      inStock ? "bg-emerald-500" : "bg-red-500"
                                    )}
                                  />
                                  {inStock ? "In stock" : "Out of stock"}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelected(row);
                                    }}
                                  >
                                    Preview
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="default"
                                    asChild
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Link
                                      href={`/listings/${encodeURIComponent(row.sku_id)}`}
                                    >
                                      View
                                    </Link>
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
                </>
              )}

              <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
                <Button
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Load previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {data.current_page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={data.current_page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Load more
                </Button>
              </div>
            </>
          )}
        </div>

        <Card className="h-fit overflow-hidden p-0 shadow-lg lg:sticky lg:top-24">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Package className="size-4" />
              </span>
              <h2 className="text-sm font-semibold tracking-tight">
                Listing Preview
              </h2>
            </div>
            {selected && (
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" asChild>
                <Link href={`/listings/${encodeURIComponent(selected.sku_id)}`}>
                  Details
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            )}
          </div>

          {!selected ? (
            <div className="flex flex-col items-center justify-center gap-3 px-5 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground ring-1 ring-border/60">
                <Package className="size-5" />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">No item selected</p>
                <p className="text-xs text-muted-foreground">
                  Pick a product from the list to see its details here.
                </p>
              </div>
            </div>
          ) : (
            (() => {
              const description = String(
                detail?.description ?? selected.description ?? ""
              );
              const qtyRaw = detail?.available_quantity ?? selected.available_quantity;
              const qtyNum =
                typeof qtyRaw === "number"
                  ? qtyRaw
                  : Number.isFinite(Number(qtyRaw))
                    ? Number(qtyRaw)
                    : null;
              const inStock = qtyNum !== null && qtyNum > 0;
              const category = String(
                detail?.category ?? selected.category ?? ""
              );
              return (
                <div className="flex flex-col">
                  <div className="px-5 pt-5">
                    <div className="group/preview relative aspect-square overflow-hidden rounded-xl bg-muted ring-1 ring-border/60">
                      {selected.img_hd ? (
                        <Image
                          src={selected.img_hd}
                          alt=""
                          fill
                          className="object-cover transition-transform duration-500 group-hover/preview:scale-[1.03]"
                          sizes="360px"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                          <ImageOff className="size-6" />
                          <span className="text-xs">No image available</span>
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
                        <span className="rounded-md bg-background/80 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground shadow-sm ring-1 ring-border/60 backdrop-blur">
                          {selected.sku_id}
                        </span>
                        {qtyNum !== null && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium shadow-sm backdrop-blur ring-1",
                              inStock
                                ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                                : "bg-red-500/15 text-red-300 ring-red-500/30"
                            )}
                          >
                            <span
                              className={cn(
                                "size-1.5 rounded-full",
                                inStock ? "bg-emerald-400" : "bg-red-400"
                              )}
                            />
                            {inStock ? "In stock" : "Out of stock"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 px-5 py-5">
                    <div className="space-y-2">
                      <p className="line-clamp-3 text-base font-semibold leading-snug text-foreground">
                        {description || "Untitled product"}
                      </p>
                      {category && (
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          <Tag className="size-3" />
                          {category}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Quantity
                        </p>
                        <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                          {qtyNum !== null ? qtyNum.toLocaleString() : "—"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Status
                        </p>
                        <p
                          className={cn(
                            "mt-0.5 text-sm font-semibold",
                            qtyNum === null
                              ? "text-muted-foreground"
                              : inStock
                                ? "text-emerald-400"
                                : "text-red-400"
                          )}
                        >
                          {qtyNum === null
                            ? "Unknown"
                            : inStock
                              ? "Available"
                              : "Unavailable"}
                        </p>
                      </div>
                    </div>

                    <dl className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60 bg-muted/20 text-sm">
                      <div className="flex items-center justify-between gap-3 px-3 py-2">
                        <dt className="text-xs text-muted-foreground">SKU ID</dt>
                        <dd className="truncate font-mono text-xs font-medium text-foreground">
                          {selected.sku_id}
                        </dd>
                      </div>
                      <div className="flex items-start justify-between gap-3 px-3 py-2">
                        <dt className="shrink-0 text-xs text-muted-foreground">
                          Description
                        </dt>
                        <dd className="line-clamp-2 text-right text-xs text-foreground">
                          {description || "—"}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3 px-3 py-2">
                        <dt className="text-xs text-muted-foreground">
                          Available
                        </dt>
                        <dd className="tabular-nums text-xs font-medium text-foreground">
                          {qtyNum !== null ? qtyNum.toLocaleString() : "—"}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="flex flex-col gap-2 border-t border-border/60 bg-muted/30 px-5 py-4">
                    <Button
                      className="w-full gap-2"
                      onClick={() => void addToDefaultFocusList()}
                      disabled={focusLoading}
                    >
                      <Star className="size-4" />
                      {focusLoading ? "Adding…" : "Add to Focus List"}
                    </Button>
                    <Button variant="outline" className="w-full gap-2" asChild>
                      <Link
                        href={`/listings/${encodeURIComponent(selected.sku_id)}`}
                      >
                        View Full Details
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })()
          )}
        </Card>
      </div>
    </div>
  );
}
