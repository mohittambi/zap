"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function WarehouseInventoryPage() {
  const [draftSku, setDraftSku] = React.useState("");
  const [appliedSku, setAppliedSku] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<unknown>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!appliedSku.trim()) {
      return;
    }
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), count: "200" });
      const res = await apiFetch<unknown>(
        `/api/warehouse_inventory_dump/sku_id/by_page/${encodeURIComponent(appliedSku.trim())}?${q}`
      );
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [appliedSku, page]);

  React.useEffect(() => {
    if (!appliedSku.trim()) return;
    void load();
  }, [load, appliedSku, page]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Warehouse inventory log</h1>
        <p className="text-sm text-muted-foreground">
          Operations log per SKU (paginated).
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Query</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="sku">SKU</Label>
            <Input
              id="sku"
              value={draftSku}
              onChange={(e) => setDraftSku(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const s = draftSku.trim();
                  if (!s) {
                    toast.message("Enter a SKU");
                    return;
                  }
                  setAppliedSku(s);
                  setPage(1);
                }
              }}
              className="min-h-11 font-mono"
            />
          </div>
          <Button
            className="min-h-11"
            onClick={() => {
              const s = draftSku.trim();
              if (!s) {
                toast.message("Enter a SKU");
                return;
              }
              setAppliedSku(s);
              setPage(1);
            }}
          >
            Load
          </Button>
        </CardContent>
      </Card>
      {loading && appliedSku ? (
        <Skeleton className="h-96 w-full" />
      ) : data && appliedSku ? (
        <Card>
          <CardContent className="pt-6">
            <div className="mb-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
            <pre className="max-h-[65dvh] overflow-auto font-mono text-xs whitespace-pre-wrap break-all">
              {JSON.stringify(data, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
