"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { AppPageShell, AppPageTitle } from "@/components/layout/app-page-shell";
import { SearchableSelect } from "@/components/outbound/searchable-select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

type SkuOptionRow = {
  sku_id: string;
  description: string | null;
};

type WarehouseLogResponse = {
  total?: number;
  current_page?: number;
  content?: Record<string, unknown>[];
  data?: Record<string, unknown>[];
};

function extractRows(data: unknown): Record<string, unknown>[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  const d = data as WarehouseLogResponse;
  if (Array.isArray(d.content)) return d.content;
  if (Array.isArray(d.data)) return d.data;
  return [];
}

export default function WarehouseInventoryPage() {
  const [selectedSku, setSelectedSku] = React.useState<string | null>(null);
  const [appliedSku, setAppliedSku] = React.useState("");
  const [skuOptions, setSkuOptions] = React.useState<
    Array<{ key: string; label: string }>
  >([]);
  const [optionsLoading, setOptionsLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<unknown>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    void (async () => {
      try {
        const rows = await apiFetch<SkuOptionRow[]>(
          "/api/warehouse_inventory_dump/sku_ids"
        );
        setSkuOptions(
          rows.map((row) => {
            const desc = row.description?.trim();
            return {
              key: row.sku_id,
              label: desc ? `${row.sku_id} — ${desc}` : row.sku_id,
            };
          })
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load SKU list");
        setSkuOptions([]);
      } finally {
        setOptionsLoading(false);
      }
    })();
  }, []);

  const load = React.useCallback(async () => {
    if (!appliedSku.trim()) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), count: "200" });
      const res = await apiFetch<unknown>(
        `/api/warehouse_inventory_dump/sku_id/by_page/${encodeURIComponent(appliedSku.trim())}?${q}`
      );
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load inventory log");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [appliedSku, page]);

  React.useEffect(() => {
    if (!appliedSku.trim()) return;
    void load();
  }, [load, appliedSku, page]);

  function handleApply() {
    if (!selectedSku?.trim()) {
      toast.message("Select a SKU");
      return;
    }
    setAppliedSku(selectedSku.trim());
    setPage(1);
  }

  function handleSkuChange(next: string) {
    setSelectedSku(next);
    setAppliedSku(next.trim());
    setPage(1);
  }

  const rows = extractRows(data);
  const cols =
    rows.length > 0 && rows[0]
      ? Object.keys(rows[0]).slice(0, 12)
      : [
          "warehouse_id",
          "sku_id",
          "inventory_operation_type",
          "quantity",
          "bin_id",
          "user_id",
          "created_at",
          "updated_at",
        ];

  return (
    <AppPageShell className="space-y-6">
      <AppPageTitle
        title="Warehouse Inventory Log"
        description="Operations log per SKU (paginated)."
        className="mb-0"
      />

      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-5">
        <div className="min-w-[16rem] flex-1 space-y-1.5 sm:min-w-[20rem]">
          <Label htmlFor="warehouse-log-sku">SKU</Label>
          <SearchableSelect
            value={selectedSku}
            onChange={handleSkuChange}
            options={skuOptions}
            placeholder={
              optionsLoading ? "Loading SKUs…" : "Search or select SKU…"
            }
            emptyText="No SKUs match"
            variant="outline"
            disabled={optionsLoading}
            mono
          />
        </div>
        <div className="space-y-1.5">
          <Label className="pointer-events-none text-xs invisible" aria-hidden="true">
            Load
          </Label>
          <Button
            className="h-9 min-w-[7rem]"
            onClick={handleApply}
            disabled={loading || !selectedSku || optionsLoading}
          >
            {loading ? "Loading…" : "Load log"}
          </Button>
        </div>
      </div>

      {appliedSku ? (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="min-w-0">
                <p className="font-mono text-sm font-semibold text-primary">
                  {appliedSku}
                </p>
                <p className="text-muted-foreground text-xs">
                  {loading
                    ? "Loading…"
                    : rows.length > 0
                      ? `${rows.length} record(s) on this page`
                      : "No records on this page"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading || rows.length === 0}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  {cols.map((c) => (
                    <TableHead key={c} className="whitespace-nowrap text-xs">
                      {c.replaceAll("_", " ")}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        {cols.map((c) => (
                          <TableCell key={c}>
                            <Skeleton className="h-5 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : rows.length === 0
                    ? (
                        <TableRow>
                          <TableCell
                            colSpan={cols.length}
                            className="text-muted-foreground py-10 text-center text-sm"
                          >
                            No inventory records found for this SKU.
                          </TableCell>
                        </TableRow>
                      )
                    : rows.map((r, idx) => (
                        <TableRow
                          key={idx}
                          className={idx % 2 === 1 ? "bg-muted/20" : ""}
                        >
                          {cols.map((c) => (
                            <TableCell key={c} className="font-mono text-xs">
                              {r[c] == null ? "—" : String(r[c])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-12 text-center">
          <p className="text-muted-foreground text-sm">
            Select a SKU above to view its warehouse inventory log.
          </p>
        </div>
      )}
    </AppPageShell>
  );
}
