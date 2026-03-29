"use client";

import * as React from "react";
import Image from "next/image";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { AppPageTitle } from "@/components/layout/app-page-shell";
import { cn } from "@/lib/utils";

type CompanyDetail = {
  company_id?: number;
  company_name?: string;
  company_code_primary?: string;
};

type LabelsData = {
  secondary_sku?: string;
  ean_code?: string;
  size?: string;
  color?: string;
  one_set_contains?: string;
  mrp?: number;
  material?: string;
};

type Row = {
  id: number;
  secondary_sku: string;
  master_sku?: string;
  inventory_sku_id?: string;
  pack_combo_sku_id?: string;
  sku_type?: string;
  inventory_bypass_status?: string;
  ais_quantity?: number;
  available_quantity?: number;
  effective_available_quantity?: number;
  associated_companies_count?: number;
  secondary_sku_company_details?: CompanyDetail[];
  secondary_sku_labels_data?: LabelsData;
};

type EautomateBinRow = {
  id?: number;
  warehouse_id?: number;
  sku_id?: string;
  bin_id?: string;
  available_quantity?: number;
  is_deleted?: number;
};

type SkuWiseListing = {
  sku_id?: string;
  img_hd?: string | null;
  img_white?: string | null;
  img_wdim?: string | null;
  img_link1?: string | null;
  img_link2?: string | null;
  available_quantity?: number;
  description?: string | null;
  bins?: EautomateBinRow[];
} | null;

type SkuWisePreview = {
  warehouse_secondary_listing?: SkuWiseListing;
  master_sku_listing?: SkuWiseListing;
  pack_combo_sku_listing?: SkuWiseListing;
  pack_combo_components?: {
    id?: number;
    pack_combo_sku_id?: string;
    component_sku_id: string;
    quantity: number;
    listing: SkuWiseListing;
  }[];
  secondary_sku_company_details?: CompanyDetail[];
  secondary_sku_labels_data?: LabelsData & Record<string, unknown>;
};

const EAUTOMATE_APP_ORIGIN =
  process.env.NEXT_PUBLIC_EAUTOMATE_CREATE_LABEL_URL?.replace(/\/$/, "") ??
  "https://web.eautomate.in";

function labelLine(k: string, v: string | number | null | undefined) {
  const s = v == null || v === "" ? "—" : String(v);
  return (
    <div className="text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="ml-2 font-medium">{s}</span>
    </div>
  );
}

function listingImageUrl(listing: SkuWiseListing): string | null {
  if (!listing) return null;
  return (
    listing.img_hd ||
    listing.img_white ||
    listing.img_wdim ||
    listing.img_link1 ||
    listing.img_link2 ||
    null
  );
}

const LABEL_KEYS_ORDER = [
  "ean_code",
  "size",
  "color",
  "mrp",
  "material",
  "one_set_contains",
] as const;

function labelsHaveDisplayableData(
  labels: (LabelsData & Record<string, unknown>) | null | undefined
): boolean {
  if (!labels || typeof labels !== "object") return false;
  for (const k of LABEL_KEYS_ORDER) {
    const v = labels[k as keyof typeof labels];
    if (v != null && v !== "" && v !== "NA") return true;
  }
  for (const [k, v] of Object.entries(labels)) {
    if (k === "secondary_sku") continue;
    if (LABEL_KEYS_ORDER.includes(k as (typeof LABEL_KEYS_ORDER)[number])) continue;
    if (v != null && v !== "" && typeof v !== "object") return true;
  }
  return false;
}

function companyCountCell(row: Row): number | string {
  if (row.associated_companies_count != null) return row.associated_companies_count;
  const d = row.secondary_sku_company_details;
  if (Array.isArray(d)) return d.length;
  return "—";
}

type PaginatedRows = {
  total: number;
  current_page?: number;
  per_page_count?: number;
  curr_page_count?: number;
  content: Row[];
};

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 500] as const;

function PageJump({
  page,
  totalPages,
  onJump,
}: {
  page: number;
  totalPages: number;
  onJump: (p: number) => void;
}) {
  const [draft, setDraft] = React.useState(String(page));
  React.useEffect(() => {
    setDraft(String(page));
  }, [page]);

  const commit = () => {
    const n = Number.parseInt(draft, 10);
    if (Number.isNaN(n)) {
      setDraft(String(page));
      return;
    }
    const clamped = Math.min(Math.max(1, n), totalPages);
    setDraft(String(clamped));
    if (clamped !== page) onJump(clamped);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="max-sm:hidden">Go to</span>
      <Input
        type="text"
        inputMode="numeric"
        className="h-9 w-14 text-center font-mono text-sm tabular-nums"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        aria-label="Go to page"
      />
      <span className="text-muted-foreground max-sm:hidden">/ {totalPages}</span>
    </div>
  );
}

export default function ListingsSecondaryPage() {
  const [draft, setDraft] = React.useState("");
  const [keyword, setKeyword] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(100);
  const [data, setData] = React.useState<PaginatedRows | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [previewDetail, setPreviewDetail] = React.useState<SkuWisePreview | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        page: String(page),
        count: String(pageSize),
      });
      if (keyword.trim()) q.set("search_keyword", keyword.trim());
      const res = await apiFetch<PaginatedRows>(
        `/api/inventory/secondary_listings/paginated?${q}`
      );
      setData(res);
      setSelectedId((cur) => {
        const list = res.content ?? [];
        if (list.length === 0) return null;
        if (cur != null && list.some((r) => r.id === cur)) return cur;
        return list[0].id;
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      setData(null);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, [keyword, page, pageSize]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const selected = data?.content?.find((r) => r.id === selectedId) ?? null;

  React.useEffect(() => {
    const sku = selected?.secondary_sku;
    if (!sku) {
      setPreviewDetail(null);
      setPreviewLoading(false);
      return;
    }
    const ac = new AbortController();
    setPreviewLoading(true);
    void (async () => {
      try {
        const res = await apiFetch<SkuWisePreview>(
          `/api/inventory/secondary_listings/sku_wise_details?secondary_sku=${encodeURIComponent(sku)}`,
          { signal: ac.signal }
        );
        if (!ac.signal.aborted) setPreviewDetail(res);
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        toast.error(e instanceof Error ? e.message : "Failed to load SKU details");
        if (!ac.signal.aborted) setPreviewDetail(null);
      } finally {
        if (!ac.signal.aborted) setPreviewLoading(false);
      }
    })();
    return () => ac.abort();
  }, [selected?.secondary_sku]);

  const total = data?.total ?? 0;
  const totalPages =
    total === 0 ? 1 : Math.max(1, Math.ceil(total / pageSize));

  React.useEffect(() => {
    if (loading || data == null) return;
    if (page > totalPages) setPage(totalPages);
  }, [loading, data, page, totalPages]);
  const rowFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rowTo =
    total === 0 ? 0 : Math.min((page - 1) * pageSize + (data?.content?.length ?? 0), total);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const companies =
    previewDetail?.secondary_sku_company_details ??
    selected?.secondary_sku_company_details ??
    [];
  const labels =
    (previewDetail?.secondary_sku_labels_data as LabelsData | undefined) ??
    selected?.secondary_sku_labels_data;
  const assocCount = Array.isArray(companies)
    ? companies.length
    : (selected?.associated_companies_count ?? 0);

  return (
    <div className="space-y-6">
      <AppPageTitle
        title="Secondary Listings"
        description="Channel SKUs, associated companies, and labels."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(280px,380px)] lg:items-start">
        <Card className="border-primary/10 shadow-sm">
          <CardHeader className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label>Search</Label>
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setPage(1);
                      setKeyword(draft);
                    }
                  }}
                  placeholder="Search secondary_sku, master_sku, inventory_sku…"
                  className="min-h-11 font-mono text-sm"
                />
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-2">
                  <Label htmlFor="secondary-page-size">Rows per page</Label>
                  <select
                    id="secondary-page-size"
                    className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-11 w-[120px] rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  className="min-h-11"
                  onClick={() => {
                    setPage(1);
                    setKeyword(draft);
                  }}
                >
                  Search
                </Button>
              </div>
            </div>
            {!loading && data != null && data.content.length > 0 ? (
              <p className="text-muted-foreground text-sm">
                Showing{" "}
                <span className="text-foreground font-medium tabular-nums">
                  {rowFrom}–{rowTo}
                </span>{" "}
                of{" "}
                <span className="text-foreground font-medium tabular-nums">{total}</span>
                <span className="max-sm:hidden">
                  {" "}
                  · Page{" "}
                  <span className="text-foreground font-medium tabular-nums">{page}</span> of{" "}
                  <span className="text-foreground font-medium tabular-nums">{totalPages}</span>
                </span>
              </p>
            ) : null}
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-64 w-full" /> : null}
            {!loading && (data?.content?.length ?? 0) === 0 ? (
              <EmptyState title="No rows" />
            ) : null}
            {!loading && data != null && data.content.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Secondary SKU</TableHead>
                        <TableHead>Inventory SKU</TableHead>
                        <TableHead>Pack combo SKU</TableHead>
                        <TableHead className="text-right">Companies</TableHead>
                        <TableHead className="text-right">Available</TableHead>
                        <TableHead className="hidden xl:table-cell">Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.content.map((row, i) => (
                        <TableRow
                          key={row.id}
                          data-state={selectedId === row.id ? "selected" : undefined}
                          className={cn(
                            "cursor-pointer",
                            selectedId === row.id && "bg-primary/5"
                          )}
                          onClick={() => setSelectedId(row.id)}
                        >
                          <TableCell className="tabular-nums text-muted-foreground">
                            {(page - 1) * pageSize + i + 1}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{row.secondary_sku}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {row.inventory_sku_id ?? "—"}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {row.pack_combo_sku_id ?? "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {companyCountCell(row)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.effective_available_quantity ??
                              row.available_quantity ??
                              "—"}
                          </TableCell>
                          <TableCell className="hidden xl:table-cell">
                            {row.sku_type ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-muted-foreground flex flex-wrap items-center gap-1 text-sm tabular-nums sm:gap-2">
                    <span className="sm:hidden">
                      Page {page} / {totalPages}
                    </span>
                    <PageJump
                      page={page}
                      totalPages={totalPages}
                      onJump={(p) => setPage(p)}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!canPrev}
                      onClick={() => setPage(1)}
                    >
                      First
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!canPrev}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!canNext}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!canNext}
                      onClick={() => setPage(totalPages)}
                    >
                      Last
                    </Button>
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-primary/10 shadow-sm lg:sticky lg:top-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {selected ? (
              <>
                <div>
                  <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                    Secondary SKU
                  </p>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {selected.secondary_sku}
                  </Badge>
                  {!previewLoading && !previewDetail?.warehouse_secondary_listing ? (
                    <p className="text-muted-foreground mt-2 text-xs">
                      {selected.secondary_sku} is not part of Warehouse listings.
                    </p>
                  ) : null}
                </div>
                <Separator />
                <div>
                  <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                    Master SKU
                  </p>
                  <Badge variant="outline" className="font-mono text-xs">
                    {selected.master_sku ?? "—"}
                  </Badge>
                  {selected.master_sku &&
                  !previewLoading &&
                  !previewDetail?.master_sku_listing ? (
                    <p className="text-muted-foreground mt-2 text-xs">
                      Master SKU: {selected.master_sku} is not part of Warehouse listings.
                    </p>
                  ) : null}
                </div>
                <Separator />
                <div>
                  <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                    Pack &amp; combo SKU
                  </p>
                  <Badge variant="outline" className="font-mono text-xs">
                    {selected.pack_combo_sku_id ?? "—"}
                  </Badge>
                  {selected.pack_combo_sku_id &&
                  selected.pack_combo_sku_id !== "NA" &&
                  !previewLoading &&
                  !previewDetail?.pack_combo_sku_listing ? (
                    <p className="text-muted-foreground mt-2 text-xs">
                      Pack Combo Sku: {selected.pack_combo_sku_id} is not part of Warehouse
                      listings.
                    </p>
                  ) : null}
                </div>
                {selected.pack_combo_sku_id && selected.pack_combo_sku_id !== "NA" ? (
                  <>
                    <Separator />
                    <div>
                      <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                        Pack components
                      </p>
                      {previewLoading ? (
                        <Skeleton className="h-24 w-full" />
                      ) : previewDetail?.pack_combo_components &&
                        previewDetail.pack_combo_components.length > 0 ? (
                        <div className="flex flex-wrap gap-3">
                          {previewDetail.pack_combo_components.map((c, idx) => {
                            const img = listingImageUrl(c.listing);
                            const bins = c.listing?.bins ?? [];
                            return (
                              <div
                                key={`${c.component_sku_id}-${c.id ?? idx}`}
                                className="bg-card flex max-w-[20rem] flex-col gap-2 rounded-lg border p-2 sm:flex-row"
                              >
                                <div className="flex gap-2">
                                  <div className="relative size-16 shrink-0">
                                    {img ? (
                                      <Image
                                        src={img}
                                        alt=""
                                        fill
                                        className="rounded object-cover"
                                        unoptimized
                                      />
                                    ) : (
                                      <div className="bg-muted text-muted-foreground flex size-full items-center justify-center rounded text-[10px]">
                                        N/A
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-xs">
                                    <p className="font-mono font-semibold">
                                      SKU ID: {c.component_sku_id}
                                    </p>
                                    <p className="tabular-nums">
                                      AVAILABLE QUANTITY:{" "}
                                      {c.listing?.available_quantity ?? "—"}
                                    </p>
                                    <p className="tabular-nums">
                                      UNITS CONTRIBUTED: {c.quantity}
                                    </p>
                                  </div>
                                </div>
                                {bins.length > 0 ? (
                                  <div className="border-t pt-2 text-[10px] sm:border-t-0 sm:border-l sm:pt-0 sm:pl-2">
                                    <p className="text-muted-foreground mb-1 font-medium uppercase">
                                      Bins
                                    </p>
                                    <ul className="max-h-28 space-y-0.5 overflow-y-auto font-mono tabular-nums">
                                      {bins.map((b) => (
                                        <li
                                          key={
                                            b.id ??
                                            `${b.warehouse_id ?? ""}-${b.bin_id ?? ""}`
                                          }
                                        >
                                          {b.bin_id ?? "—"} · wh {b.warehouse_id ?? "—"} ·{" "}
                                          {b.available_quantity ?? "—"}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-xs">
                          No pack components in Zap for this combo parent. Sync{" "}
                          <span className="font-mono">pack_combos</span> and warehouse{" "}
                          <span className="font-mono">listings</span> so components resolve with
                          images and stock.
                        </p>
                      )}
                    </div>
                  </>
                ) : null}
                <Separator />
                <div>
                  <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                    Labels data
                  </p>
                  {labelsHaveDisplayableData(labels) ? (
                    <div className="space-y-1.5">
                      {labelLine("EAN CODE", labels?.ean_code)}
                      {labelLine("SIZE", labels?.size)}
                      {labelLine("COLOR", labels?.color)}
                      {labelLine("MRP", labels?.mrp)}
                      {labelLine("MATERIAL", labels?.material)}
                      {labels?.one_set_contains ? (
                        <div className="text-sm">
                          <span className="text-muted-foreground">ONE SET CONTAINS</span>
                          <p className="mt-1 leading-snug font-medium">
                            {String(labels.one_set_contains)}
                          </p>
                        </div>
                      ) : null}
                      {labels &&
                        Object.entries(labels)
                          .filter(([k, v]) => {
                            if (k === "secondary_sku") return false;
                            if (
                              (LABEL_KEYS_ORDER as readonly string[]).includes(
                                k
                              )
                            )
                              return false;
                            return (
                              v != null &&
                              v !== "" &&
                              typeof v !== "object"
                            );
                          })
                          .map(([k, v]) => (
                            <div key={k} className="text-sm">
                              <span className="text-muted-foreground uppercase">
                                {k.replaceAll("_", " ")}
                              </span>
                              <span className="ml-2 font-medium">{String(v)}</span>
                            </div>
                          ))}
                      <Button variant="outline" size="sm" className="mt-2" asChild>
                        <a
                          href={EAUTOMATE_APP_ORIGIN}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Manage in eAutomate
                        </a>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-xs">
                        No labels data available for this secondary SKU.
                      </p>
                      <Button asChild>
                        <a
                          href={EAUTOMATE_APP_ORIGIN}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Create association
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
                <Separator />
                <div>
                  <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                    Associated companies ({assocCount})
                  </p>
                  {companies.length === 0 ? (
                    <p className="text-muted-foreground text-xs">
                      No company mapping found for this secondary SKU.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {companies.map((c, idx) => (
                        <li key={`${c.company_id ?? idx}`} className="rounded-md border p-2 text-xs">
                          <p className="font-medium">{c.company_name ?? "—"}</p>
                          <p className="text-muted-foreground font-mono">
                            id {c.company_id ?? "—"} · {c.company_code_primary ?? "—"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">Select a row in the table.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
