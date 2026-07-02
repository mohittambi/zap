"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ChevronsUpDown, Loader2 } from "lucide-react";
import { apiFetch, apiUrl, getStoredToken } from "@/lib/api-browser";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CompanyNameWithLogo } from "@/components/company/company-logo";
import { StatusPill } from "@/components/ui/status-pill";
import { FillRateBar } from "@/components/ui/fill-rate-bar";
import { MultiSelect } from "@/components/ui/multi-select";
import { OUTBOUND_PO_TYPES } from "@/lib/outbound-po-types";
import { cn } from "@/lib/utils";

type Analytics = {
  sku_count?: number;
  total_demand?: number;
  total_pending?: number;
  total_dispatched?: number;
  total_packed?: number;
  boxes_dispatched?: number;
  boxes_packed?: number;
  total_consignments?: number;
  sku_fill_rate?: number;
  quantity_fill_rate?: number;
};

export type OutboundPo = {
  id: number;
  po_number: string;
  po_type: string | null;
  company_name: string | null;
  delivery_city: string | null;
  calculated_po_status: string | null;
  is_wip: string | null;
  remarks: string | null;
  po_issue_date: string | null;
  expiry_date: string | null;
  created_at: string | null;
  created_by: string | null;
  analytics_object: Analytics;
};

type Paginated = {
  total: number;
  current_page: number;
  per_page_count: number;
  curr_page_count: number;
  content: OutboundPo[];
};

type FilterCompanyOption = {
  id: number;
  name: string | null;
};

type FilterDeliveryLocationOption = {
  id: number;
  name: string;
};

type FilterOptionsPayload = {
  companies: FilterCompanyOption[];
  deliveryLocations: FilterDeliveryLocationOption[];
};

const PO_STATUS_FILTER_OPTIONS = [
  "ACKNOWLEDGEMENT PENDING",
  "COMPLETED",
  "EXPIRED",
  "CANCELLED",
  "IN PROGRESS",
  "NOT-SET",
] as const;

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

function wipStatus(v: string | null | undefined): string | null {
  if (v === "YES") return "wip";
  if (v === "NO") return "open";
  return v ?? null;
}

type SortableColumn =
  | "po_number"
  | "po_type"
  | "company_name"
  | "delivery_city"
  | "calculated_po_status"
  | "is_wip"
  | "remarks"
  | "po_issue_date"
  | "expiry_date"
  | "created_at"
  | "created_by"
  | "sku_count"
  | "total_demand"
  | "total_dispatched"
  | "total_packed"
  | "total_pending"
  | "quantity_fill_rate"
  | "sku_fill_rate"
  | "total_consignments"
  | "boxes_dispatched"
  | "boxes_packed";

type SortState = { col: SortableColumn; dir: "asc" | "desc" } | null;

function SortHeader({
  label,
  col,
  sort,
  onSort,
}: Readonly<{
  label: string;
  col: SortableColumn;
  sort: SortState;
  onSort: (col: SortableColumn) => void;
}>) {
  const active = sort?.col === col;
  let Icon = ChevronsUpDown;
  if (active) Icon = sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      className={cn(
        "inline-flex items-center gap-1 font-semibold whitespace-nowrap",
        "hover:text-primary",
        active ? "text-primary" : "text-foreground"
      )}
    >
      {label}
      <Icon className={cn("size-3", active ? "opacity-100" : "opacity-50")} />
    </button>
  );
}

export function OutboundPurchaseOrdersTable({
  wipOnly,
}: Readonly<{
  wipOnly?: boolean;
}>) {
  const { hasPermission } = useAuth();
  const canMutate = hasPermission("purchase_orders", "create");
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [applied, setApplied] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [data, setData] = React.useState<Paginated | null>(null);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [downloadingBulk, setDownloadingBulk] = React.useState<
    null | "sku_report" | "pendency_zip" | "pendency_merged"
  >(null);
  const [companies, setCompanies] = React.useState<FilterCompanyOption[]>([]);
  const [deliveryLocations, setDeliveryLocations] = React.useState<FilterDeliveryLocationOption[]>([]);
  const [companyIds, setCompanyIds] = React.useState<string[]>([]);
  const [deliveryCities, setDeliveryCities] = React.useState<string[]>([]);
  const [poStatuses, setPoStatuses] = React.useState<string[]>([]);
  const [poTypes, setPoTypes] = React.useState<string[]>([]);
  const [poNumberQuery, setPoNumberQuery] = React.useState("");
  const [poNumberApplied, setPoNumberApplied] = React.useState("");
  const [sort, setSort] = React.useState<SortState>(null);

  /** Cycle: none → desc → asc → none. */
  const handleSort = React.useCallback((col: SortableColumn) => {
    setPage(1);
    setSort((prev) => {
      if (prev?.col !== col) return { col, dir: "desc" };
      if (prev.dir === "desc") return { col, dir: "asc" };
      return null;
    });
  }, []);

  const updateMulti = React.useCallback(
    (setter: React.Dispatch<React.SetStateAction<string[]>>) => (next: string[]) => {
      setPage(1);
      setter(next);
    },
    []
  );

  React.useEffect(() => {
    void (async () => {
      try {
        const opts = await apiFetch<FilterOptionsPayload>(
          "/api/outbound/purchase-orders/filter-options"
        );
        setCompanies(Array.isArray(opts.companies) ? opts.companies : []);
        setDeliveryLocations(
          Array.isArray(opts.deliveryLocations) ? opts.deliveryLocations : []
        );
      } catch {
        setCompanies([]);
        setDeliveryLocations([]);
      }
    })();
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams();
      q.set("page", String(page));
      q.set("count", "100");
      if (applied.trim()) q.set("search", applied.trim());
      if (wipOnly) q.set("wip", "1");
      if (poNumberApplied.trim()) q.set("po_number", poNumberApplied.trim());
      if (companyIds.length > 0) q.set("company_ids", companyIds.join(","));
      if (deliveryCities.length > 0) q.set("delivery_cities", deliveryCities.join(","));
      if (poStatuses.length > 0) q.set("po_statuses", poStatuses.join(","));
      if (poTypes.length > 0) q.set("po_types", poTypes.join(","));
      if (sort) {
        q.set("sort_by", sort.col);
        q.set("sort_dir", sort.dir);
      }
      const res = await apiFetch<Paginated>(`/api/outbound/purchase-orders?${q}`);
      setData(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [
    page, applied, wipOnly, poNumberApplied,
    companyIds, deliveryCities, poStatuses, poTypes, sort,
  ]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.per_page_count)) : 1;

  const rows = data?.content ?? [];
  const allIds = rows.map((r) => r.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = allIds.some((id) => selected.has(id));

  function toggleAll() {
    if (allSelected) {
      setSelected((prev) => { const s = new Set(prev); allIds.forEach((id) => s.delete(id)); return s; });
    } else {
      setSelected((prev) => { const s = new Set(prev); allIds.forEach((id) => s.add(id)); return s; });
    }
  }

  function toggleRow(id: number) {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }

  function exportSelectedCsv() {
    const selectedRows = rows.filter((r) => selected.has(r.id));
    if (selectedRows.length === 0) { toast.error("No rows selected"); return; }
    const headers = ["PO Number", "PO Type", "Company", "City", "Status", "SKU Count", "Demand", "Dispatched", "Packed", "Pending", "Qty Fill %", "SKU Fill %"];
    const lines = selectedRows.map((r) => {
      const a = r.analytics_object ?? {};
      return [
        r.po_number, r.po_type ?? "", r.company_name ?? "", r.delivery_city ?? "",
        r.calculated_po_status ?? "", a.sku_count ?? "", a.total_demand ?? "",
        a.total_dispatched ?? "", a.total_packed ?? "", a.total_pending ?? "",
        a.quantity_fill_rate ?? "", a.sku_fill_rate ?? "",
      ].map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",");
    });
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "outbound-pos.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${selectedRows.length} rows`);
  }

  async function handleBulkDownload(
    kind: "sku_report" | "pendency_zip" | "pendency_merged"
  ) {
    const ids = Array.from(selected);
    if (ids.length === 0) {
      toast.error("No rows selected");
      return;
    }
    setDownloadingBulk(kind);
    try {
      const token = getStoredToken();
      const headers = new Headers({ "Content-Type": "application/json" });
      if (token) headers.set("Authorization", `Bearer ${token}`);

      const url =
        kind === "sku_report"
          ? apiUrl("/api/outbound/purchase-orders/bulk-sku-report")
          : apiUrl("/api/outbound/purchase-orders/bulk-pendency-pdf");

      const body =
        kind === "sku_report"
          ? { ids }
          : { ids, format: kind === "pendency_zip" ? "zip" : "merged" };

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? res.statusText);
      }

      const skipped = res.headers.get("X-Skipped-Po-Numbers")?.trim();
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const fallback =
        kind === "sku_report"
          ? `bulk-sku-report-${new Date().toISOString().slice(0, 10)}.xlsx`
          : kind === "pendency_zip"
            ? `bulk-pendency-pdf-${new Date().toISOString().slice(0, 10)}.zip`
            : `bulk-pendency-pdf-${new Date().toISOString().slice(0, 10)}.pdf`;
      const downloadName = match?.[1] ?? fallback;

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = downloadName;
      a.click();
      URL.revokeObjectURL(objectUrl);

      const label =
        kind === "sku_report"
          ? "SKU Level Report"
          : kind === "pendency_zip"
            ? "Pendency PDF (ZIP)"
            : "Pendency PDF (Combined)";
      toast.success(`Downloaded ${label} for ${ids.length} PO(s)`);
      if (skipped) {
        toast.warning(`Skipped PO(s) with no line items: ${skipped}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloadingBulk(null);
    }
  }

  const bulkBtnClass =
    "border-blue-400 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950/30 whitespace-normal";

  const companyOptions = React.useMemo(
    () =>
      companies.map((c) => ({
        value: String(c.id),
        label: c.name?.trim() ? c.name : `Company ${c.id}`,
      })),
    [companies]
  );
  const deliveryLocationOptions = React.useMemo(
    () => deliveryLocations.map((loc) => ({ value: loc.name, label: loc.name })),
    [deliveryLocations]
  );
  const poStatusOptions = React.useMemo(
    () => PO_STATUS_FILTER_OPTIONS.map((s) => ({ value: s, label: s })),
    []
  );
  const poTypeOptions = React.useMemo(
    () => OUTBOUND_PO_TYPES.map((t) => ({ value: t, label: t })),
    []
  );

  return (
    <Card className="border-primary/10 shadow-sm">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-xs font-medium" htmlFor="po-search">
              Search
            </label>
            <Input
              id="po-search"
              placeholder="PO number, company, city…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setApplied(search);
              }}
              className="h-9 w-72"
            />
          </div>
          <Button type="button" variant="secondary" onClick={() => setApplied(search)}>
            Apply
          </Button>
        </div>
        {someSelected ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="text-muted-foreground text-xs">{selected.size} selected</span>
            {canMutate ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={bulkBtnClass}
                  disabled={downloadingBulk !== null || loading}
                  onClick={() => void handleBulkDownload("sku_report")}
                >
                  {downloadingBulk === "sku_report" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    "Download SKU Level Report"
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={bulkBtnClass}
                  disabled={downloadingBulk !== null || loading}
                  onClick={() => void handleBulkDownload("pendency_zip")}
                >
                  {downloadingBulk === "pendency_zip" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    "Download Pendency PDF (ZIP)"
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={bulkBtnClass}
                  disabled={downloadingBulk !== null || loading}
                  onClick={() => void handleBulkDownload("pendency_merged")}
                >
                  {downloadingBulk === "pendency_merged" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    "Download Pendency PDF (Combined)"
                  )}
                </Button>
              </>
            ) : null}
            <Button type="button" size="sm" variant="outline" onClick={exportSelectedCsv}>
              Export CSV
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-muted-foreground text-xs"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        {err && (
          <p className="text-destructive px-6 py-4 text-sm" role="alert">
            {err}
          </p>
        )}
        {loading && !data ? (
          <div className="space-y-2 px-6 py-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="max-w-full overflow-x-auto">
            <table className="w-max min-w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th rowSpan={2} className="sticky left-0 z-10 bg-muted/50 px-2 py-2 align-middle">
                    <input
                      type="checkbox"
                      className="accent-primary cursor-pointer"
                      aria-label="Select all"
                      checked={allSelected}
                      ref={(el: HTMLInputElement | null) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="px-2 py-2 min-w-[140px]"><SortHeader label="PO Number" col="po_number" sort={sort} onSort={handleSort} /></th>
                  <th className="px-2 py-2 min-w-[140px]"><SortHeader label="PO Type" col="po_type" sort={sort} onSort={handleSort} /></th>
                  <th className="px-2 py-2 min-w-[160px]"><SortHeader label="Company Name" col="company_name" sort={sort} onSort={handleSort} /></th>
                  <th className="px-2 py-2 min-w-[160px]"><SortHeader label="Delivery Location" col="delivery_city" sort={sort} onSort={handleSort} /></th>
                  <th className="px-2 py-2 min-w-[160px]"><SortHeader label="PO status" col="calculated_po_status" sort={sort} onSort={handleSort} /></th>
                  <th className="px-2 py-2"><SortHeader label="Is WIP?" col="is_wip" sort={sort} onSort={handleSort} /></th>
                  <th className="px-2 py-2"><SortHeader label="Remarks" col="remarks" sort={sort} onSort={handleSort} /></th>
                  <th className="px-2 py-2"><SortHeader label="SKU Count" col="sku_count" sort={sort} onSort={handleSort} /></th>
                  <th className="px-2 py-2"><SortHeader label="Demand Quantity" col="total_demand" sort={sort} onSort={handleSort} /></th>
                  <th className="px-2 py-2"><SortHeader label="Dispatched Quantity" col="total_dispatched" sort={sort} onSort={handleSort} /></th>
                  <th className="px-2 py-2"><SortHeader label="Packed Quantity" col="total_packed" sort={sort} onSort={handleSort} /></th>
                  <th className="px-2 py-2"><SortHeader label="Pending Quantity" col="total_pending" sort={sort} onSort={handleSort} /></th>
                  <th className="px-2 py-2"><SortHeader label="Quantity Fill Rate" col="quantity_fill_rate" sort={sort} onSort={handleSort} /></th>
                  <th className="px-2 py-2"><SortHeader label="SKU Fill Rate" col="sku_fill_rate" sort={sort} onSort={handleSort} /></th>
                  <th className="px-2 py-2"><SortHeader label="Consignment Count" col="total_consignments" sort={sort} onSort={handleSort} /></th>
                  <th className="px-2 py-2"><SortHeader label="Boxes Dispatched" col="boxes_dispatched" sort={sort} onSort={handleSort} /></th>
                  <th className="px-2 py-2"><SortHeader label="Boxes Packed" col="boxes_packed" sort={sort} onSort={handleSort} /></th>
                  <th className="px-2 py-2"><SortHeader label="PO Release Date" col="po_issue_date" sort={sort} onSort={handleSort} /></th>
                  <th className="px-2 py-2"><SortHeader label="Expiry Date" col="expiry_date" sort={sort} onSort={handleSort} /></th>
                  <th className="px-2 py-2"><SortHeader label="PO Addition Date" col="created_at" sort={sort} onSort={handleSort} /></th>
                  <th className="px-2 py-2"><SortHeader label="PO Added By" col="created_by" sort={sort} onSort={handleSort} /></th>
                </tr>
                <tr className="bg-muted/30 border-b">
                  <th className="px-2 py-1.5">
                    <input
                      aria-label="Filter by PO number"
                      type="text"
                      placeholder="Filter…"
                      className="border-input bg-background h-7 w-full rounded border px-1.5 text-[11px]"
                      value={poNumberQuery}
                      onChange={(e) => setPoNumberQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setPage(1);
                          setPoNumberApplied(poNumberQuery);
                        }
                      }}
                      onBlur={() => {
                        if (poNumberQuery !== poNumberApplied) {
                          setPage(1);
                          setPoNumberApplied(poNumberQuery);
                        }
                      }}
                    />
                  </th>
                  <th className="px-2 py-1.5">
                    <MultiSelect
                      ariaLabel="Filter by PO type"
                      placeholder="All types"
                      options={poTypeOptions}
                      selected={poTypes}
                      onChange={updateMulti(setPoTypes)}
                    />
                  </th>
                  <th className="px-2 py-1.5">
                    <MultiSelect
                      ariaLabel="Filter by company"
                      placeholder="All companies"
                      options={companyOptions}
                      selected={companyIds}
                      onChange={updateMulti(setCompanyIds)}
                    />
                  </th>
                  <th className="px-2 py-1.5">
                    <MultiSelect
                      ariaLabel="Filter by delivery location"
                      placeholder="All locations"
                      options={deliveryLocationOptions}
                      selected={deliveryCities}
                      onChange={updateMulti(setDeliveryCities)}
                    />
                  </th>
                  <th className="px-2 py-1.5">
                    <MultiSelect
                      ariaLabel="Filter by status"
                      placeholder="All statuses"
                      options={poStatusOptions}
                      selected={poStatuses}
                      onChange={updateMulti(setPoStatuses)}
                    />
                  </th>
                  {[
                    "wip", "remarks", "sku_count", "demand", "dispatched", "packed", "pending",
                    "qty_fill", "sku_fill", "consignments", "boxes_dispatched", "boxes_packed",
                    "release_date", "expiry_date", "addition_date", "added_by",
                  ].map((k) => (
                    <th key={`spacer-${k}`} className="px-2 py-1.5"></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.content ?? []).map((row) => {
                  const a = row.analytics_object ?? {};
                  return (
                    <tr key={row.id} className={`border-b hover:bg-muted/30 ${selected.has(row.id) ? "bg-primary/5" : ""}`}>
                      <td className="sticky left-0 z-10 bg-background px-2 py-1.5">
                        <input
                          type="checkbox"
                          className="accent-primary cursor-pointer"
                          aria-label={`Select ${row.po_number}`}
                          checked={selected.has(row.id)}
                          onChange={() => toggleRow(row.id)}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Link
                          href={`/outbound/po/${row.id}`}
                          className="text-primary font-medium underline-offset-4 hover:underline"
                        >
                          {row.po_number}
                        </Link>
                      </td>
                      <td className="text-muted-foreground px-2 py-1.5">{row.po_type ?? "—"}</td>
                      <td className="px-2 py-1.5">
                        <CompanyNameWithLogo name={row.company_name} />
                      </td>
                      <td className="px-2 py-1.5">{row.delivery_city ?? "—"}</td>
                      <td className="px-2 py-1.5">
                        <StatusPill status={row.calculated_po_status} />
                      </td>
                      <td className="px-2 py-1.5">
                        <StatusPill status={wipStatus(row.is_wip)} />
                      </td>
                      <td className="text-muted-foreground max-w-[120px] truncate px-2 py-1.5">
                        {row.remarks || "—"}
                      </td>
                      <td className="px-2 py-1.5">
                        {a.sku_count != null ? String(a.sku_count) : "—"}
                      </td>
                      <td className="px-2 py-1.5">
                        {a.total_demand != null ? String(a.total_demand) : "—"}
                      </td>
                      <td className="px-2 py-1.5">
                        {a.total_dispatched != null ? String(a.total_dispatched) : "—"}
                      </td>
                      <td className="px-2 py-1.5">
                        {a.total_packed != null ? String(a.total_packed) : "—"}
                      </td>
                      <td className="px-2 py-1.5">
                        {a.total_pending != null ? String(a.total_pending) : "—"}
                      </td>
                      <td className="px-2 py-1.5">
                        <FillRateBar value={a.quantity_fill_rate} />
                      </td>
                      <td className="px-2 py-1.5">
                        <FillRateBar value={a.sku_fill_rate} />
                      </td>
                      <td className="px-2 py-1.5">
                        {a.total_consignments != null ? String(a.total_consignments) : "—"}
                      </td>
                      <td className="px-2 py-1.5">
                        {a.boxes_dispatched != null ? String(a.boxes_dispatched) : "—"}
                      </td>
                      <td className="px-2 py-1.5">
                        {a.boxes_packed != null ? String(a.boxes_packed) : "—"}
                      </td>
                      <td className="px-2 py-1.5">{fmtDay(row.po_issue_date)}</td>
                      <td className="px-2 py-1.5">{fmtDay(row.expiry_date)}</td>
                      <td className="px-2 py-1.5">{fmtDateTime(row.created_at)}</td>
                      <td className="px-2 py-1.5">{row.created_by ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t text-sm">
        <span className="text-muted-foreground">
          {data ? (
            <>
              Page {data.current_page} of {totalPages} — Showing {data.curr_page_count} of {data.total}{" "}
              items
            </>
          ) : (
            "—"
          )}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || !data || page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
