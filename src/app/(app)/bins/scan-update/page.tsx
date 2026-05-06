"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

export default function BinScanUpdatePage() {
  const [binId, setBinId] = React.useState("");
  const [skuId, setSkuId] = React.useState("");
  const [operation, setOperation] = React.useState<"ADD" | "REMOVE">("ADD");
  const [quantity, setQuantity] = React.useState("1");
  const [lookup, setLookup] = React.useState<BinRow | null | "not-found">(null);
  const [lookupLoading, setLookupLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const binRef = React.useRef<HTMLInputElement>(null);
  const skuRef = React.useRef<HTMLInputElement>(null);
  const qtyRef = React.useRef<HTMLInputElement>(null);

  const triggerLookup = React.useCallback(async (bid: string, sid: string) => {
    if (!bid.trim() || !sid.trim()) return;
    setLookupLoading(true);
    setLookup(null);
    try {
      const q = new URLSearchParams({ bin_id: bid.trim(), sku_id: sid.trim(), limit: "1", page: "1" });
      const res = await apiFetch<{ data: BinRow[] }>(`/api/bins?${q}`);
      setLookup(res.data?.[0] ?? "not-found");
    } catch {
      setLookup("not-found");
    } finally {
      setLookupLoading(false);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!binId.trim()) {
      toast.error("Bin ID is required");
      binRef.current?.focus();
      return;
    }
    if (!skuId.trim()) {
      toast.error("SKU / barcode is required");
      skuRef.current?.focus();
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
      binRef.current?.focus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Bin inventory update</h1>
          <p className="text-sm text-muted-foreground">Scan or type a Bin ID and product barcode, then add or remove stock.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/bins">← Bins</Link>
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
              <Input
                id="bin-id"
                ref={binRef}
                value={binId}
                autoFocus
                autoComplete="off"
                className="font-mono min-h-11"
                placeholder="Scan or type bin label…"
                onChange={(e) => { setBinId(e.target.value); setLookup(null); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    skuRef.current?.focus();
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sku-id">Product barcode / SKU</Label>
              <Input
                id="sku-id"
                ref={skuRef}
                value={skuId}
                autoComplete="off"
                className="font-mono min-h-11"
                placeholder="Scan or type product barcode…"
                onChange={(e) => { setSkuId(e.target.value); setLookup(null); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void triggerLookup(binId, e.currentTarget.value);
                    qtyRef.current?.focus();
                  }
                }}
              />
            </div>

            {(lookupLoading || lookup) && (
              <div className="rounded-md border px-4 py-3 text-sm">
                {lookupLoading && <span className="text-muted-foreground">Looking up bin…</span>}
                {!lookupLoading && lookup === "not-found" && (
                  <span className="text-destructive">Bin + SKU combination not found. Verify the scanned values.</span>
                )}
                {!lookupLoading && lookup && lookup !== "not-found" && (
                  <div className="space-y-0.5">
                    <p className="font-medium font-mono">{lookup.bin_id} · {lookup.sku_id}</p>
                    <p className="text-muted-foreground">Warehouse #{lookup.warehouse_id} · Current qty: <span className="font-semibold tabular-nums">{lookup.available_quantity}</span></p>
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
                  className="flex-1 min-h-11"
                  onClick={() => setOperation("ADD")}
                >
                  ➕ Add
                </Button>
                <Button
                  type="button"
                  variant={operation === "REMOVE" ? "default" : "outline"}
                  className="flex-1 min-h-11"
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void triggerLookup(binId, skuId);
                  }
                }}
              />
            </div>

            <Button
              type="submit"
              className="w-full min-h-11"
              disabled={submitting}
            >
              {submitting ? "Updating…" : "Update bin inventory"}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
