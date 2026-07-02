"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Trash2, ChevronDown, ChevronRight, History, PackageMinus, Plus, ScanLine } from "lucide-react";
import { apiFetch } from "@/lib/api-browser";
import { AppPageShell, AppPageTitle } from "@/components/layout/app-page-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

import { useAuth } from "@/contexts/auth-context";

type BinBreakdown = { id: number; bin_id: string; available_quantity: number };
type SkuSummary = {
  sku_id: string;
  warehouse_id: number;
  description: string | null;
  total_quantity: number;
  bins: BinBreakdown[];
};

type StockStatus = "out_of_stock" | "low_stock" | "in_stock";
type StockFilter = "all" | StockStatus;

type FilterState = {
  warehouseId: string;
  keyword: string;
  appliedWarehouseId: string;
  appliedKeyword: string;
  stockFilter: StockFilter;
  reorderThreshold: number;
};

type FilterAction =
  | { type: "SET_WAREHOUSE"; value: string }
  | { type: "SET_KEYWORD"; value: string }
  | { type: "APPLY" }
  | { type: "SET_STOCK_FILTER"; value: StockFilter }
  | { type: "SET_THRESHOLD"; value: number };

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case "SET_WAREHOUSE": return { ...state, warehouseId: action.value };
    case "SET_KEYWORD": return { ...state, keyword: action.value };
    case "APPLY": return { ...state, appliedWarehouseId: state.warehouseId, appliedKeyword: state.keyword };
    case "SET_STOCK_FILTER": return { ...state, stockFilter: action.value };
    case "SET_THRESHOLD": return { ...state, reorderThreshold: action.value };
    default: return state;
  }
}

const STATUS_CONFIG: Record<StockStatus, { label: string; qtyClass: string; borderClass: string; pillClass: string }> = {
  out_of_stock: {
    label: "Out of stock",
    qtyClass: "bg-red-100 text-red-700 border-red-200",
    borderClass: "border-red-200",
    pillClass: "bg-red-50 text-red-600 border-red-200",
  },
  low_stock: {
    label: "Low stock",
    qtyClass: "bg-amber-100 text-amber-700 border-amber-200",
    borderClass: "border-amber-200",
    pillClass: "bg-amber-50 text-amber-600 border-amber-200",
  },
  in_stock: {
    label: "In stock",
    qtyClass: "bg-green-100 text-green-700 border-green-200",
    borderClass: "border-green-200",
    pillClass: "bg-green-50 text-green-600 border-green-200",
  },
};

const FILTER_TABS: { value: StockFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "out_of_stock", label: "Out of stock" },
  { value: "low_stock", label: "Low stock" },
  { value: "in_stock", label: "In stock" },
];

function getStockStatus(qty: number, threshold: number): StockStatus {
  if (qty === 0) return "out_of_stock";
  if (qty < threshold) return "low_stock";
  return "in_stock";
}

function countByStatus(skus: SkuSummary[], filter: StockFilter, threshold: number): number {
  if (filter === "all") return skus.length;
  return skus.filter(s => getStockStatus(s.total_quantity, threshold) === filter).length;
}

function applyStockFilter(skus: SkuSummary[], filter: StockFilter, threshold: number): SkuSummary[] {
  if (filter === "all") return skus;
  return skus.filter(s => getStockStatus(s.total_quantity, threshold) === filter);
}

// ── Add Bin Dialog ────────────────────────────────────────────────────────────

function AddBinDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [warehouseId, setWarehouseId] = React.useState("");
  const [skuId, setSkuId] = React.useState("");
  const [binId, setBinId] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  function resetForm() {
    setWarehouseId("");
    setSkuId("");
    setBinId("");
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen && !saving) resetForm();
    onOpenChange(nextOpen);
  }

  async function handleCreate() {
    const wid = Number(warehouseId.trim());
    if (!wid || !skuId.trim() || !binId.trim()) {
      toast.error("All fields are required and warehouse ID must be a number.");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/bins", {
        method: "POST",
        body: JSON.stringify({ warehouse_id: wid, sku_id: skuId.trim(), bin_id: binId.trim() }),
      });
      toast.success(`Bin "${binId.trim()}" created for SKU ${skuId.trim()}.`);
      resetForm();
      onCreated();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create bin");
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") void handleCreate();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Bin Location</DialogTitle>
          <DialogDescription>
            Create a new bin location for a SKU in a warehouse.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nb-wh">Warehouse ID</Label>
            <Input
              id="nb-wh"
              type="number"
              min={1}
              value={warehouseId}
              onChange={e => setWarehouseId(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. 1"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nb-sku">SKU ID</Label>
            <Input
              id="nb-sku"
              value={skuId}
              onChange={e => setSkuId(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. ABC-001"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nb-bin">Bin ID</Label>
            <Input
              id="nb-bin"
              value={binId}
              onChange={e => setBinId(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. A-01-02"
              className="font-mono"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleCreate()} disabled={saving}>
            {saving ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── SKU card ──────────────────────────────────────────────────────────────────

const SkuCard = React.memo(function SkuCard({
  sku,
  threshold,
  canManage,
  onBinDeleted,
}: {
  sku: SkuSummary;
  threshold: number;
  canManage: boolean;
  onBinDeleted: () => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const status = getStockStatus(sku.total_quantity, threshold);
  const cfg = STATUS_CONFIG[status];

  async function handleDeleteBin(bin: BinBreakdown) {
    if (!confirm(`Delete bin "${bin.bin_id}" for SKU ${sku.sku_id}? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/bins/${bin.id}`, { method: "DELETE" });
      toast.success(`Bin "${bin.bin_id}" deleted.`);
      onBinDeleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete bin");
    }
  }

  return (
    <div className={`rounded-lg border bg-white p-4 shadow-sm ${cfg.borderClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-sm font-bold text-primary">{sku.sku_id}</p>
          {sku.description ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{sku.description}</p>
          ) : null}
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-bold tabular-nums ${cfg.qtyClass}`}>
          {sku.total_quantity}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.pillClass}`}>
          {cfg.label}
        </span>
        <button
          className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded(e => !e)}
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {sku.bins.length} {sku.bins.length === 1 ? "bin" : "bins"}
        </button>
      </div>
      {expanded ? (
        <div className="mt-2 space-y-1 border-t pt-2">
          {sku.bins.map(b => (
            <div key={b.bin_id} className="flex items-center justify-between text-xs">
              <span className="font-mono text-muted-foreground">{b.bin_id}</span>
              <div className="flex items-center gap-2">
                <span className="tabular-nums font-medium">{b.available_quantity}</span>
                {canManage ? (
                  <button
                    title={b.available_quantity > 0 ? "Cannot delete — has stock" : "Delete bin"}
                    disabled={b.available_quantity > 0}
                    onClick={() => void handleDeleteBin(b)}
                    className="text-muted-foreground hover:text-destructive disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
});

function SkuGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-lg" />
      ))}
    </div>
  );
}

export default function BinsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("bins", "manage");

  const [state, dispatch] = React.useReducer(filterReducer, {
    warehouseId: "",
    keyword: "",
    appliedWarehouseId: "",
    appliedKeyword: "",
    stockFilter: "all",
    reorderThreshold: 10,
  });

  const [allSkus, setAllSkus] = React.useState<SkuSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showAddBin, setShowAddBin] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ limit: "200" });
      if (state.appliedWarehouseId.trim()) q.set("warehouse_id", state.appliedWarehouseId.trim());
      if (state.appliedKeyword.trim()) q.set("keyword", state.appliedKeyword.trim());
      const res = await apiFetch<{ data: SkuSummary[] }>(`/api/bins/sku-summary?${q}`);
      setAllSkus(res.data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load inventory");
      setAllSkus([]);
    } finally {
      setLoading(false);
    }
  }, [state.appliedWarehouseId, state.appliedKeyword]);

  React.useEffect(() => { void load(); }, [load]);

  const visibleSkus = React.useMemo(
    () => applyStockFilter(allSkus, state.stockFilter, state.reorderThreshold),
    [allSkus, state.stockFilter, state.reorderThreshold]
  );

  function handleApply() {
    dispatch({ type: "APPLY" });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleApply();
  }

  return (
    <AppPageShell className="space-y-6">
      <AppPageTitle title="Bins" description="SKU-level stock view with bin breakdown." className="mb-0" />

      <div className="rounded-xl border bg-card p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:justify-between">
          {canManage ? (
            <Button
              className="order-first h-10 w-full gap-2 lg:order-last lg:w-auto lg:min-w-[9.5rem]"
              onClick={() => setShowAddBin(true)}
            >
              <Plus className="size-4 shrink-0" />
              Add Bin
            </Button>
          ) : null}
          <div className="order-last grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3 lg:order-first">
            <Button asChild variant="outline" size="sm" className="h-10 justify-start gap-2">
              <Link href="/bins/changes">
                <History className="size-4 shrink-0" />
                Bin changes
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-10 justify-start gap-2">
              <Link href="/bins/outward">
                <PackageMinus className="size-4 shrink-0" />
                Bulk outward
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm" className="h-10 justify-start gap-2">
              <Link href="/bins/scan-update">
                <ScanLine className="size-4 shrink-0" />
                Scan update
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {canManage ? (
        <AddBinDialog
          open={showAddBin}
          onOpenChange={setShowAddBin}
          onCreated={() => { void load(); }}
        />
      ) : null}

      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-5">
        <div className="space-y-1.5">
          <Label htmlFor="wh" className="text-xs">Warehouse ID</Label>
          <Input
            id="wh"
            value={state.warehouseId}
            onChange={e => dispatch({ type: "SET_WAREHOUSE", value: e.target.value })}
            onKeyDown={handleKeyDown}
            placeholder="e.g. 1"
            className="h-9 w-32 font-mono text-sm"
          />
        </div>
        <div className="min-w-[12rem] flex-1 space-y-1.5 sm:min-w-[16rem]">
          <Label htmlFor="kw" className="text-xs">Search SKU / description</Label>
          <Input
            id="kw"
            value={state.keyword}
            onChange={e => dispatch({ type: "SET_KEYWORD", value: e.target.value })}
            onKeyDown={handleKeyDown}
            placeholder="Search…"
            className="h-9 w-full text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="thr" className="text-xs">Reorder threshold</Label>
          <Input
            id="thr"
            type="number"
            min={1}
            value={state.reorderThreshold}
            onChange={e => dispatch({ type: "SET_THRESHOLD", value: Math.max(1, Number(e.target.value)) })}
            className="h-9 w-24 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="pointer-events-none text-xs invisible" aria-hidden="true">
            Apply
          </Label>
          <Button className="h-9" onClick={handleApply}>
            Apply
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map(tab => {
          const count = countByStatus(allSkus, tab.value, state.reorderThreshold);
          const isActive = state.stockFilter === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => dispatch({ type: "SET_STOCK_FILTER", value: tab.value })}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${isActive ? "bg-primary-foreground/20" : "bg-muted"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <SkuGridSkeleton />
      ) : visibleSkus.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          {allSkus.length === 0 ? "No bins found. Try adjusting the warehouse or search." : "No SKUs match the selected stock filter."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visibleSkus.map(sku => (
            <SkuCard
              key={`${sku.warehouse_id}-${sku.sku_id}`}
              sku={sku}
              threshold={state.reorderThreshold}
              canManage={canManage}
              onBinDeleted={() => { void load(); }}
            />
          ))}
        </div>
      )}
    </AppPageShell>
  );
}
