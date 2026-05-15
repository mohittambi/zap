"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MultiSelect } from "@/components/ui/multi-select";
import { cn } from "@/lib/utils";

type PartialPoRow = {
  id: number;
  po_number: string;
  company_name: string | null;
  company_id: number | null;
  delivery_city: string | null;
  expiry_date: string | null;
  created_at: string | null;
  created_by: string | null;
};

type Paginated = {
  total: number;
  current_page: number;
  per_page_count: number;
  curr_page_count: number;
  content: PartialPoRow[];
};

type FilterCompanyOption = { id: number; name: string | null };
type FilterDeliveryLocationOption = { id: number; name: string };
type FilterOptionsPayload = {
  companies: FilterCompanyOption[];
  deliveryLocations: FilterDeliveryLocationOption[];
};

type SortableColumn =
  | "po_number"
  | "company_name"
  | "delivery_city"
  | "expiry_date"
  | "created_at"
  | "created_by";

type SortState = { col: SortableColumn; dir: "asc" | "desc" } | null;

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

export function PartialOutboundPosTable() {
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [applied, setApplied] = React.useState("");
  const [poNumberQuery, setPoNumberQuery] = React.useState("");
  const [poNumberApplied, setPoNumberApplied] = React.useState("");
  const [companyIds, setCompanyIds] = React.useState<string[]>([]);
  const [deliveryCities, setDeliveryCities] = React.useState<string[]>([]);
  const [sort, setSort] = React.useState<SortState>(null);
  const [companies, setCompanies] = React.useState<FilterCompanyOption[]>([]);
  const [deliveryLocations, setDeliveryLocations] = React.useState<FilterDeliveryLocationOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [data, setData] = React.useState<Paginated | null>(null);

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

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams();
      q.set("page", String(page));
      q.set("count", "28");
      q.set("partial", "1");
      if (applied.trim()) q.set("search", applied.trim());
      if (poNumberApplied.trim()) q.set("po_number", poNumberApplied.trim());
      if (companyIds.length > 0) q.set("company_ids", companyIds.join(","));
      if (deliveryCities.length > 0) q.set("delivery_cities", deliveryCities.join(","));
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
  }, [page, applied, poNumberApplied, companyIds, deliveryCities, sort]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.per_page_count)) : 1;

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

  return (
    <Card className="border-primary/10 shadow-sm">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-xs font-medium" htmlFor="partial-po-search">
              Search
            </label>
            <Input
              id="partial-po-search"
              placeholder="PO number…"
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
                  <th className="px-3 py-2 min-w-[140px]"><SortHeader label="PO Number" col="po_number" sort={sort} onSort={handleSort} /></th>
                  <th className="px-3 py-2 min-w-[160px]"><SortHeader label="Company Name" col="company_name" sort={sort} onSort={handleSort} /></th>
                  <th className="px-3 py-2 font-semibold">Company ID</th>
                  <th className="px-3 py-2 min-w-[160px]"><SortHeader label="Delivery Location" col="delivery_city" sort={sort} onSort={handleSort} /></th>
                  <th className="px-3 py-2"><SortHeader label="Expiry Date" col="expiry_date" sort={sort} onSort={handleSort} /></th>
                  <th className="px-3 py-2"><SortHeader label="Creation Date" col="created_at" sort={sort} onSort={handleSort} /></th>
                  <th className="px-3 py-2"><SortHeader label="Created By" col="created_by" sort={sort} onSort={handleSort} /></th>
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
                      ariaLabel="Filter by company"
                      placeholder="All companies"
                      options={companyOptions}
                      selected={companyIds}
                      onChange={updateMulti(setCompanyIds)}
                    />
                  </th>
                  <th className="px-2 py-1.5"></th>
                  <th className="px-2 py-1.5">
                    <MultiSelect
                      ariaLabel="Filter by delivery location"
                      placeholder="All locations"
                      options={deliveryLocationOptions}
                      selected={deliveryCities}
                      onChange={updateMulti(setDeliveryCities)}
                    />
                  </th>
                  {["expiry", "created", "by"].map((k) => (
                    <th key={`spacer-${k}`} className="px-2 py-1.5"></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.content ?? []).map((row) => (
                  <tr key={row.id} className="border-b hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <Link
                        href={`/outbound/po/${row.id}`}
                        className="text-primary font-medium underline-offset-4 hover:underline"
                      >
                        {row.po_number}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{row.company_name ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.company_id != null ? String(row.company_id) : "—"}
                    </td>
                    <td className="px-3 py-2">{row.delivery_city ?? "—"}</td>
                    <td className="px-3 py-2">{fmtDay(row.expiry_date)}</td>
                    <td className="px-3 py-2">{fmtDateTime(row.created_at)}</td>
                    <td className="text-muted-foreground px-3 py-2">{row.created_by ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t text-sm">
        <span className="text-muted-foreground">
          {data ? (
            <>
              Page {data.current_page} of {totalPages} — {data.curr_page_count} of {data.total}{" "}
              partial PO(s)
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
