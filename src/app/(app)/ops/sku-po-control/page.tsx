"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { AppPageTitle } from "@/components/layout/app-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OpsSkuPoControlTable } from "@/components/ops/ops-sku-po-control-table";
import type { DataTableSort, DataTableSortDir } from "@/components/data-table";
import type { OpsSkuPoControlListResult } from "@/types/opsSkuPoControl";

export default function OpsSkuPoControlPage() {
  const [draftSearch, setDraftSearch] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [onlyPlacePending, setOnlyPlacePending] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [sort, setSort] = React.useState<DataTableSort>({
    columnId: "total_pending",
    dir: "desc",
  });
  const [data, setData] = React.useState<OpsSkuPoControlListResult | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        page: String(page),
        limit: "50",
      });
      if (search.trim()) q.set("search", search.trim());
      if (onlyPlacePending) q.set("only_place_pending", "true");
      if (sort) {
        q.set("sort", sort.columnId);
        q.set("sort_dir", sort.dir);
      }
      const res = await apiFetch<OpsSkuPoControlListResult>(
        `/api/ops/sku-po-control?${q}`
      );
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load SKU PO control");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, search, onlyPlacePending, sort]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleSortChange = React.useCallback(
    (columnId: string, dir: DataTableSortDir | null) => {
      setPage(1);
      if (!dir) {
        setSort({ columnId: "total_pending", dir: "desc" });
        return;
      }
      setSort({ columnId, dir });
    },
    []
  );

  const exportCsv = React.useCallback(() => {
    const q = new URLSearchParams();
    if (search.trim()) q.set("search", search.trim());
    if (onlyPlacePending) q.set("only_place_pending", "true");
    if (sort) {
      q.set("sort", sort.columnId);
      q.set("sort_dir", sort.dir);
    }
    window.open(`/api/ops/sku-po-control/export?${q}`, "_blank");
  }, [search, onlyPlacePending, sort]);

  const toolbar = (
    <div className="flex w-full flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="min-w-[220px] flex-[2] space-y-2">
        <Label htmlFor="ops-sku-search">Search Master SKU</Label>
        <Input
          id="ops-sku-search"
          value={draftSearch}
          onChange={(e) => setDraftSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setPage(1);
              setSearch(draftSearch);
            }
          }}
          placeholder="MSGB584_BLU…"
          className="min-h-11"
        />
      </div>
      <div className="flex items-center gap-2 pb-2">
        <input
          id="ops-only-place"
          type="checkbox"
          checked={onlyPlacePending}
          onChange={(e) => {
            setOnlyPlacePending(e.target.checked);
            setPage(1);
          }}
          className="size-4"
        />
        <Label htmlFor="ops-only-place" className="cursor-pointer font-normal">
          Needs placement only
        </Label>
      </div>
      <div className="flex gap-2">
        <Button
          className="min-h-11"
          onClick={() => {
            setPage(1);
            setSearch(draftSearch);
          }}
        >
          Apply
        </Button>
        <Button type="button" variant="outline" className="min-h-11" onClick={exportCsv}>
          Export CSV
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11"
          onClick={() => {
            setDraftSearch("");
            setSearch("");
            setOnlyPlacePending(false);
            setPage(1);
            setSort({ columnId: "total_pending", dir: "desc" });
          }}
        >
          Reset
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <AppPageTitle
        title="SKU PO Control"
        description="eAutomate sync upserts Postgres by primary key (safe to re-run — no duplicate POs/GRNs); metrics refresh rebuilds the 6h cache. Reload after sync."
      />
      <OpsSkuPoControlTable
        data={data}
        loading={loading}
        sort={sort}
        onSortChange={handleSortChange}
        page={page}
        onPageChange={setPage}
        toolbar={toolbar}
        phase={2}
      />
    </div>
  );
}
