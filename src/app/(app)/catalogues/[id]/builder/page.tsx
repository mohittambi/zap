"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Info, Search } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, apiUrl, getStoredToken } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import catalogueThemes from "@/data/catalogue-themes.json";

const DEFAULT_TEMPLATE_ID = String(catalogueThemes[0]?.id ?? "6021");

type Catalogue = {
  id: number;
  name: string;
  description?: string | null;
  created_by?: string | null;
};

type Tag = {
  id: number;
  name: string;
  tag_type: "operational" | "material";
};

type CatItem = {
  sku_id: string;
  description?: string | null;
  img_hd?: string | null;
  available_quantity?: number;
  moq?: number | null;
  display_price?: number;
  tags?: Tag[];
};

type ListingRow = {
  sku_id: string;
  description?: string;
  available_quantity?: number;
  img_hd?: string | null;
};

type GridPage = {
  total: number;
  current_page?: number;
  per_page_count: number;
  curr_page_count?: number;
  content: ListingRow[];
};

type ThemePages = {
  id: number;
  theme_id: number;
  first_page: string;
  second_page: string;
  third_page: string;
  theme_page: string;
};

type TemplateOpt = {
  id: string;
  name: string;
  description?: string;
  keywords?: string;
  theme_pages?: ThemePages;
};

async function downloadBlob(
  path: string,
  method: "GET" | "POST",
  body?: BodyInit,
  filename?: string
) {
  const headers = new Headers();
  const token = getStoredToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (body && !(body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(apiUrl(path), { method, headers, body });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? res.statusText);
  }
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename ?? "download";
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function CatalogueBuilderPage() {
  const params = useParams();
  const id = Number(params.id);
  const [cat, setCat] = React.useState<Catalogue | null>(null);
  const [items, setItems] = React.useState<CatItem[]>([]);
  const [templates, setTemplates] = React.useState<TemplateOpt[]>([]);
  const [templateId, setTemplateId] = React.useState(DEFAULT_TEMPLATE_ID);
  const [loading, setLoading] = React.useState(true);
  const [gridKeyword, setGridKeyword] = React.useState("");
  const [gridDraft, setGridDraft] = React.useState("");
  const [gridPage, setGridPage] = React.useState(1);
  const [gridData, setGridData] = React.useState<GridPage | null>(null);
  const [gridLoading, setGridLoading] = React.useState(false);
  const [materialTags, setMaterialTags] = React.useState<Tag[]>([]);
  const [filterMaterialIds, setFilterMaterialIds] = React.useState<number[]>([]);
  const [minPrice, setMinPrice] = React.useState("");
  const [maxPrice, setMaxPrice] = React.useState("");
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [selectedSku, setSelectedSku] = React.useState<string | null>(null);
  const bulkInputRef = React.useRef<HTMLInputElement>(null);

  const reloadItems = React.useCallback(async () => {
    const list = await apiFetch<CatItem[]>(`/api/catalogues/${id}/items`);
    setItems(list);
  }, [id]);

  React.useEffect(() => {
    if (!Number.isFinite(id)) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [c, t, mt] = await Promise.all([
          apiFetch<Catalogue>(`/api/catalogues/${id}`),
          apiFetch<TemplateOpt[]>("/api/catalogue-templates"),
          apiFetch<Tag[]>("/api/sku-tags?type=material"),
        ]);
        if (!cancelled) {
          setCat(c);
          setTemplates(t);
          setMaterialTags(mt);
          if (t[0]?.id) setTemplateId(t[0].id);
        }
        await reloadItems();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, reloadItems]);

  const loadGrid = React.useCallback(async () => {
    setGridLoading(true);
    try {
      const q = new URLSearchParams({ page: String(gridPage), count: "100" });
      if (gridKeyword.trim()) q.set("search_keyword", gridKeyword.trim());
      if (filterMaterialIds.length > 0) q.set("tag_ids", filterMaterialIds.join(","));
      if (minPrice.trim()) q.set("min_price", minPrice.trim());
      if (maxPrice.trim()) q.set("max_price", maxPrice.trim());
      const res = await apiFetch<GridPage>(`/api/listings/by_page_v4?${q}`);
      setGridData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      setGridData(null);
    } finally {
      setGridLoading(false);
    }
  }, [gridKeyword, gridPage, filterMaterialIds, minPrice, maxPrice]);

  React.useEffect(() => {
    void loadGrid();
  }, [loadGrid]);

  async function addSku(sku: ListingRow) {
    try {
      await apiFetch(`/api/catalogues/${id}/items`, {
        method: "POST",
        body: JSON.stringify({ sku_id: sku.sku_id }),
      });
      toast.success("Added to catalogue");
      setSelectedSku(null);
      await reloadItems();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function removeSku(skuId: string) {
    try {
      await apiFetch(
        `/api/catalogues/${id}/items?sku_id=${encodeURIComponent(skuId)}`,
        { method: "DELETE" }
      );
      toast.success("Removed");
      await reloadItems();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function onBulkImport(f: File) {
    const fd = new FormData();
    fd.append("file", f);
    const token = getStoredToken();
    const headers = new Headers();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    try {
      const res = await fetch(apiUrl(`/api/catalogues/${id}/items/bulk-import`), {
        method: "POST",
        headers,
        body: fd,
      });
      const json = (await res.json().catch(() => ({}))) as {
        imported?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      toast.success(`Imported ${json.imported ?? 0} rows`);
      await reloadItems();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  function toggleMaterialFilter(tagId: number) {
    setGridPage(1);
    setFilterMaterialIds((ids) =>
      ids.includes(tagId) ? ids.filter((i) => i !== tagId) : [...ids, tagId]
    );
  }

  function clearFilters() {
    setFilterMaterialIds([]);
    setMinPrice("");
    setMaxPrice("");
    setGridPage(1);
  }

  const perPage = gridData?.per_page_count ?? 100;
  const gridLastPage = Math.max(
    1,
    Math.ceil((gridData?.total ?? 0) / perPage) || 1
  );

  if (loading && !cat) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!cat) {
    return (
      <div>
        <p className="text-muted-foreground">Catalogue not found.</p>
        <Button asChild variant="link" className="mt-2">
          <Link href="/catalogues">Back</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col gap-0">
      {/* Top meta bar — matches legacy “Catalogue ID / Created By” */}
      <div className="bg-primary text-primary-foreground -mx-4 mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 md:-mx-8 md:px-8">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Info className="size-4 shrink-0 opacity-90" aria-hidden />
          <span>Catalogue ID : {id}</span>
        </div>
        <span className="text-sm opacity-95">
          Created By : {cat.created_by ?? "—"}
        </span>
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="ml-auto text-primary-foreground hover:bg-white/15 hover:text-white"
        >
          <Link href="/catalogues">← Catalogue list</Link>
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-0 lg:flex-row lg:items-stretch">
        {/* Sidebar — catalogue items */}
        <aside className="flex w-full shrink-0 flex-col border-b bg-card lg:w-[min(100%,380px)] lg:border-r lg:border-b-0">
          <div className="border-b bg-muted/40 px-4 py-4">
            <h2 className="text-primary text-lg font-semibold tracking-tight">
              Catalogue Items
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Item Count : {items.length}
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogTrigger
                  render={
                    <Button
                      type="button"
                      className="min-h-11 w-full shrink-0 sm:flex-1"
                    >
                      Generate Catalogue Document
                    </Button>
                  }
                />
                <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Generate document</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="tpl">Template</Label>
                      <select
                        id="tpl"
                        className="border-input bg-background flex h-10 w-full rounded-md border px-3 text-sm"
                        value={templateId}
                        onChange={(e) => setTemplateId(e.target.value)}
                      >
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-muted-foreground text-xs">
                        {templates.find((x) => x.id === templateId)?.description}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                      <p className="font-medium">Multi-page preview</p>
                      <p className="text-muted-foreground mt-1">
                        PDF is generated server-side ({items.length} items).
                      </p>
                      <ScrollArea className="mt-3 h-40 rounded border bg-background p-2">
                        <ul className="space-y-1 font-mono text-xs">
                          {items.slice(0, 12).map((i) => (
                            <li key={i.sku_id}>{i.sku_id}</li>
                          ))}
                          {items.length > 12 && <li>…</li>}
                        </ul>
                      </ScrollArea>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() =>
                          void downloadBlob(
                            `/api/catalogues/${id}/export/pdf`,
                            "POST",
                            JSON.stringify({ template_id: templateId }),
                            `catalogue-${id}.pdf`
                          )
                            .then(() => toast.success("PDF ready"))
                            .catch((e) =>
                              toast.error(
                                e instanceof Error ? e.message : "Failed"
                              )
                            )
                        }
                      >
                        Download PDF
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() =>
                          void downloadBlob(
                            `/api/catalogues/${id}/export/xlsx`,
                            "POST",
                            undefined,
                            `catalogue-${id}.xlsx`
                          )
                            .then(() => toast.success("Excel ready"))
                            .catch((e) =>
                              toast.error(
                                e instanceof Error ? e.message : "Failed"
                              )
                            )
                        }
                      >
                        Download Excel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 w-full sm:flex-1"
                onClick={() => bulkInputRef.current?.click()}
              >
                Import Items In Bulk
              </Button>
              <input
                ref={bulkInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onBulkImport(f);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          <ScrollArea className="min-h-[280px] flex-1 lg:max-h-[calc(100dvh-16rem)]">
            <ul className="space-y-3 p-4">
              {items.map((i) => (
                <li
                  key={i.sku_id}
                  className="flex gap-3 rounded-xl border bg-card p-3 text-sm shadow-sm"
                >
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {i.img_hd ? (
                      <Image
                        src={i.img_hd}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="text-muted-foreground flex size-full items-center justify-center text-[10px]">
                        N/A
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs font-semibold tracking-tight">
                      {i.sku_id}
                    </p>
                    <p className="text-muted-foreground line-clamp-2 text-xs">
                      {i.description ?? "—"}
                    </p>
                    <p className="mt-1 text-xs tabular-nums">
                      Available: {i.available_quantity ?? 0} · MOQ{" "}
                      {i.moq ?? "—"} · ₹{i.display_price ?? "—"}
                    </p>
                    {i.tags && i.tags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {i.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className={
                              "rounded-full px-1.5 py-0.5 text-[10px] font-medium " +
                              (tag.tag_type === "material"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-amber-100 text-amber-700")
                            }
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 self-start"
                    onClick={() => void removeSku(i.sku_id)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
              {!items.length ? (
                <li className="text-muted-foreground text-sm">No items yet.</li>
              ) : null}
            </ul>
          </ScrollArea>
        </aside>

        {/* Main — picker grid */}
        <main className="flex min-w-0 flex-1 flex-col bg-background">
          <div className="border-b px-4 py-4 md:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                  aria-hidden
                />
                <Input
                  value={gridDraft}
                  onChange={(e) => setGridDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setGridPage(1);
                      setGridKeyword(gridDraft);
                    }
                  }}
                  placeholder="Search listing to add to catalogue…"
                  className="min-h-11 pr-3 pl-10"
                />
              </div>
              <div className="flex w-full flex-col gap-1 sm:w-auto sm:shrink-0">
                <Button
                  className="min-h-11 w-full sm:w-auto"
                  disabled={!selectedSku}
                  title={
                    selectedSku
                      ? "Add selected listing"
                      : "Select a product card below first"
                  }
                  onClick={() => {
                    const row = gridData?.content.find(
                      (r) => r.sku_id === selectedSku
                    );
                    if (row) void addSku(row);
                  }}
                >
                  Add To Catalogue
                </Button>
                {!selectedSku ? (
                  <p className="text-muted-foreground text-center text-xs sm:text-left">
                    Select a listing in the grid to enable
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Filter bar — material tags + price range */}
          {materialTags.length > 0 && (
            <div className="border-b px-4 py-3 md:px-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-medium text-muted-foreground shrink-0">Material:</span>
                <div className="flex flex-wrap gap-1">
                  {materialTags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => toggleMaterialFilter(tag.id)}
                      className={
                        "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors " +
                        (filterMaterialIds.includes(tag.id)
                          ? "border-blue-300 bg-blue-100 text-blue-700"
                          : "border-muted-foreground/30 text-muted-foreground hover:border-blue-300 hover:text-blue-600")
                      }
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
                <span className="text-xs font-medium text-muted-foreground shrink-0 ml-2">Price:</span>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    placeholder="Min ₹"
                    value={minPrice}
                    onChange={(e) => { setMinPrice(e.target.value); setGridPage(1); }}
                    className="h-7 w-20 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input
                    type="number"
                    placeholder="Max ₹"
                    value={maxPrice}
                    onChange={(e) => { setMaxPrice(e.target.value); setGridPage(1); }}
                    className="h-7 w-20 text-xs"
                  />
                </div>
                {(filterMaterialIds.length > 0 || minPrice || maxPrice) && (
                  <button
                    onClick={clearFilters}
                    className="text-xs text-muted-foreground underline hover:text-foreground"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="bg-primary/12 text-primary px-4 py-3 text-sm font-medium md:px-6">
            Choose listings to add to this catalogue
          </div>

          <div className="flex-1 px-4 py-4 md:px-6">
            {gridLoading ? (
              <Skeleton className="h-96 w-full rounded-xl" />
            ) : (
              <div
                className={cn(
                  "grid gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8"
                )}
              >
                {gridData?.content.map((row) => {
                  const selected = selectedSku === row.sku_id;
                  return (
                    <button
                      key={row.sku_id}
                      type="button"
                      className={cn(
                        "group flex flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm transition",
                        selected
                          ? "ring-primary ring-2 ring-offset-2"
                          : "hover:border-primary/50"
                      )}
                      onClick={() =>
                        setSelectedSku((s) =>
                          s === row.sku_id ? null : row.sku_id
                        )
                      }
                      onDoubleClick={() => void addSku(row)}
                    >
                      <div className="relative aspect-square w-full bg-muted">
                        {row.img_hd ? (
                          <Image
                            src={row.img_hd}
                            alt=""
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="text-muted-foreground flex size-full items-center justify-center text-[10px]">
                            N/A
                          </div>
                        )}
                      </div>
                      <div className="space-y-0.5 p-2.5">
                        <p className="truncate font-mono text-[11px] font-semibold">
                          {row.sku_id}
                        </p>
                        <p className="text-muted-foreground line-clamp-2 min-h-[2rem] text-[11px] leading-snug">
                          {row.description ?? "—"}
                        </p>
                        <p className="text-muted-foreground pt-0.5 text-[10px] tabular-nums">
                          Quantity : {row.available_quantity ?? 0}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="text-muted-foreground mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span>
                {gridData
                  ? `Page ${gridPage} of ${gridLastPage} · Showing ${gridData.content.length} of ${gridData.total} listings`
                  : null}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={gridPage <= 1}
                  onClick={() => setGridPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!gridData || gridPage >= gridLastPage}
                  onClick={() => setGridPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
