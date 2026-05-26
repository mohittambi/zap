"use client";

import * as React from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-browser";
import { CompanyNameWithLogo } from "@/components/company/company-logo";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
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
import { cn } from "@/lib/utils";

type Consignment = {
  id: number;
  consignment_id?: string | null;
  po_id?: number | null;
  po_number?: string | null;
  box_id?: string | null;
  company_name?: string | null;
  delivery_city?: string | null;
  dispatch_status?: string | null;
  invoice_number?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  item_count?: number | null;
};

type PageData = {
  total: number;
  current_page: number;
  per_page_count: number;
  curr_page_count: number;
  content: Consignment[];
};

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return d;
  return x.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function statusClass(s: string | null | undefined): string {
  if (!s) return "";
  const u = s.toUpperCase();
  if (u.includes("DISPATCH")) return "text-violet-600 dark:text-violet-400 font-medium";
  if (u.includes("PEND") || u.includes("WIP")) return "text-orange-600 dark:text-orange-400 font-medium";
  return "";
}

export function BoxesTable() {
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [applied, setApplied] = React.useState("");
  const [data, setData] = React.useState<PageData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [pendingInvoiceOnly, setPendingInvoiceOnly] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), count: "100" });
      if (applied.trim()) q.set("search", applied.trim());
      if (pendingInvoiceOnly) q.set("pending_invoice", "1");
      const res = await apiFetch<PageData>(`/api/outbound/consignments?${q}`);
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load boxes");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, applied, pendingInvoiceOnly]);

  React.useEffect(() => { void load(); }, [load]);

  const rows = data?.content ?? [];
  const allIds = rows.map((r) => r.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = allIds.some((id) => selected.has(id));
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.per_page_count)) : 1;

  function toggleAll() {
    if (allSelected) {
      setSelected((p) => { const s = new Set(p); allIds.forEach((id) => s.delete(id)); return s; });
    } else {
      setSelected((p) => { const s = new Set(p); allIds.forEach((id) => s.add(id)); return s; });
    }
  }

  function toggleRow(id: number) {
    setSelected((p) => { const s = new Set(p); if (s.has(id)) s.delete(id); else s.add(id); return s; });
  }

  function exportCsv() {
    const sel = rows.filter((r) => selected.has(r.id));
    if (!sel.length) { toast.error("No rows selected"); return; }
    const headers = ["ID", "Box ID", "PO Number", "Company", "City", "Status", "Invoice #", "Items", "Created"];
    const lines = sel.map((r) => [
      r.id, r.box_id ?? "", r.po_number ?? "", r.company_name ?? "",
      r.delivery_city ?? "", r.dispatch_status ?? "", r.invoice_number ?? "",
      r.item_count ?? "", fmtDate(r.created_at),
    ].map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","));
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "boxes.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${sel.length} boxes`);
  }

  return (
    <Card className="border-primary/10 shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex w-full flex-col gap-2 sm:max-w-md">
          <label className="text-muted-foreground text-xs font-medium" htmlFor="box-search">
            Search
          </label>
          <div className="flex gap-2">
            <Input
              id="box-search"
              placeholder="Box ID, PO, company, invoice…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); setApplied(search); } }}
            />
            <Button type="button" variant="secondary" onClick={() => { setPage(1); setApplied(search); }}>
              Apply
            </Button>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              className="size-3.5 accent-primary"
              checked={pendingInvoiceOnly}
              onChange={(e) => { setPendingInvoiceOnly(e.target.checked); setPage(1); }}
            />
            Pending invoice only
          </label>
        </div>
        {someSelected ? (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">{selected.size} selected</span>
            <Button type="button" size="sm" variant="outline" onClick={exportCsv}>Export CSV</Button>
            <Button type="button" size="sm" variant="ghost" className="text-muted-foreground text-xs" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-2 px-6 py-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !data || rows.length === 0 ? (
          <div className="px-6 py-8">
            <EmptyState title="No boxes found" description="Run the consignments sync to populate this list." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-10 pl-4">
                    <input
                      type="checkbox"
                      className="accent-primary cursor-pointer"
                      aria-label="Select all"
                      checked={allSelected}
                      ref={(el: HTMLInputElement | null) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                      onChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead className="whitespace-nowrap font-semibold">Box ID</TableHead>
                  <TableHead className="whitespace-nowrap font-semibold">PO Number</TableHead>
                  <TableHead className="font-semibold">Company</TableHead>
                  <TableHead className="font-semibold">City</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Invoice #</TableHead>
                  <TableHead className="text-right font-semibold">Items</TableHead>
                  <TableHead className="whitespace-nowrap font-semibold">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow
                    key={row.id}
                    className={cn("hover:bg-muted/30", {
                      "bg-muted/20": i % 2 === 1,
                      "bg-primary/5": selected.has(row.id),
                    })}
                  >
                    <TableCell className="pl-4">
                      <input
                        type="checkbox"
                        className="accent-primary cursor-pointer"
                        checked={selected.has(row.id)}
                        onChange={() => toggleRow(row.id)}
                        aria-label={`Select box ${row.box_id ?? row.id}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`/outbound/consignments/${row.id}`}
                        className="text-primary font-medium underline-offset-4 hover:underline"
                      >
                        {row.box_id ?? row.id}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.po_id ? (
                        <Link href={`/outbound/po/${row.po_id}`} className="text-primary underline-offset-4 hover:underline">
                          {row.po_number ?? row.po_id}
                        </Link>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      <CompanyNameWithLogo name={row.company_name} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{row.delivery_city ?? "—"}</TableCell>
                    <TableCell className={cn("text-xs", statusClass(row.dispatch_status))}>
                      {row.dispatch_status ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.invoice_number ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{row.item_count ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{fmtDate(row.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {data && data.total > 0 ? (
        <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t text-sm">
          <span className="text-muted-foreground text-xs">
            Page {data.current_page} of {totalPages} — {data.total} box(es)
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={loading || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={loading || page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </CardFooter>
      ) : null}
    </Card>
  );
}
