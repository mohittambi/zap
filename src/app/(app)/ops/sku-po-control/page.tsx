"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { AppPageTitle } from "@/components/layout/app-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OpsSkuPoControlTable } from "@/components/ops/ops-sku-po-control-table";
import type { DataTableSort, DataTableSortDir } from "@/components/data-table";
import type {
  OpsSkuPoControlListResult,
  OpsSkuPoMetricsRefreshResult,
} from "@/types/opsSkuPoControl";
import { cn } from "@/lib/utils";

type LoadMode = "cache" | "live";

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
  const [rebuilding, setRebuilding] = React.useState(false);
  const [lastLoadMode, setLastLoadMode] = React.useState<LoadMode>("cache");
  const [cacheRebuiltAt, setCacheRebuiltAt] = React.useState<string | null>(null);
  const [liveLoadedAt, setLiveLoadedAt] = React.useState<string | null>(null);

  const load = React.useCallback(
    async (opts?: { live?: boolean }) => {
      const live = opts?.live === true;
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
        if (live) q.set("live", "1");

        const res = await apiFetch<OpsSkuPoControlListResult>(
          `/api/ops/sku-po-control?${q}`
        );
        setData(res);
        setLastLoadMode(live ? "live" : "cache");
        if (live) {
          setLiveLoadedAt(new Date().toISOString());
          setCacheRebuiltAt(null);
        } else if (!cacheRebuiltAt) {
          setLiveLoadedAt(null);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load SKU PO control");
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [page, search, onlyPlacePending, sort]
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleRefreshLive = React.useCallback(async () => {
    await load({ live: true });
    toast.success("Live data loaded (matches SKU detail modal)");
  }, [load]);

  const handleRebuildCache = React.useCallback(async () => {
    setRebuilding(true);
    try {
      const result = await apiFetch<OpsSkuPoMetricsRefreshResult>(
        "/api/ops/sku-po-control/refresh",
        { method: "POST" }
      );
      setCacheRebuiltAt(result.computed_at);
      setLiveLoadedAt(null);
      toast.success(
        `Cache rebuilt · ${result.row_count.toLocaleString("en-IN")} SKUs at ${new Date(result.computed_at).toLocaleString()}`
      );
      await load({ live: false });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to rebuild cache");
    } finally {
      setRebuilding(false);
    }
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

  const statusLine = React.useMemo(() => {
    if (cacheRebuiltAt) {
      return `Cache rebuilt · ${new Date(cacheRebuiltAt).toLocaleString()}`;
    }
    if (lastLoadMode === "live" && liveLoadedAt) {
      return `Live · ${new Date(liveLoadedAt).toLocaleString()}`;
    }
    if (data?.meta.cache_computed_at) {
      return `Cached · ${new Date(data.meta.cache_computed_at).toLocaleString()}`;
    }
    if (data?.meta.data_source === "live") {
      return "Live-computed";
    }
    return null;
  }, [cacheRebuiltAt, lastLoadMode, liveLoadedAt, data?.meta]);

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
      <div className="flex flex-wrap gap-2">
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
            setCacheRebuiltAt(null);
            setLiveLoadedAt(null);
          }}
        >
          Reset
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <AppPageTitle
          title="SKU PO Control"
          description="Refresh loads live data (same as row detail). Rebuild cache after sync for faster paging; cache auto-invalidates when synced data changes."
          className="mb-0"
        />
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {statusLine ? (
            <span className="text-muted-foreground hidden text-xs sm:inline">
              {statusLine}
            </span>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 shrink-0"
            aria-label="Refresh live data"
            disabled={loading || rebuilding}
            onClick={() => void handleRefreshLive()}
          >
            <RefreshCw
              className={cn("size-4", loading && lastLoadMode === "live" && "animate-spin")}
            />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={loading || rebuilding}
            onClick={() => void handleRebuildCache()}
          >
            {rebuilding ? "Rebuilding…" : "Rebuild cache"}
          </Button>
        </div>
      </div>

      {statusLine ? (
        <p className="text-muted-foreground text-xs sm:hidden">{statusLine}</p>
      ) : null}

      <OpsSkuPoControlTable
        data={data}
        loading={loading}
        sort={sort}
        onSortChange={handleSortChange}
        page={page}
        onPageChange={setPage}
        toolbar={toolbar}
        phase={2}
        dataSource={data?.meta.data_source}
        statusLine={statusLine}
      />
    </div>
  );
}
