"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
type BinRow = {
  id: number;
  warehouse_id: number;
  sku_id: string;
  bin_id: string;
  available_quantity: number;
};

export default function BinsPage() {
  const [warehouseId, setWarehouseId] = React.useState("");
  const [skuId, setSkuId] = React.useState("");
  const [appliedWh, setAppliedWh] = React.useState("");
  const [appliedSku, setAppliedSku] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<{
    total: number;
    data: BinRow[];
  } | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), limit: "100" });
      if (appliedWh.trim()) q.set("warehouse_id", appliedWh.trim());
      if (appliedSku.trim()) q.set("sku_id", appliedSku.trim());
      const res = await apiFetch<{ total: number; data: BinRow[] }>(
        `/api/bins?${q}`
      );
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, appliedWh, appliedSku]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Bins</h1>
        <p className="text-sm text-muted-foreground">
          Filter by warehouse and/or SKU. Paginated.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="wh">warehouse_id</Label>
            <Input
              id="wh"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="min-h-11 font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sk">sku_id</Label>
            <Input
              id="sk"
              value={skuId}
              onChange={(e) => setSkuId(e.target.value)}
              className="min-h-11 font-mono"
            />
          </div>
          <div className="sm:col-span-2">
            <Button
              className="min-h-11"
              onClick={() => {
                setAppliedWh(warehouseId);
                setAppliedSku(skuId);
                setPage(1);
              }}
            >
              Apply filters
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60 hover:bg-muted/60">
                <TableHead>ID</TableHead>
                <TableHead>WH</TableHead>
                <TableHead className="font-mono">SKU</TableHead>
                <TableHead className="font-mono">Bin</TableHead>
                <TableHead className="text-right">Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {[1, 2, 3, 4, 5].map((j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                : !data?.data?.length
                ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground py-10 text-center text-sm">
                      No bins match the current filters.
                    </TableCell>
                  </TableRow>
                )
                : data.data.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-xs">{b.id}</TableCell>
                      <TableCell>{b.warehouse_id}</TableCell>
                      <TableCell className="font-mono text-sm">{b.sku_id}</TableCell>
                      <TableCell className="font-mono text-sm">{b.bin_id}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {b.available_quantity}
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
          {!loading && data?.data?.length ? (
            <div className="flex justify-between border-t px-4 py-3">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
