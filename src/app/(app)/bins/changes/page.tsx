"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiUrl, getStoredToken, apiFetch } from "@/lib/api-browser";
import { formatIstDateTime } from "@/lib/format-ist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type BinChangeRow = {
  id: number;
  created_at: string;
  warehouse_id: number;
  sku_id: string;
  description: string | null;
  bin_id: string | null;
  inventory_operation_type: string;
  movement_type: string | null;
  quantity: number;
  user_id: string | null;
};

type FilterState = {
  sku_id: string;
  bin_id: string;
  movement_type: string;
  from: string;
  to: string;
  applied: {
    sku_id: string;
    bin_id: string;
    movement_type: string;
    from: string;
    to: string;
  };
};

const MOVEMENT_TYPES = ["ALL", "SALE", "GRN_RECEIPT", "ADJUSTMENT_IN", "ADJUSTMENT_OUT", "TRANSFER_IN", "TRANSFER_OUT"];
const SKEL_COLS = ["time", "bin", "sku", "desc", "op", "mvtype", "qty", "by"] as const;
const SKEL_ROWS = ["r0", "r1", "r2", "r3", "r4", "r5", "r6", "r7"] as const;

const PAGE_LIMIT = 50;

function buildQuery(filters: FilterState["applied"], page: number): string {
  const params = new URLSearchParams();
  if (filters.sku_id) params.set("sku_id", filters.sku_id);
  if (filters.bin_id) params.set("bin_id", filters.bin_id);
  if (filters.movement_type && filters.movement_type !== "ALL") params.set("movement_type", filters.movement_type);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  params.set("page", String(page));
  params.set("limit", String(PAGE_LIMIT));
  return params.toString();
}

async function downloadExport(filters: FilterState["applied"]) {
  const params = new URLSearchParams();
  if (filters.sku_id) params.set("sku_id", filters.sku_id);
  if (filters.bin_id) params.set("bin_id", filters.bin_id);
  if (filters.movement_type && filters.movement_type !== "ALL") params.set("movement_type", filters.movement_type);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);

  const headers = new Headers();
  const token = getStoredToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(apiUrl(`/api/bins/changes/export?${params.toString()}`), { headers });
  if (!res.ok) {
    const t = await res.text();
    let msg = t || res.statusText;
    try { const j = JSON.parse(t) as { error?: string }; if (j.error) msg = j.error; } catch { /* plain */ }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "bin-changes-export.xlsx";
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function BinChangesPage() {
  const [filters, setFilters] = React.useState<FilterState>({
    sku_id: "", bin_id: "", movement_type: "ALL", from: "", to: "",
    applied: { sku_id: "", bin_id: "", movement_type: "ALL", from: "", to: "" },
  });
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<BinChangeRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    apiFetch<{ total: number; data: BinChangeRow[] }>(
      `/api/bins/changes?${buildQuery(filters.applied, page)}`
    )
      .then((res) => { setData(res.data); setTotal(res.total); })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [filters.applied, page]);

  function handleApply() {
    setPage(1);
    setFilters(prev => ({
      ...prev,
      applied: {
        sku_id: prev.sku_id,
        bin_id: prev.bin_id,
        movement_type: prev.movement_type,
        from: prev.from,
        to: prev.to,
      },
    }));
  }

  async function handleExport() {
    setExporting(true);
    try {
      await downloadExport(filters.applied);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Bin Changes</h1>
          <p className="text-sm text-muted-foreground">All inventory movements across the system.</p>
        </div>
        <Button onClick={() => void handleExport()} disabled={exporting} variant="outline" className="min-h-11 shrink-0">
          {exporting ? "Exporting…" : "Download Excel"}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="space-y-1.5">
          <Label className="text-xs">SKU</Label>
          <Input
            value={filters.sku_id}
            onChange={e => setFilters(f => ({ ...f, sku_id: e.target.value }))}
            onKeyDown={e => { if (e.key === "Enter") handleApply(); }}
            placeholder="SKU ID"
            className="h-9 w-40 font-mono text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Bin</Label>
          <Input
            value={filters.bin_id}
            onChange={e => setFilters(f => ({ ...f, bin_id: e.target.value }))}
            onKeyDown={e => { if (e.key === "Enter") handleApply(); }}
            placeholder="Bin ID"
            className="h-9 w-36 font-mono text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Movement Type</Label>
          <select
            value={filters.movement_type}
            onChange={e => setFilters(f => ({ ...f, movement_type: e.target.value }))}
            className="h-9 w-44 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {MOVEMENT_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">From</Label>
          <Input
            type="date"
            value={filters.from}
            onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
            className="h-9 w-36 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">To</Label>
          <Input
            type="date"
            value={filters.to}
            onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
            className="h-9 w-36 text-sm"
          />
        </div>
        <Button onClick={handleApply} className="h-9">Apply</Button>
        <Button
          variant="ghost"
          className="h-9 text-xs text-muted-foreground"
          onClick={() => {
            setFilters({ sku_id: "", bin_id: "", movement_type: "ALL", from: "", to: "", applied: { sku_id: "", bin_id: "", movement_type: "ALL", from: "", to: "" } });
            setPage(1);
          }}
        >
          Clear
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Time</TableHead>
              <TableHead className="text-xs">Bin</TableHead>
              <TableHead className="text-xs">SKU</TableHead>
              <TableHead className="text-xs">Description</TableHead>
              <TableHead className="text-xs">Operation</TableHead>
              <TableHead className="text-xs">Movement Type</TableHead>
              <TableHead className="text-right text-xs">Qty</TableHead>
              <TableHead className="text-xs">Changed By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              SKEL_ROWS.map(row => (
                <TableRow key={row}>
                  {SKEL_COLS.map(col => (
                    <TableCell key={`${row}-${col}`}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : null}
            {!loading && data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  No records found.
                </TableCell>
              </TableRow>
            ) : null}
            {!loading && data.length > 0 ? (
              data.map(row => {
                const opClass = row.inventory_operation_type === "ADD"
                  ? "border-green-400 text-green-700"
                  : "border-red-400 text-red-700";
                return (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {row.created_at ? formatIstDateTime(row.created_at) : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.bin_id ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs font-medium text-primary">{row.sku_id}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">
                      {row.description ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${opClass}`}>
                        {row.inventory_operation_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{row.movement_type ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">{row.quantity}</TableCell>
                    <TableCell className="max-w-[140px] truncate text-xs text-muted-foreground">{row.user_id ?? "—"}</TableCell>
                  </TableRow>
                );
              })
            ) : null}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} record{total !== 1 ? "s" : ""}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            ← Prev
          </Button>
          <span className="tabular-nums">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Next →
          </Button>
        </div>
      </div>
    </div>
  );
}
