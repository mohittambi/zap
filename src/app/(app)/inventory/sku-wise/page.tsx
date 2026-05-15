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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function FieldChip({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="bg-muted/50 rounded-lg border px-3 py-2">
      <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">{label}</p>
      <p className={cn("mt-0.5 text-sm font-medium", mono && "font-mono")}>{value}</p>
    </div>
  );
}

function SectionCard({
  title,
  data,
}: {
  title: string;
  data: Record<string, unknown> | null | undefined;
}) {
  if (!data || typeof data !== "object") return null;
  const entries = Object.entries(data).filter(([, v]) => v != null && str(v) !== "");
  if (!entries.length) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map(([k, v]) => (
            <div key={k} className="bg-muted/30 rounded-md border px-3 py-2">
              <dt className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
                {k.replaceAll("_", " ")}
              </dt>
              <dd className={cn("mt-0.5 text-xs break-words", typeof v === "number" && "font-mono font-semibold")}>
                {Array.isArray(v) ? `[${v.length} items]` : String(v)}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function SkuWiseResult({ data }: { data: unknown }) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return (
      <Card>
        <CardContent className="pt-4">
          <pre className="font-mono text-xs whitespace-pre-wrap break-all">
            {JSON.stringify(data, null, 2)}
          </pre>
        </CardContent>
      </Card>
    );
  }

  const d = data as Record<string, unknown>;

  const master = d.master_listing ?? d.master ?? d.masterListing;
  const secondary = d.secondary_listing ?? d.secondary ?? d.secondaryListing;
  const pack = d.pack_combo ?? d.packCombo ?? d.pack;
  const inventory = d.inventory ?? d.inventoryData;

  const topFields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) {
    if (
      typeof v !== "object" &&
      v != null &&
      !["master_listing", "master", "masterListing", "secondary_listing", "secondary",
        "secondaryListing", "pack_combo", "packCombo", "pack", "inventory", "inventoryData"].includes(k)
    ) {
      topFields[k] = v;
    }
  }

  const topEntries = Object.entries(topFields).filter(([, v]) => v != null && str(v) !== "");

  return (
    <div className="space-y-4">
      {topEntries.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {topEntries.map(([k, v]) => (
            <FieldChip
              key={k}
              label={k.replaceAll("_", " ")}
              value={str(v)}
              mono={typeof v === "number" || k.toLowerCase().includes("sku") || k.toLowerCase().includes("id")}
            />
          ))}
        </div>
      ) : null}
      {master ? <SectionCard title="Master listing" data={master as Record<string, unknown>} /> : null}
      {secondary ? <SectionCard title="Secondary listing" data={secondary as Record<string, unknown>} /> : null}
      {pack ? <SectionCard title="Pack / Combo" data={pack as Record<string, unknown>} /> : null}
      {inventory ? <SectionCard title="Inventory" data={inventory as Record<string, unknown>} /> : null}
    </div>
  );
}

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
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : data ? (
        <SkuWiseResult data={data} />
      ) : (
        <p className="text-muted-foreground text-sm">Enter a SKU to load details.</p>
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
