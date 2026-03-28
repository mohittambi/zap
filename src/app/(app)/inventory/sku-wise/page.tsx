"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function SkuWiseInner() {
  const searchParams = useSearchParams();
  const initial = searchParams.get("sku") ?? searchParams.get("secondary_sku") ?? "";
  const [draft, setDraft] = React.useState(initial);
  const [data, setData] = React.useState<unknown>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async (q: string) => {
    if (!q.trim()) {
      toast.message("Enter a SKU");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<unknown>(
        `/api/inventory/secondary_listings/sku_wise_details?secondary_sku=${encodeURIComponent(q.trim())}`
      );
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (initial) void load(initial);
  }, [initial, load]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">SKU-wise details</h1>
        <p className="text-sm text-muted-foreground">
          Resolves secondary SKU to master, inventory, and pack/combo context.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Query</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="sku">secondary_sku or sku</Label>
            <Input
              id="sku"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void load(draft);
                }
              }}
              className="min-h-11 font-mono"
            />
          </div>
          <Button
            className="min-h-11"
            onClick={() => {
              void load(draft);
            }}
          >
            Load
          </Button>
        </CardContent>
      </Card>
      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : data ? (
        <Card>
          <CardContent className="pt-6">
            <pre className="max-h-[70dvh] overflow-auto font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
              {JSON.stringify(data, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">Enter a SKU to load.</p>
      )}
    </div>
  );
}

export default function SkuWisePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <SkuWiseInner />
    </Suspense>
  );
}
