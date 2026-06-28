"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { InsightsShell } from "@/components/insights/insights-shell";
import { SearchableSelect } from "@/components/outbound/searchable-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

type ForecastBundle = {
  sku_id: string;
  // mape is null when JSON-serialised from Infinity (insufficient sales history).
  forecast: { method: string; forecast: number[]; mape: number | null };
  smart_reorder: {
    safety_stock: number;
    reorder_point: number;
    eoq: number;
    suggested_order_qty: number;
  };
  unit_cost: number;
};

type SkuNameRow = {
  sku_id: string;
  description: string | null;
};

export default function InsightsForecastingPage() {
  const [skuId, setSkuId] = React.useState<string | null>(null);
  const [skuOptions, setSkuOptions] = React.useState<
    Array<{ key: string; label: string }>
  >([]);
  const [optionsLoading, setOptionsLoading] = React.useState(true);
  const [data, setData] = React.useState<ForecastBundle | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    void (async () => {
      try {
        const rows = await apiFetch<SkuNameRow[]>("/api/listings/sku/names");
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
      } finally {
        setOptionsLoading(false);
      }
    })();
  }, []);

  const loadForecast = React.useCallback(async (id: string) => {
    const trimmed = id.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const bundle = await apiFetch<ForecastBundle>(
        `/api/insights/forecast/${encodeURIComponent(trimmed)}`
      );
      setData(bundle);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Forecast failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <InsightsShell
      title="Demand Forecasting"
      description="Per-SKU forecast with safety stock and EOQ reorder recommendations."
    >
      <div className="mb-4 flex max-w-lg flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor="forecast-sku">SKU</Label>
          <SearchableSelect
            value={skuId}
            onChange={(next) => {
              setSkuId(next);
              void loadForecast(next);
            }}
            options={skuOptions}
            placeholder={optionsLoading ? "Loading SKUs…" : "Search or select SKU…"}
            emptyText="No SKUs match"
            variant="outline"
            disabled={optionsLoading}
            mono
          />
        </div>
        <Button
          type="button"
          onClick={() => skuId && void loadForecast(skuId)}
          disabled={loading || !skuId || optionsLoading}
        >
          {loading ? "Loading…" : "Forecast"}
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Forecast ({data.forecast.method})</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-2 text-xs">
                MAPE:{" "}
                {data.forecast.mape != null && Number.isFinite(data.forecast.mape)
                  ? `${data.forecast.mape.toFixed(1)}%`
                  : "N/A (insufficient history)"}
              </p>
              <p className="font-mono text-sm">
                Next 14d:{" "}
                {data.forecast.forecast.map((v) => (v ?? 0).toFixed(1)).join(", ")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Smart reorder</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Safety stock: {data.smart_reorder.safety_stock}</p>
              <p>Reorder point: {data.smart_reorder.reorder_point}</p>
              <p>EOQ: {data.smart_reorder.eoq}</p>
              <p className="font-semibold">
                Suggested order: {data.smart_reorder.suggested_order_qty} units
              </p>
              <p className="text-muted-foreground text-xs">Unit cost proxy: ₹{data.unit_cost.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Search and select a SKU to run demand forecast and reorder math.
        </p>
      )}
    </InsightsShell>
  );
}
