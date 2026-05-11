"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { WarehouseIcon, MapPinIcon, PackageIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

type SkuSummary = {
  sku_id: string;
  description: string | null;
  total_quantity: number;
  bins: { id: number; bin_id: string; available_quantity: number }[];
};

function renderBinsRows(loading: boolean, skus: SkuSummary[]) {
  if (loading) {
    return ["r1", "r2", "r3", "r4"].map((r) => (
      <TableRow key={r}>
        {["c1", "c2", "c3", "c4"].map((c) => (
          <TableCell key={c}><Skeleton className="h-5 w-full" /></TableCell>
        ))}
      </TableRow>
    ));
  }
  if (skus.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={4} className="text-muted-foreground py-8 text-center text-sm">
          No bins assigned to this warehouse.
        </TableCell>
      </TableRow>
    );
  }
  return skus.flatMap((sku) =>
    sku.bins.map((bin) => (
      <TableRow key={bin.id}>
        <TableCell className="font-mono text-xs font-semibold text-primary">
          <Link href={`/listings/${encodeURIComponent(sku.sku_id)}`} className="hover:underline">
            {sku.sku_id}
          </Link>
        </TableCell>
        <TableCell className="text-muted-foreground max-w-[220px] truncate text-xs">
          {sku.description ?? "—"}
        </TableCell>
        <TableCell className="font-mono text-xs">{bin.bin_id}</TableCell>
        <TableCell className="text-right tabular-nums text-sm">{bin.available_quantity}</TableCell>
      </TableRow>
    ))
  );
}

function statusLabel(s: string): string {
  if (s === "1" || s === "true") return "Active";
  if (s === "0" || s === "false") return "Inactive";
  return s;
}

function StatusBadge({ status }: Readonly<{ status: string }>) {
  const isActive = status === "1" || status === "true" || status.toLowerCase() === "active";
  return <Badge variant={isActive ? "default" : "secondary"}>{statusLabel(status)}</Badge>;
}

function StatBox({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="bg-muted/50 rounded-lg border p-3">
      <p className="text-muted-foreground mb-1 text-[10px] font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className="font-mono text-sm font-semibold">{value || "—"}</p>
    </div>
  );
}

export default function WarehouseDetailPage() {
  const params = useParams();
  const id = str(params.id ?? "");
  const [data, setData] = React.useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [skus, setSkus] = React.useState<SkuSummary[]>([]);
  const [skusLoading, setSkusLoading] = React.useState(false);

  React.useEffect(() => {
    if (!id) return;
    setSkusLoading(true);
    let c = false;
    apiFetch<{ data: SkuSummary[] }>(`/api/bins?warehouse_id=${encodeURIComponent(id)}&page=1&limit=200`)
      .then((r) => { if (!c) setSkus(r.data); })
      .catch(() => {})
      .finally(() => { if (!c) setSkusLoading(false); });
    return () => { c = true; };
  }, [id]);

  React.useEffect(() => {
    let c = false;
    (async () => {
      try {
        const res = await apiFetch<Record<string, unknown>>(
          `/api/warehouses/${encodeURIComponent(id)}`
        );
        if (!c) setData(res);
      } catch (e) {
        if (!c) toast.error(e instanceof Error ? e.message : "Not found");
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => { c = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        <p className="text-muted-foreground">Warehouse not found.</p>
        <Button asChild variant="outline">
          <Link href="/warehouses">← Back to Warehouses</Link>
        </Button>
      </div>
    );
  }

  const name = str(data.name ?? data.warehouse_name);
  const code = str(data.warehouse_code ?? data.code);
  const city = str(data.city);
  const state = str(data.state);
  const address = str(data.address ?? data.address_line1);
  const pincode = str(data.pincode ?? data.pin_code);
  const type = str(data.type ?? data.warehouse_type);
  const status = str(data.status ?? data.is_active);
  const locationParts = [address, city, state, pincode].filter(Boolean);
  const location = locationParts.join(", ");

  const known = new Set([
    "id", "name", "warehouse_name", "warehouse_code", "code", "city", "state",
    "address", "address_line1", "pincode", "pin_code", "type", "warehouse_type",
    "status", "is_active", "created_at", "updated_at",
  ]);
  const extras = Object.entries(data).filter(
    ([k, v]) => !known.has(k) && v != null && String(v).trim() !== ""
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/warehouses">← Warehouses</Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">
            <WarehouseIcon className="mr-2 inline size-6 opacity-70" />
            {name || `Warehouse #${id}`}
          </h1>
          {status ? <StatusBadge status={status} /> : null}
          {type ? <Badge variant="outline">{type}</Badge> : null}
        </div>
        <p className="text-muted-foreground font-mono text-sm">ID: {id}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatBox label="Warehouse ID" value={id} />
        {code ? <StatBox label="Code" value={code} /> : null}
        {city ? <StatBox label="City" value={city} /> : null}
      </div>

      {location ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <MapPinIcon className="size-4" />
              Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{location}</p>
          </CardContent>
        </Card>
      ) : null}

      {extras.length > 0 ? (
        <>
          <Separator />
          <div>
            <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wide">
              Additional fields
            </p>
            <dl className="grid gap-2 sm:grid-cols-2">
              {extras.map(([k, v]) => (
                <div key={k} className="bg-muted/30 rounded-md border px-3 py-2">
                  <dt className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
                    {k.replaceAll("_", " ")}
                  </dt>
                  <dd className={cn("mt-0.5 text-sm break-words", typeof v === "number" && "font-mono")}>
                    {String(v)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </>
      ) : null}

      <Separator />
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <PackageIcon className="size-4" />
            Bins in this warehouse
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60 hover:bg-muted/60">
                <TableHead>SKU</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Bin</TableHead>
                <TableHead className="text-right">Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {renderBinsRows(skusLoading, skus)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
