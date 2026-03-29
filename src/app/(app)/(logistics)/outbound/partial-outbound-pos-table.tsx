"use client";

import * as React from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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

export function PartialOutboundPosTable() {
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [applied, setApplied] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [data, setData] = React.useState<Paginated | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams();
      q.set("page", String(page));
      q.set("count", "28");
      q.set("partial", "1");
      if (applied.trim()) q.set("search", applied.trim());
      const res = await apiFetch<Paginated>(`/api/outbound/purchase-orders?${q}`);
      setData(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, applied]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.per_page_count)) : 1;

  return (
    <Card className="border-primary/10 shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex w-full flex-col gap-2 sm:max-w-sm" />
        <div className="flex w-full flex-col gap-2 sm:max-w-xs">
          <label className="text-muted-foreground text-xs font-medium" htmlFor="partial-po-search">
            Search by PO Number
          </label>
          <div className="flex gap-2">
            <Input
              id="partial-po-search"
              placeholder="Search by PO Number"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setApplied(search);
              }}
            />
            <Button type="button" variant="secondary" onClick={() => setApplied(search)}>
              Search
            </Button>
          </div>
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
            <table className="w-max min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">PO Number</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Company Name</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Company ID</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Delivery Location</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Expiry Date</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Creation Date</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Created By</th>
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
