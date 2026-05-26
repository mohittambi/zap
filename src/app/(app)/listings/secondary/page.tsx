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
import { CompanyLogo } from "@/components/company/company-logo";
import { AppPageTitle } from "@/components/layout/app-page-shell";
import { ListingsFilters } from "@/components/listings/listings-filters";
import { ListingsSort } from "@/components/listings/listings-sort";
import type { ListSort, ListStockState } from "@/hooks/use-list-query-state";
import { cn } from "@/lib/utils";
import { skuDisplay, hasRealSku } from "@/lib/sku-display";
import { Pencil, Trash2, Maximize2, ChevronDown, ChevronRight } from "lucide-react";
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

type CompanyDetail = {
  relation_id?: number;
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

type CompanyDropdownRow = {
  id: number;
  name: string | null;
  code_primary: string | null;
};

function labelLine(k: string, v: string | number | null | undefined) {
  const s = v == null || v === "" || v === "NA" ? "—" : String(v);
  return (
    <div className="bg-muted/40 rounded-md border px-3 py-2">
      <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
        {k}
      </p>
      <p className="mt-0.5 text-sm font-medium">{s}</p>
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

/** Renders warehouse listing row from DB when sku_wise_details resolves a listing. */
function WarehouseListingCard({ listing }: { listing: NonNullable<SkuWiseListing> }) {
  const img = listingImageUrl(listing);
  const bins = listing.bins ?? [];
  return (
    <div className="bg-muted/30 mt-2 flex gap-3 rounded-lg border p-3">
      <div className="border-input bg-muted relative size-20 shrink-0 overflow-hidden rounded-md">
        {img ? (
          <Image src={img} alt="" fill className="object-cover" unoptimized />
        ) : (
          <div className="text-muted-foreground flex size-full items-center justify-center px-1 text-center text-[10px]">
            No image
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1 text-xs">
        <p className="truncate font-mono font-semibold">{listing.sku_id ?? "—"}</p>
        <p className="text-muted-foreground tabular-nums">
          Available: {listing.available_quantity ?? "—"}
        </p>
        {listing.description ? (
          <p className="text-muted-foreground line-clamp-4 leading-snug">{listing.description}</p>
        ) : null}
        {bins.length > 0 ? (
          <div className="border-t pt-1.5">
            <p className="text-muted-foreground mb-1 font-medium uppercase tracking-wide">Bins</p>
            <ul className="max-h-24 space-y-0.5 overflow-y-auto font-mono tabular-nums">
              {bins.map((b) => (
                <li
                  key={b.id ?? `${b.warehouse_id ?? ""}-${b.bin_id ?? ""}`}
                >
                  {b.bin_id ?? "—"} · wh {b.warehouse_id ?? "—"} · {b.available_quantity ?? "—"}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
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

/** Treat null, empty, and legacy "NA" sentinel as empty for edit form fields. */
function naToEmpty(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  if (s === "" || s === "NA") return "";
  return s;
}

/** Thin alias kept for call-site readability. */
const skuCell = skuDisplay;

function companyCountCell(row: Row): number | string {
  if (row.associated_companies_count != null) return row.associated_companies_count;
  const d = row.secondary_sku_company_details;
  if (Array.isArray(d)) return d.length;
  return "—";
}

function rowCompaniesCount(row: Row): number {
  if (row.associated_companies_count != null) return Number(row.associated_companies_count);
  const d = row.secondary_sku_company_details;
  if (Array.isArray(d)) return d.length;
  return 0;
}

function rowAvailableQty(row: Row): number {
  const v = row.effective_available_quantity ?? row.available_quantity;
  return v != null && Number.isFinite(Number(v)) ? Number(v) : 0;
}

type SortKey =
  | "secondary_sku"
  | "inventory_sku_id"
  | "pack_combo_sku_id"
  | "associated_companies_count"
  | "available_quantity"
  | "sku_type";

type SortDir = "asc" | "desc";

function sortRowValue(row: Row, key: SortKey): string | number {
  switch (key) {
    case "secondary_sku":
      return row.secondary_sku ?? "";
    case "inventory_sku_id":
      return String(row.inventory_sku_id ?? "");
    case "pack_combo_sku_id":
      return String(row.pack_combo_sku_id ?? "");
    case "associated_companies_count":
      return rowCompaniesCount(row);
    case "available_quantity":
      return rowAvailableQty(row);
    case "sku_type":
      return String(row.sku_type ?? "");
    default:
      return "";
  }
}

function SortableHead({
  label,
  col,
  sortKey,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  col: SortKey;
  sortKey: SortKey | null;
  sortDir: SortDir;
  onSort: (col: SortKey) => void;
  className?: string;
}) {
  const active = sortKey === col;
  return (
    <TableHead
      className={cn(
        "cursor-pointer select-none whitespace-nowrap",
        className
      )}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="text-muted-foreground text-xs">
          {active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </span>
    </TableHead>
  );
}

type PaginatedRows = {
  total: number;
  current_page?: number;
  per_page_count?: number;
  curr_page_count?: number;
  content: Row[];
};

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 500, 1000, 2000] as const;

const PREVIEW_SIDEBAR_LS_KEY = "secondary_listings_preview_sidebar_width";
const PREVIEW_SIDEBAR_MIN = 260;

function clampPreviewSidebarWidth(px: number, windowWidth: number): number {
  const max = Math.min(560, Math.floor(0.5 * Math.max(320, windowWidth)));
  return Math.min(max, Math.max(PREVIEW_SIDEBAR_MIN, Math.round(px)));
}

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
  const [serverCategory, setServerCategory] = React.useState<string | null>(null);
  const [serverStockState, setServerStockState] = React.useState<ListStockState | null>(null);
  const [serverTagIds, setServerTagIds] = React.useState<number[]>([]);
  const [serverSort, setServerSort] = React.useState<ListSort>("sku_asc");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(2000);
  const [data, setData] = React.useState<PaginatedRows | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [previewDetail, setPreviewDetail] = React.useState<SkuWisePreview | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewRefresh, setPreviewRefresh] = React.useState(0);

  const [associateOpen, setAssociateOpen] = React.useState(false);
  const [companyOptions, setCompanyOptions] = React.useState<CompanyDropdownRow[]>([]);
  const [companyListLoading, setCompanyListLoading] = React.useState(false);
  const [assocCompanyId, setAssocCompanyId] = React.useState("");
  const [assocCode, setAssocCode] = React.useState("");
  const [associateSubmitting, setAssociateSubmitting] = React.useState(false);

  const [editTarget, setEditTarget] = React.useState<{
    company_id: number;
    secondary_sku: string;
    company_name: string;
    company_code_primary: string;
  } | null>(null);
  const [editCode, setEditCode] = React.useState("");
  const [editSubmitting, setEditSubmitting] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<{
    company_id: number;
    secondary_sku: string;
    company_name: string;
  } | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = React.useState(false);

  const [editLabelsOpen, setEditLabelsOpen] = React.useState(false);
  const [editLabelsEan, setEditLabelsEan] = React.useState("");
  const [editLabelsSize, setEditLabelsSize] = React.useState("");
  const [editLabelsColor, setEditLabelsColor] = React.useState("");
  const [editLabelsOneSet, setEditLabelsOneSet] = React.useState("");
  const [editLabelsMrp, setEditLabelsMrp] = React.useState("");
  const [editLabelsMaterial, setEditLabelsMaterial] = React.useState("");
  const [editLabelsSubmitting, setEditLabelsSubmitting] = React.useState(false);

  const [canEdit, setCanEdit] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [historyLogs, setHistoryLogs] = React.useState<Record<string, unknown>[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [expandViewOpen, setExpandViewOpen] = React.useState(false);

  const [sortKey, setSortKey] = React.useState<SortKey | null>(null);
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");
  const [filterSecondary, setFilterSecondary] = React.useState("");
  const [filterInventory, setFilterInventory] = React.useState("");
  const [filterPackCombo, setFilterPackCombo] = React.useState("");
  const [filterCompanies, setFilterCompanies] = React.useState("");
  const [filterAvailable, setFilterAvailable] = React.useState("");
  const [filterType, setFilterType] = React.useState<"" | "SINGLE" | "MULTI">("");

  const [sidebarWidthPx, setSidebarWidthPx] = React.useState(380);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(PREVIEW_SIDEBAR_LS_KEY);
      if (raw == null) return;
      const n = Number.parseInt(raw, 10);
      if (Number.isNaN(n)) return;
      setSidebarWidthPx(clampPreviewSidebarWidth(n, window.innerWidth));
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    const onResize = () => {
      setSidebarWidthPx((w) => clampPreviewSidebarWidth(w, window.innerWidth));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const dragStartX = React.useRef(0);
  const dragStartWidth = React.useRef(380);

  const handleSidebarDragStart = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragStartX.current = e.clientX;
      dragStartWidth.current = sidebarWidthPx;

      document.body.classList.add("cursor-col-resize", "select-none");
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (ev: MouseEvent) => {
        const delta = dragStartX.current - ev.clientX;
        const next = clampPreviewSidebarWidth(
          dragStartWidth.current + delta,
          window.innerWidth
        );
        setSidebarWidthPx(next);
      };

      const onUp = () => {
        document.body.classList.remove("cursor-col-resize", "select-none");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";

        setSidebarWidthPx((w) => {
          try {
            localStorage.setItem(PREVIEW_SIDEBAR_LS_KEY, String(w));
          } catch {
            /* ignore */
          }
          return w;
        });
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [sidebarWidthPx]
  );

  const resetColumnFilters = React.useCallback(() => {
    setFilterSecondary("");
    setFilterInventory("");
    setFilterPackCombo("");
    setFilterCompanies("");
    setFilterAvailable("");
    setFilterType("");
  }, []);

  const handleSort = React.useCallback((col: SortKey) => {
    setSortKey((prevKey) => {
      if (prevKey === col) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prevKey;
      }
      setSortDir("asc");
      return col;
    });
  }, []);

  const bumpPreview = React.useCallback(() => {
    setPreviewRefresh((n) => n + 1);
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        page: String(page),
        count: String(pageSize),
      });
      if (keyword.trim()) q.set("search_keyword", keyword.trim());
      if (serverCategory) q.set("category", serverCategory);
      if (serverStockState) q.set("stock_state", serverStockState);
      if (serverTagIds.length) q.set("tag_ids", serverTagIds.join(","));
      q.set("sort", serverSort);
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
  }, [keyword, page, pageSize, serverCategory, serverStockState, serverTagIds, serverSort]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const selected = data?.content?.find((r) => r.id === selectedId) ?? null;

  const displayRows = React.useMemo(() => {
    let rows = data?.content ?? [];

    if (filterSecondary.trim()) {
      const q = filterSecondary.toLowerCase();
      rows = rows.filter((r) =>
        (r.secondary_sku ?? "").toLowerCase().includes(q)
      );
    }
    if (filterInventory.trim()) {
      const q = filterInventory.toLowerCase();
      rows = rows.filter((r) =>
        String(r.inventory_sku_id ?? "").toLowerCase().includes(q)
      );
    }
    if (filterPackCombo.trim()) {
      const q = filterPackCombo.toLowerCase();
      rows = rows.filter((r) =>
        String(r.pack_combo_sku_id ?? "").toLowerCase().includes(q)
      );
    }
    if (filterCompanies.trim()) {
      const min = Number(filterCompanies);
      if (!Number.isNaN(min)) {
        rows = rows.filter((r) => rowCompaniesCount(r) >= min);
      }
    }
    if (filterAvailable.trim()) {
      const min = Number(filterAvailable);
      if (!Number.isNaN(min)) {
        rows = rows.filter((r) => rowAvailableQty(r) >= min);
      }
    }
    if (filterType) {
      rows = rows.filter((r) => r.sku_type === filterType);
    }

    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const av = sortRowValue(a, sortKey);
        const bv = sortRowValue(b, sortKey);
        const cmp =
          typeof av === "number" && typeof bv === "number"
            ? av - bv
            : String(av).localeCompare(String(bv), undefined, { sensitivity: "base" });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return rows;
  }, [
    data?.content,
    sortKey,
    sortDir,
    filterSecondary,
    filterInventory,
    filterPackCombo,
    filterCompanies,
    filterAvailable,
    filterType,
  ]);

  React.useEffect(() => {
    void apiFetch<{ allowed: boolean }>("/api/auth/can?resource=secondary_listings&action=manage")
      .then((r) => setCanEdit(r.allowed))
      .catch(() => setCanEdit(false));
  }, []);

  React.useEffect(() => {
    setHistoryOpen(false);
    setHistoryLogs([]);
  }, [selected?.secondary_sku]);

  React.useEffect(() => {
    if ((!historyOpen && !expandViewOpen) || !selected?.secondary_sku) return;
    setHistoryLoading(true);
    void apiFetch<{ logs: Record<string, unknown>[] }>(
      `/api/inventory/secondary_listings/logs?secondary_sku=${encodeURIComponent(selected.secondary_sku)}`
    )
      .then((r) => setHistoryLogs(r.logs ?? []))
      .catch(() => setHistoryLogs([]))
      .finally(() => setHistoryLoading(false));
  }, [historyOpen, expandViewOpen, selected?.secondary_sku]);

  React.useEffect(() => {
    const sku = selected?.secondary_sku;
    if (!sku) {
      setPreviewDetail(null);
      setPreviewLoading(false);
      return;
    }
    const ac = new AbortController();
    setPreviewLoading(true);
    setPreviewDetail(null);
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
  }, [selected?.secondary_sku, previewRefresh]);

  React.useEffect(() => {
    if (!associateOpen) return;
    let cancelled = false;
    setCompanyListLoading(true);
    void (async () => {
      try {
        const res = await apiFetch<{ content: CompanyDropdownRow[] }>(
          "/api/inventory/secondary_listings/companies/list"
        );
        if (!cancelled) setCompanyOptions(res.content ?? []);
      } catch (e) {
        if (!cancelled)
          toast.error(e instanceof Error ? e.message : "Failed to load companies");
      } finally {
        if (!cancelled) setCompanyListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [associateOpen]);

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
      <div
        className="grid grid-cols-1 gap-6 lg:items-start lg:[grid-template-columns:1fr_var(--preview-sidebar-w,380px)]"
        style={
          {
            ["--preview-sidebar-w"]: `${sidebarWidthPx}px`,
          } as React.CSSProperties
        }
      >
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
                      resetColumnFilters();
                    }
                  }}
                  placeholder="Search secondary_sku, master_sku, inventory_sku, pack_combo_sku…"
                  className="min-h-11 font-mono text-sm"
                />
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-2">
                  <Label htmlFor="secondary-page-size">Rows per page</Label>
                  <select
                    id="secondary-page-size"
                    className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-11 w-[130px] rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
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
                    resetColumnFilters();
                  }}
                >
                  Search
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
              <ListingsFilters
                state={{
                  search: keyword,
                  category: serverCategory,
                  stockState: serverStockState,
                  tagIds: serverTagIds,
                  skuType: null,
                  sort: serverSort,
                  page: 1,
                }}
                onChange={(patch) => {
                  if (patch.category !== undefined) setServerCategory(patch.category);
                  if (patch.stockState !== undefined) setServerStockState(patch.stockState);
                  if (patch.tagIds !== undefined) setServerTagIds(patch.tagIds);
                  setPage(1);
                }}
                onClearAll={() => {
                  setServerCategory(null);
                  setServerStockState(null);
                  setServerTagIds([]);
                  setPage(1);
                }}
              />
              <ListingsSort
                value={serverSort}
                onChange={(v) => {
                  setServerSort(v);
                  setPage(1);
                }}
              />
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
            <>
              {null /* loading skeleton rows are now inside TableBody */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="w-10">#</TableHead>
                        <SortableHead
                          label="Secondary SKU"
                          col="secondary_sku"
                          sortKey={sortKey}
                          sortDir={sortDir}
                          onSort={handleSort}
                        />
                        <SortableHead
                          label="Inventory SKU"
                          col="inventory_sku_id"
                          sortKey={sortKey}
                          sortDir={sortDir}
                          onSort={handleSort}
                        />
                        <SortableHead
                          label="Pack combo SKU"
                          col="pack_combo_sku_id"
                          sortKey={sortKey}
                          sortDir={sortDir}
                          onSort={handleSort}
                        />
                        <SortableHead
                          label="Companies"
                          col="associated_companies_count"
                          sortKey={sortKey}
                          sortDir={sortDir}
                          onSort={handleSort}
                          className="text-right"
                        />
                        <SortableHead
                          label="Available"
                          col="available_quantity"
                          sortKey={sortKey}
                          sortDir={sortDir}
                          onSort={handleSort}
                          className="text-right"
                        />
                        <SortableHead
                          label="Type"
                          col="sku_type"
                          sortKey={sortKey}
                          sortDir={sortDir}
                          onSort={handleSort}
                          className="hidden xl:table-cell"
                        />
                      </TableRow>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="p-1" />
                        <TableHead className="p-1">
                          <Input
                            placeholder="Filter…"
                            value={filterSecondary}
                            onChange={(e) => setFilterSecondary(e.target.value)}
                            className="h-7 min-w-0 text-xs font-mono"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </TableHead>
                        <TableHead className="p-1">
                          <Input
                            placeholder="Filter…"
                            value={filterInventory}
                            onChange={(e) => setFilterInventory(e.target.value)}
                            className="h-7 min-w-0 text-xs font-mono"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </TableHead>
                        <TableHead className="p-1">
                          <Input
                            placeholder="Filter…"
                            value={filterPackCombo}
                            onChange={(e) => setFilterPackCombo(e.target.value)}
                            className="h-7 min-w-0 text-xs font-mono"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </TableHead>
                        <TableHead className="p-1">
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="≥"
                            value={filterCompanies}
                            onChange={(e) =>
                              setFilterCompanies(e.target.value.replace(/[^\d.-]/g, ""))
                            }
                            className="h-7 w-full min-w-[3.5rem] text-right text-xs tabular-nums"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </TableHead>
                        <TableHead className="p-1">
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="≥"
                            value={filterAvailable}
                            onChange={(e) =>
                              setFilterAvailable(e.target.value.replace(/[^\d.-]/g, ""))
                            }
                            className="h-7 w-full min-w-[3.5rem] text-right text-xs tabular-nums"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </TableHead>
                        <TableHead className="hidden p-1 xl:table-cell">
                          <select
                            value={filterType}
                            onChange={(e) =>
                              setFilterType(
                                e.target.value as "" | "SINGLE" | "MULTI"
                              )
                            }
                            className="border-input bg-background h-7 w-full min-w-[4.5rem] rounded-md border px-1 text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="">All</option>
                            <option value="SINGLE">SINGLE</option>
                            <option value="MULTI">MULTI</option>
                          </select>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading
                        ? Array.from({ length: 6 }).map((_, i) => (
                            <TableRow key={i}>
                              {[1, 2, 3, 4, 5, 6, 7].map((j) => (
                                <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                              ))}
                            </TableRow>
                          ))
                        : displayRows.length === 0
                        ? (
                          <TableRow>
                            <TableCell
                              colSpan={7}
                              className="text-muted-foreground h-16 text-center text-sm"
                            >
                              No rows match the current filters.
                            </TableCell>
                          </TableRow>
                        )
                        : displayRows.map((row, i) => {
                          const pageContent = data?.content ?? [];
                          const idxInPage = pageContent.findIndex(
                            (r) => r.id === row.id
                          );
                          const srNo =
                            idxInPage >= 0
                              ? (page - 1) * pageSize + idxInPage + 1
                              : (page - 1) * pageSize + i + 1;
                          return (
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
                                {srNo}
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {row.secondary_sku}
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {skuCell(row.inventory_sku_id)}
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {skuCell(row.pack_combo_sku_id)}
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
                          );
                        })}
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
          </CardContent>
        </Card>

        <div className="relative flex w-full flex-col lg:sticky lg:top-4 lg:max-h-[calc(100dvh-9rem)] lg:min-h-0 lg:self-start">
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize preview panel"
            title="Drag to resize"
            onMouseDown={handleSidebarDragStart}
            className="group absolute top-0 left-0 z-10 hidden h-full w-3 -translate-x-1/2 cursor-col-resize items-center justify-center lg:flex"
            style={{ touchAction: "none" }}
          >
            <div className="bg-border group-hover:bg-primary h-12 w-1 rounded-full transition-colors" />
          </div>
          <Card className="border-primary/10 shadow-sm flex min-h-0 flex-col overflow-hidden lg:max-h-full lg:flex-1">
            <CardHeader className="shrink-0 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Preview</CardTitle>
                {selected ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground size-8 shrink-0"
                    title="Expand view"
                    onClick={() => setExpandViewOpen(true)}
                  >
                    <Maximize2 className="size-4" />
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col space-y-4 overflow-y-auto text-sm">
            {selected ? (
              <>
                <div>
                  <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                    Secondary SKU
                  </p>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {selected.secondary_sku}
                  </Badge>
                  {previewLoading ? (
                    <Skeleton className="mt-2 h-24 w-full" />
                  ) : previewDetail?.warehouse_secondary_listing ? (
                    <WarehouseListingCard
                      listing={previewDetail.warehouse_secondary_listing}
                    />
                  ) : (
                    <p className="text-muted-foreground mt-2 text-xs">
                      {selected.secondary_sku} is not part of Warehouse listings.
                    </p>
                  )}
                </div>
                <Separator />
                <div>
                  <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                    Master SKU
                  </p>
                  <Badge variant="outline" className="font-mono text-xs">
                    {skuCell(selected.master_sku)}
                  </Badge>
                  {previewLoading ? (
                    <Skeleton className="mt-2 h-24 w-full" />
                  ) : hasRealSku(selected.master_sku) && previewDetail?.master_sku_listing ? (
                    <WarehouseListingCard listing={previewDetail.master_sku_listing} />
                  ) : hasRealSku(selected.master_sku) ? (
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
                    {skuCell(selected.pack_combo_sku_id)}
                  </Badge>
                  {previewLoading ? (
                    <Skeleton className="mt-2 h-24 w-full" />
                  ) : hasRealSku(selected.pack_combo_sku_id) &&
                    previewDetail?.pack_combo_sku_listing ? (
                    <WarehouseListingCard listing={previewDetail.pack_combo_sku_listing} />
                  ) : hasRealSku(selected.pack_combo_sku_id) ? (
                    <p className="text-muted-foreground mt-2 text-xs">
                      Pack Combo Sku: {selected.pack_combo_sku_id} is not part of Warehouse
                      listings.
                    </p>
                  ) : null}
                </div>
                {hasRealSku(selected.pack_combo_sku_id) ? (
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
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                      Labels data
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground size-8 shrink-0"
                      title="Labels association"
                      disabled={!selected.secondary_sku || !canEdit}
                      onClick={() => {
                        setEditLabelsEan(naToEmpty(labels?.ean_code));
                        setEditLabelsSize(naToEmpty(labels?.size));
                        setEditLabelsColor(naToEmpty(labels?.color));
                        setEditLabelsOneSet(naToEmpty(labels?.one_set_contains));
                        setEditLabelsMrp(naToEmpty(labels?.mrp));
                        setEditLabelsMaterial(naToEmpty(labels?.material));
                        setEditLabelsOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </div>
                  {labelsHaveDisplayableData(labels) ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        {labelLine("EAN CODE", labels?.ean_code)}
                        {labelLine("MRP", labels?.mrp)}
                        {labelLine("SIZE", labels?.size)}
                        {labelLine("COLOR", labels?.color)}
                        {labelLine("MATERIAL", labels?.material)}
                      </div>
                      {labels?.one_set_contains &&
                      labels.one_set_contains !== "NA" ? (
                        <div className="bg-muted/40 rounded-md border px-3 py-2">
                          <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                            One Set Contains
                          </p>
                          <p className="mt-0.5 text-sm font-medium leading-snug">
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
                              v !== "NA" &&
                              typeof v !== "object"
                            );
                          })
                          .map(([k, v]) => (
                            <div
                              key={k}
                              className="bg-muted/40 rounded-md border px-3 py-2"
                            >
                              <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                                {k.replaceAll("_", " ")}
                              </p>
                              <p className="mt-0.5 text-sm font-medium">
                                {String(v)}
                              </p>
                            </div>
                          ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-xs">
                        No labels data available for this secondary SKU.
                      </p>
                      <Button
                        size="sm"
                        disabled={!selected?.secondary_sku || !canEdit}
                        onClick={() => {
                          setEditLabelsEan("");
                          setEditLabelsSize("");
                          setEditLabelsColor("");
                          setEditLabelsOneSet("");
                          setEditLabelsMrp("");
                          setEditLabelsMaterial("");
                          setEditLabelsOpen(true);
                        }}
                      >
                        Add Labels
                      </Button>
                    </div>
                  )}
                </div>
                <Separator />
                <div>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                      Associated companies ({assocCount})
                    </p>
                    {canEdit ? (
                      <Button
                        type="button"
                        size="sm"
                        className="shrink-0"
                        disabled={!selected.secondary_sku}
                        onClick={() => {
                          setAssocCompanyId("");
                          setAssocCode("");
                          setAssociateOpen(true);
                        }}
                      >
                        Associate New
                      </Button>
                    ) : null}
                  </div>
                  {companies.length === 0 ? (
                    <p className="text-muted-foreground text-xs">
                      No company mapping found for this secondary SKU.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {companies.map((c, idx) => {
                        const rk =
                          c.relation_id ??
                          `${c.company_id ?? "c"}-${c.company_code_primary ?? idx}`;
                        return (
                          <li
                            key={rk}
                            className="flex items-start justify-between gap-2 rounded-md border p-2 text-xs"
                          >
                            <div className="flex min-w-0 flex-1 gap-2">
                              <CompanyLogo
                                name={c.company_name}
                                seed={c.company_id ?? undefined}
                                size={36}
                                className="size-9 shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="font-medium">{c.company_name ?? "—"}</p>
                                <p className="text-muted-foreground font-mono">
                                  id {c.company_id ?? "—"} · {c.company_code_primary ?? "—"}
                                </p>
                              </div>
                            </div>
                            {c.company_id != null && canEdit ? (
                              <div className="flex shrink-0 gap-0.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="text-muted-foreground size-8"
                                  title="Edit company code"
                                  onClick={() => {
                                    setEditCode(String(c.company_code_primary ?? ""));
                                    setEditTarget({
                                      company_id: Number(c.company_id),
                                      secondary_sku: selected?.secondary_sku ?? "",
                                      company_name: String(c.company_name ?? ""),
                                      company_code_primary: String(
                                        c.company_code_primary ?? ""
                                      ),
                                    });
                                  }}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="text-muted-foreground hover:text-destructive size-8"
                                  title="Remove association"
                                  onClick={() => {
                                    setDeleteTarget({
                                      company_id: Number(c.company_id),
                                      secondary_sku: selected?.secondary_sku ?? "",
                                      company_name: String(c.company_name ?? ""),
                                    });
                                  }}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <Separator />
                <div>
                  <button
                    type="button"
                    className="text-muted-foreground flex w-full items-center gap-1 text-left text-xs font-medium uppercase tracking-wide"
                    onClick={() => setHistoryOpen((o) => !o)}
                  >
                    {historyOpen ? (
                      <ChevronDown className="size-3.5 shrink-0" />
                    ) : (
                      <ChevronRight className="size-3.5 shrink-0" />
                    )}
                    Change history
                  </button>
                  {historyOpen ? (
                    historyLoading ? (
                      <Skeleton className="mt-2 h-16 w-full" />
                    ) : historyLogs.length === 0 ? (
                      <p className="text-muted-foreground mt-2 text-xs">No history found.</p>
                    ) : (
                      <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                        {historyLogs.map((log) => (
                          <li
                            key={String(log.id)}
                            className="rounded-md border p-2 text-xs space-y-0.5"
                          >
                            <p className="font-medium">{String(log.operation ?? "")}</p>
                            {log.field_name ? (
                              <p className="text-muted-foreground">Field: {String(log.field_name)}</p>
                            ) : null}
                            {log.old_value != null ? (
                              <p className="text-muted-foreground font-mono truncate">
                                Old: {JSON.stringify(log.old_value)}
                              </p>
                            ) : null}
                            {log.new_value != null ? (
                              <p className="font-mono truncate">
                                New: {JSON.stringify(log.new_value)}
                              </p>
                            ) : null}
                            <p className="text-muted-foreground">
                              {String(log.created_by ?? "")} ·{" "}
                              {log.created_at
                                ? new Date(String(log.created_at)).toLocaleString("en-IN", {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  })
                                : "—"}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )
                  ) : null}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">Select a row in the table.</p>
            )}
          </CardContent>
          </Card>
        </div>
      </div>

      {/* Expand view: full-screen modal with sidebar content at wider layout */}
      <Dialog open={expandViewOpen} onOpenChange={setExpandViewOpen}>
        <DialogContent className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">
              {selected?.secondary_sku ?? "Preview"}
            </DialogTitle>
          </DialogHeader>
          {selected && previewDetail ? (
            <div className="space-y-4 text-sm">
              {previewDetail.warehouse_secondary_listing ? (
                <WarehouseListingCard listing={previewDetail.warehouse_secondary_listing} />
              ) : null}
              <Separator />
              <div>
                <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">Labels</p>
                {labelsHaveDisplayableData(labels) ? (
                  <div className="grid grid-cols-3 gap-2">
                    {LABEL_KEYS_ORDER.map((k) => labelLine(k.replaceAll("_", " ").toUpperCase(), labels?.[k]))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-xs">No labels data.</p>
                )}
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                  Associated companies ({companies.length})
                </p>
                {companies.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No company mapping.</p>
                ) : (
                  <ul className="space-y-2">
                    {companies.map((c, idx) => (
                      <li
                        key={c.relation_id ?? `${c.company_id ?? "c"}-${idx}`}
                        className="rounded-md border p-2 text-xs"
                      >
                        <p className="font-medium">{c.company_name ?? "—"}</p>
                        <p className="text-muted-foreground font-mono">
                          id {c.company_id ?? "—"} · {c.company_code_primary ?? "—"}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                  Change history
                </p>
                {historyLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : historyLogs.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No history found.</p>
                ) : (
                  <ul className="space-y-2">
                    {historyLogs.map((log) => (
                      <li key={String(log.id)} className="rounded-md border p-2 text-xs space-y-0.5">
                        <p className="font-medium">{String(log.operation ?? "")}</p>
                        {log.field_name ? (
                          <p className="text-muted-foreground">Field: {String(log.field_name)}</p>
                        ) : null}
                        {log.old_value != null ? (
                          <p className="text-muted-foreground font-mono truncate">
                            Old: {JSON.stringify(log.old_value)}
                          </p>
                        ) : null}
                        {log.new_value != null ? (
                          <p className="font-mono truncate">New: {JSON.stringify(log.new_value)}</p>
                        ) : null}
                        <p className="text-muted-foreground">
                          {String(log.created_by ?? "")} ·{" "}
                          {log.created_at
                            ? new Date(String(log.created_at)).toLocaleString("en-IN", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })
                            : "—"}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Loading…</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={associateOpen}
        onOpenChange={(open) => {
          setAssociateOpen(open);
          if (!open) {
            setAssocCompanyId("");
            setAssocCode("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Associate New Company</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="assoc-secondary-sku">
                Secondary SKU<span className="text-destructive">*</span>
              </Label>
              <Input
                id="assoc-secondary-sku"
                readOnly
                disabled
                className="bg-muted/50 font-mono"
                value={selected?.secondary_sku ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assoc-company">
                Company<span className="text-destructive">*</span>
              </Label>
              <select
                id="assoc-company"
                disabled={companyListLoading}
                className="border-input bg-muted/30 flex h-11 w-full rounded-md border px-3 py-2 font-sans text-sm"
                value={assocCompanyId}
                onChange={(e) => {
                  const v = e.target.value;
                  setAssocCompanyId(v);
                  const opt = companyOptions.find((o) => String(o.id) === v);
                  setAssocCode(opt?.code_primary ?? "");
                }}
              >
                <option value="">
                  {companyListLoading ? "Loading…" : "Select company"}
                </option>
                {companyOptions.map((o) => (
                  <option key={o.id} value={String(o.id)}>
                    {o.name ?? `Company ${o.id}`} [{o.id}]
                  </option>
                ))}
              </select>
              <p className="text-muted-foreground text-xs">
                Selected:{" "}
                {companyOptions.find((o) => String(o.id) === assocCompanyId)?.name ?? "—"}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assoc-code">
                Company Code Primary<span className="text-destructive">*</span>
              </Label>
              <Input
                id="assoc-code"
                className="font-mono"
                value={assocCode}
                onChange={(e) => setAssocCode(e.target.value)}
                placeholder="e.g. marketplace listing id"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAssociateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={associateSubmitting || !selected?.secondary_sku}
              onClick={() => {
                void (async () => {
                  if (!selected?.secondary_sku) return;
                  const company_id = Number(assocCompanyId);
                  const company_code_primary = assocCode.trim();
                  if (!Number.isFinite(company_id) || company_id <= 0) {
                    toast.error("Select a company");
                    return;
                  }
                  if (!company_code_primary) {
                    toast.error("Company Code Primary is required");
                    return;
                  }
                  setAssociateSubmitting(true);
                  try {
                    await apiFetch("/api/inventory/secondary_listings/companies", {
                      method: "POST",
                      body: JSON.stringify({
                        secondary_sku: selected.secondary_sku,
                        company_id,
                        company_code_primary,
                      }),
                    });
                    toast.success("Company associated");
                    setAssociateOpen(false);
                    setAssocCompanyId("");
                    setAssocCode("");
                    bumpPreview();
                    void load();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Failed");
                  } finally {
                    setAssociateSubmitting(false);
                  }
                })();
              }}
            >
              {associateSubmitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modify Association</DialogTitle>
          </DialogHeader>
          {editTarget ? (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="edit-secondary-sku">
                  Secondary SKU<span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-secondary-sku"
                  readOnly
                  disabled
                  className="bg-muted/50 font-mono"
                  value={editTarget.secondary_sku}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-company-display">
                  Company<span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-company-display"
                  readOnly
                  disabled
                  className="bg-muted/50 font-mono"
                  value={`${editTarget.company_name} [${editTarget.company_id}]`}
                />
                <p className="text-muted-foreground text-xs">
                  Selected: {editTarget.company_name}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-code">
                  Company Code Primary<span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-code"
                  className="font-mono"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={editSubmitting || !editTarget}
              onClick={() => {
                void (async () => {
                  if (!editTarget) return;
                  const company_code_primary = editCode.trim();
                  if (!company_code_primary) {
                    toast.error("Company Code Primary is required");
                    return;
                  }
                  setEditSubmitting(true);
                  try {
                    await apiFetch(
                      `/api/inventory/secondary_listings/companies`,
                      {
                        method: "PATCH",
                        body: JSON.stringify({
                          secondary_sku: editTarget.secondary_sku,
                          company_id: editTarget.company_id,
                          company_code_primary,
                        }),
                      }
                    );
                    toast.success("Association updated");
                    setEditTarget(null);
                    bumpPreview();
                    void load();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Failed");
                  } finally {
                    setEditSubmitting(false);
                  }
                })();
              }}
            >
              {editSubmitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editLabelsOpen}
        onOpenChange={(open) => {
          setEditLabelsOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Labels Association</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto py-2">
            <div className="space-y-2">
              <Label htmlFor="el-secondary-sku">
                Secondary SKU<span className="text-destructive">*</span>
              </Label>
              <Input
                id="el-secondary-sku"
                readOnly
                className="border-input bg-muted font-mono text-muted-foreground cursor-default focus-visible:ring-0 focus-visible:border-input"
                value={selected?.secondary_sku ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="el-ean">EAN Code</Label>
              <Input
                id="el-ean"
                className="font-mono"
                value={editLabelsEan}
                onChange={(e) => setEditLabelsEan(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="el-size">
                Size<span className="text-destructive">*</span>
              </Label>
              <Input
                id="el-size"
                value={editLabelsSize}
                onChange={(e) => setEditLabelsSize(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="el-color">
                Color<span className="text-destructive">*</span>
              </Label>
              <Input
                id="el-color"
                value={editLabelsColor}
                onChange={(e) => setEditLabelsColor(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="el-one-set">
                One Set Contains<span className="text-destructive">*</span>
              </Label>
              <textarea
                id="el-one-set"
                value={editLabelsOneSet}
                onChange={(e) => setEditLabelsOneSet(e.target.value)}
                className={cn(
                  "border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring",
                  "flex min-h-[100px] w-full rounded-md border px-3 py-2 text-sm shadow-sm",
                  "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="el-mrp">
                MRP<span className="text-destructive">*</span>
              </Label>
              <Input
                id="el-mrp"
                type="text"
                inputMode="decimal"
                className="tabular-nums"
                value={editLabelsMrp}
                onChange={(e) => setEditLabelsMrp(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="el-material">
                Material<span className="text-destructive">*</span>
              </Label>
              <Input
                id="el-material"
                value={editLabelsMaterial}
                onChange={(e) => setEditLabelsMaterial(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditLabelsOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={editLabelsSubmitting || !selected?.secondary_sku}
              onClick={() => {
                void (async () => {
                  if (!selected?.secondary_sku) return;
                  const size = editLabelsSize.trim();
                  const color = editLabelsColor.trim();
                  const one_set_contains = editLabelsOneSet.trim();
                  const material = editLabelsMaterial.trim();
                  const mrpStr = editLabelsMrp.trim();
                  if (!size) {
                    toast.error("Size is required");
                    return;
                  }
                  if (!color) {
                    toast.error("Color is required");
                    return;
                  }
                  if (!one_set_contains) {
                    toast.error("One Set Contains is required");
                    return;
                  }
                  if (!mrpStr) {
                    toast.error("MRP is required");
                    return;
                  }
                  const mrp = Number(mrpStr);
                  if (!Number.isFinite(mrp)) {
                    toast.error("MRP must be a valid number");
                    return;
                  }
                  if (!material) {
                    toast.error("Material is required");
                    return;
                  }
                  setEditLabelsSubmitting(true);
                  try {
                    await apiFetch("/api/inventory/secondary_listings/labels", {
                      method: "PATCH",
                      body: JSON.stringify({
                        secondary_sku: selected.secondary_sku,
                        ean_code: editLabelsEan.trim(),
                        size,
                        color,
                        one_set_contains,
                        mrp,
                        material,
                      }),
                    });
                    toast.success("Labels updated");
                    setEditLabelsOpen(false);
                    bumpPreview();
                    void load();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Failed");
                  } finally {
                    setEditLabelsSubmitting(false);
                  }
                })();
              }}
            >
              {editLabelsSubmitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove company association?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Remove "${deleteTarget.company_name}" from this secondary SKU?`
                : "This removes the link between this secondary SKU and this company channel."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteSubmitting}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteSubmitting}
              onClick={() => {
                void (async () => {
                  if (!deleteTarget) return;
                  setDeleteSubmitting(true);
                  try {
                    await apiFetch(
                      `/api/inventory/secondary_listings/companies`,
                      {
                        method: "DELETE",
                        body: JSON.stringify({
                          secondary_sku: deleteTarget.secondary_sku,
                          company_id: deleteTarget.company_id,
                        }),
                      }
                    );
                    toast.success("Association removed");
                    setDeleteTarget(null);
                    bumpPreview();
                    void load();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Failed");
                  } finally {
                    setDeleteSubmitting(false);
                  }
                })();
              }}
            >
              {deleteSubmitting ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
