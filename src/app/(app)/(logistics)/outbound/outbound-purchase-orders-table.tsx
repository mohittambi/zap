"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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

function statusClass(status: string | null | undefined): string {
  const s = (status ?? "").toUpperCase();
  if (s.includes("ACKNOWLEDGEMENT") || s.includes("PENDING")) return "text-orange-600 dark:text-orange-400";
  return "";
}

export function OutboundPurchaseOrdersTable({
  wipOnly,
}: {
  wipOnly?: boolean;
}) {
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [applied, setApplied] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [data, setData] = React.useState<Paginated | null>(null);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [companies, setCompanies] = React.useState<FilterCompanyOption[]>([]);
  const [deliveryLocations, setDeliveryLocations] = React.useState<FilterDeliveryLocationOption[]>([]);
  const [companyId, setCompanyId] = React.useState("");
  const [deliveryCity, setDeliveryCity] = React.useState("");
  const [poStatus, setPoStatus] = React.useState("");

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
      if (companyId) q.set("company_id", companyId);
      if (deliveryCity) q.set("delivery_city", deliveryCity);
      if (poStatus) q.set("po_status", poStatus);
      const res = await apiFetch<Paginated>(`/api/outbound/purchase-orders?${q}`);
      setData(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, applied, wipOnly, companyId, deliveryCity, poStatus]);

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

  return (
    <Card className="border-primary/10 shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex w-full flex-col gap-2">
          <label className="text-muted-foreground text-xs font-medium" htmlFor="po-search">
            Search
          </label>
          <div className="flex gap-2">
            <Input
              id="po-search"
              placeholder="PO number, company, city…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setApplied(search);
              }}
            />
            <Button type="button" variant="secondary" onClick={() => setApplied(search)}>
              Apply
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="text-muted-foreground text-xs">
              <span className="mb-1 block font-medium">Company</span>
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                value={companyId}
                onChange={(e) => {
                  setPage(1);
                  setCompanyId(e.target.value);
                }}
              >
                <option value="">All companies</option>
                {companies.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name ?? `Company ${c.id}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-muted-foreground text-xs">
              <span className="mb-1 block font-medium">Delivery Location</span>
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                value={deliveryCity}
                onChange={(e) => {
                  setPage(1);
                  setDeliveryCity(e.target.value);
                }}
              >
                <option value="">All locations</option>
                {deliveryLocations.map((loc) => (
                  <option key={loc.id} value={loc.name}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-muted-foreground text-xs">
              <span className="mb-1 block font-medium">Status</span>
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                value={poStatus}
                onChange={(e) => {
                  setPage(1);
                  setPoStatus(e.target.value);
                }}
              >
                <option value="">All statuses</option>
                {PO_STATUS_FILTER_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {someSelected ? (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">{selected.size} selected</span>
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
                  <th className="sticky left-0 z-10 bg-muted/50 px-2 py-2">
                    <input
                      type="checkbox"
                      className="accent-primary cursor-pointer"
                      aria-label="Select all"
                      checked={allSelected}
                      ref={(el: HTMLInputElement | null) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="whitespace-nowrap px-2 py-2 font-semibold">PO Number</th>
                  <th className="whitespace-nowrap px-2 py-2 font-semibold">PO Type</th>
                  <th className="whitespace-nowrap px-2 py-2 font-semibold">Company Name</th>
                  <th className="whitespace-nowrap px-2 py-2 font-semibold">Delivery Location</th>
                  <th className="whitespace-nowrap px-2 py-2 font-semibold">PO status</th>
                  <th className="whitespace-nowrap px-2 py-2 font-semibold">Is WIP?</th>
                  <th className="whitespace-nowrap px-2 py-2 font-semibold">Remarks</th>
                  <th className="whitespace-nowrap px-2 py-2 font-semibold">SKU Count</th>
                  <th className="whitespace-nowrap px-2 py-2 font-semibold">Demand Quantity</th>
                  <th className="whitespace-nowrap px-2 py-2 font-semibold">Dispatched Quantity</th>
                  <th className="whitespace-nowrap px-2 py-2 font-semibold">Packed Quantity</th>
                  <th className="whitespace-nowrap px-2 py-2 font-semibold">Pending Quantity</th>
                  <th className="whitespace-nowrap px-2 py-2 font-semibold">Quantity Fill Rate</th>
                  <th className="whitespace-nowrap px-2 py-2 font-semibold">SKU Fill Rate</th>
                  <th className="whitespace-nowrap px-2 py-2 font-semibold">Consignment Count</th>
                  <th className="whitespace-nowrap px-2 py-2 font-semibold">Boxes Dispatched</th>
                  <th className="whitespace-nowrap px-2 py-2 font-semibold">Boxes Packed</th>
                  <th className="whitespace-nowrap px-2 py-2 font-semibold">Po Release Date</th>
                  <th className="whitespace-nowrap px-2 py-2 font-semibold">Expiry Date</th>
                  <th className="whitespace-nowrap px-2 py-2 font-semibold">PO addition Date</th>
                  <th className="whitespace-nowrap px-2 py-2 font-semibold">PO added By</th>
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
                      <td className="px-2 py-1.5">{row.company_name ?? "—"}</td>
                      <td className="px-2 py-1.5">{row.delivery_city ?? "—"}</td>
                      <td className={`px-2 py-1.5 font-medium ${statusClass(row.calculated_po_status)}`}>
                        {row.calculated_po_status ?? "—"}
                      </td>
                      <td
                        className={`px-2 py-1.5 font-medium ${
                          row.is_wip === "NO" ? "text-destructive font-bold" : ""
                        }`}
                      >
                        {row.is_wip ?? "—"}
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
                        {a.quantity_fill_rate != null ? `${a.quantity_fill_rate}%` : "—"}
                      </td>
                      <td className="px-2 py-1.5">
                        {a.sku_fill_rate != null ? `${a.sku_fill_rate}%` : "—"}
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
