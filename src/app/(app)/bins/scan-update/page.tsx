"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Minus, Package, Plus, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { AppPageShell, AppPageTitle } from "@/components/layout/app-page-shell";
import { SearchableSelect } from "@/components/outbound/searchable-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type BinRow = {
  id: number;
  warehouse_id: number;
  sku_id: string;
  bin_id: string;
  available_quantity: number;
};

type ScanUpdateResult = {
  bin: BinRow;
  new_quantity: number;
};

async function fetchAllBins(): Promise<BinRow[]> {
  const rows: BinRow[] = [];
  let page = 1;
  const limit = 500;
  for (;;) {
    const q = new URLSearchParams({ page: String(page), limit: String(limit) });
    const res = await apiFetch<{ data: BinRow[]; total?: number }>(`/api/bins?${q}`);
    const batch = res.data ?? [];
    rows.push(...batch);
    if (batch.length < limit) break;
    page += 1;
    if (page > 50) break;
  }
  return rows;
}

function LookupPreview({
  lookup,
  lookupLoading,
}: {
  lookup: BinRow | null | "not-found";
  lookupLoading: boolean;
}) {
  if (!lookupLoading && !lookup) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center">
        <Package className="mx-auto mb-2 size-8 text-muted-foreground/60" />
        <p className="text-muted-foreground text-sm">
          Choose a bin and SKU to preview current stock before adjusting.
        </p>
      </div>
    );
  }

  if (lookupLoading) {
    return (
      <div className="rounded-lg border bg-muted/30 px-4 py-4 text-sm text-muted-foreground">
        Looking up bin location…
      </div>
    );
  }

  if (lookup === "not-found") {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-4 text-sm text-destructive">
        This bin and SKU combination was not found. Pick a matching pair from the lists.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-green-200 bg-green-50/80 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="font-mono text-sm font-semibold text-primary">
            {lookup.bin_id} · {lookup.sku_id}
          </p>
          <p className="text-muted-foreground text-xs">
            Warehouse #{lookup.warehouse_id}
          </p>
        </div>
        <Badge className="shrink-0 border-green-200 bg-white text-green-800 hover:bg-white">
          Qty {lookup.available_quantity}
        </Badge>
      </div>
    </div>
  );
}

export default function BinScanUpdatePage() {
  const [binId, setBinId] = React.useState("");
  const [skuId, setSkuId] = React.useState("");
  const [operation, setOperation] = React.useState<"ADD" | "REMOVE">("ADD");
  const [quantity, setQuantity] = React.useState("1");
  const [allBins, setAllBins] = React.useState<BinRow[]>([]);
  const [optionsLoading, setOptionsLoading] = React.useState(true);
  const [lookup, setLookup] = React.useState<BinRow | null | "not-found">(null);
  const [lookupLoading, setLookupLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const qtyRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchAllBins();
        if (!cancelled) setAllBins(rows);
      } catch {
        if (!cancelled) {
          setAllBins([]);
          toast.error("Failed to load bin options");
        }
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const binOptions = React.useMemo(() => {
    const pool = skuId.trim()
      ? allBins.filter((r) => r.sku_id === skuId.trim())
      : allBins;
    return [...new Set(pool.map((r) => r.bin_id))].sort((a, b) => a.localeCompare(b));
  }, [allBins, skuId]);

  const skuOptions = React.useMemo(() => {
    const pool = binId.trim()
      ? allBins.filter((r) => r.bin_id === binId.trim())
      : allBins;
    return [...new Set(pool.map((r) => r.sku_id))].sort((a, b) => a.localeCompare(b));
  }, [allBins, binId]);

  const binSelectOptions = React.useMemo(
    () => binOptions.map((id) => ({ key: id, label: id })),
    [binOptions]
  );

  const skuSelectOptions = React.useMemo(
    () => skuOptions.map((id) => ({ key: id, label: id })),
    [skuOptions]
  );

  const triggerLookup = React.useCallback(async (bid: string, sid: string) => {
    if (!bid.trim() || !sid.trim()) return;
    setLookupLoading(true);
    setLookup(null);
    try {
      const match = allBins.find(
        (r) => r.bin_id === bid.trim() && r.sku_id === sid.trim()
      );
      if (match) {
        setLookup(match);
        return;
      }
      const q = new URLSearchParams({ bin_id: bid.trim(), sku_id: sid.trim(), limit: "1", page: "1" });
      const res = await apiFetch<{ data: BinRow[] }>(`/api/bins?${q}`);
      setLookup(res.data?.[0] ?? "not-found");
    } catch {
      setLookup("not-found");
    } finally {
      setLookupLoading(false);
    }
  }, [allBins]);

  React.useEffect(() => {
    if (binId.trim() && skuId.trim()) {
      void triggerLookup(binId, skuId);
    } else {
      setLookup(null);
    }
  }, [binId, skuId, triggerLookup]);

  const hasValidLookup = lookup != null && lookup !== "not-found";
  const canSubmit = Boolean(binId && skuId && hasValidLookup && !submitting);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!binId.trim()) {
      toast.error("Bin ID is required");
      return;
    }
    if (!skuId.trim()) {
      toast.error("SKU / barcode is required");
      return;
    }
    if (!hasValidLookup) {
      toast.error("Select a valid bin and SKU combination first");
      return;
    }
    const qty = parseInt(quantity, 10);
    if (!Number.isInteger(qty) || qty <= 0) {
      toast.error("Quantity must be a positive whole number");
      qtyRef.current?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const result = await apiFetch<ScanUpdateResult>("/api/bins/scan-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bin_id: binId.trim(), sku_id: skuId.trim(), operation, quantity: qty }),
      });
      toast.success(
        `${operation === "ADD" ? "Added" : "Removed"} ${qty} · Bin ${binId.trim()} · SKU ${skuId.trim()} · New qty: ${result.new_quantity}`
      );
      setBinId("");
      setSkuId("");
      setQuantity("1");
      setLookup(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSubmitting(false);
    }
  }

  const stepTwoReady = Boolean(binId && skuId);

  return (
    <AppPageShell className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <AppPageTitle
            title="Scan update"
            description="Select a bin and product SKU, then add or remove stock."
            className="mb-0"
          />
        </div>
        <Button asChild variant="outline" className="min-h-11 shrink-0 gap-2">
          <Link href="/bins">
            <ArrowLeft className="size-4 shrink-0" />
            Bins
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium",
            stepTwoReady
              ? "border-primary/20 bg-primary/5 text-primary"
              : "border-primary bg-primary text-primary-foreground"
          )}
        >
          <ScanLine className="size-3.5" />
          1. Locate bin
        </span>
        <span className="text-muted-foreground">→</span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium",
            stepTwoReady
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-muted/40 text-muted-foreground"
          )}
        >
          <Package className="size-3.5" />
          2. Adjust stock
        </span>
      </div>

      <form onSubmit={handleSubmit} className="grid w-full gap-6 lg:grid-cols-2 lg:items-start">
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Scan inputs</CardTitle>
            <CardDescription>
              Search or pick the warehouse bin and SKU you want to update.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bin-id">Bin ID</Label>
                <SearchableSelect
                  value={binId || null}
                  onChange={(next) => {
                    setBinId(next);
                    if (skuId && next) {
                      const valid = allBins.some(
                        (r) => r.bin_id === next && r.sku_id === skuId
                      );
                      if (!valid) setSkuId("");
                    }
                  }}
                  options={binSelectOptions}
                  placeholder={optionsLoading ? "Loading bins…" : "Search or select bin…"}
                  emptyText="No bins match"
                  variant="outline"
                  disabled={optionsLoading}
                  mono
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sku-id">Product barcode / SKU</Label>
                <SearchableSelect
                  value={skuId || null}
                  onChange={(next) => {
                    setSkuId(next);
                    if (binId && next) {
                      const valid = allBins.some(
                        (r) => r.bin_id === binId && r.sku_id === next
                      );
                      if (!valid) setBinId("");
                    }
                  }}
                  options={skuSelectOptions}
                  placeholder={optionsLoading ? "Loading SKUs…" : "Search or select SKU…"}
                  emptyText="No SKUs match"
                  variant="outline"
                  disabled={optionsLoading}
                  mono
                />
              </div>
            </div>

            {!optionsLoading && binOptions.length === 0 && (
              <p className="text-muted-foreground text-sm">
                No bins found. Create bins first from the Bins page.
              </p>
            )}

            <LookupPreview lookup={lookup} lookupLoading={lookupLoading} />
          </CardContent>
        </Card>

        <Card
          className={cn(
            "shadow-sm transition-opacity",
            !stepTwoReady && "opacity-60"
          )}
        >
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Adjustment</CardTitle>
            <CardDescription>
              Add or remove units once the bin location is confirmed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label>Operation</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={operation === "ADD" ? "default" : "outline"}
                  className="h-10 gap-2"
                  disabled={!stepTwoReady}
                  onClick={() => setOperation("ADD")}
                >
                  <Plus className="size-4 shrink-0" />
                  Add stock
                </Button>
                <Button
                  type="button"
                  variant={operation === "REMOVE" ? "default" : "outline"}
                  className="h-10 gap-2"
                  disabled={!stepTwoReady}
                  onClick={() => setOperation("REMOVE")}
                >
                  <Minus className="size-4 shrink-0" />
                  Remove stock
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                ref={qtyRef}
                type="number"
                min={1}
                value={quantity}
                disabled={!stepTwoReady}
                className="h-10 max-w-[8rem] font-mono"
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>

            {hasValidLookup && lookup !== "not-found" && lookup != null ? (
              <p className="text-muted-foreground text-xs">
                After {operation === "ADD" ? "adding" : "removing"} {quantity || "0"},{" "}
                expected qty:{" "}
                <span className="font-mono font-semibold text-foreground">
                  {operation === "ADD"
                    ? lookup.available_quantity + (Number(quantity) || 0)
                    : Math.max(0, lookup.available_quantity - (Number(quantity) || 0))}
                </span>
              </p>
            ) : null}

            <Button
              type="submit"
              className="h-10 w-full sm:w-auto sm:min-w-[11rem]"
              disabled={!canSubmit}
            >
              {submitting ? "Updating…" : "Update bin inventory"}
            </Button>
          </CardContent>
        </Card>
      </form>
    </AppPageShell>
  );
}
