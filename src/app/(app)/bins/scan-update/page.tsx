"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { AppPageTitle } from "@/components/layout/app-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchableSelect } from "@/components/outbound/searchable-select";
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

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <AppPageTitle
          title="Scan update"
          description="Select a bin and product SKU, then add or remove stock."
          className="mb-0"
        />
        <Button asChild variant="outline" className="min-h-11 shrink-0 gap-2">
          <Link href="/bins">
            <ArrowLeft className="size-4 shrink-0" />
            Bins
          </Link>
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scan inputs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
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

            <div className="space-y-2">
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

            {!optionsLoading && binOptions.length === 0 && (
              <p className="text-sm text-muted-foreground">No bins found. Create bins first.</p>
            )}

            {(lookupLoading || lookup) && (
              <div className="rounded-md border px-4 py-3 text-sm">
                {lookupLoading && <span className="text-muted-foreground">Looking up bin…</span>}
                {!lookupLoading && lookup === "not-found" && (
                  <span className="text-destructive">
                    Bin + SKU combination not found. Pick a valid pair from the lists.
                  </span>
                )}
                {!lookupLoading && lookup && lookup !== "not-found" && (
                  <div className="space-y-0.5">
                    <p className="font-medium font-mono">
                      {lookup.bin_id} · {lookup.sku_id}
                    </p>
                    <p className="text-muted-foreground">
                      Warehouse #{lookup.warehouse_id} · Current qty:{" "}
                      <span className="font-semibold tabular-nums">{lookup.available_quantity}</span>
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Adjustment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Operation</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={operation === "ADD" ? "default" : "outline"}
                  className="min-h-11 flex-1"
                  onClick={() => setOperation("ADD")}
                >
                  ➕ Add
                </Button>
                <Button
                  type="button"
                  variant={operation === "REMOVE" ? "default" : "outline"}
                  className="min-h-11 flex-1"
                  onClick={() => setOperation("REMOVE")}
                >
                  ➖ Remove
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                ref={qtyRef}
                type="number"
                min={1}
                value={quantity}
                className="min-h-11 font-mono"
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              className="min-h-11 w-full"
              disabled={submitting || !binId || !skuId}
            >
              {submitting ? "Updating…" : "Update bin inventory"}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
