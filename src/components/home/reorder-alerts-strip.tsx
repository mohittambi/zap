"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { HomeSummary } from "@/server/services/homeSummaryService";

export function ReorderAlertsStrip({
  data,
  loading,
}: {
  data: HomeSummary | null;
  loading: boolean;
}) {
  const rows = data?.reorder_top ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-sm">Reorder alerts</CardTitle>
          <p className="text-muted-foreground text-xs">
            Top SKUs where current + expected stock falls below threshold.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data ? (
            <Badge variant="cancelled">{data.kpis.skus_below_reorder.value} alerts</Badge>
          ) : null}
          <Button asChild size="sm" variant="outline">
            <Link href="/reorder">View all</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="font-mono">SKU</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Min reorder</TableHead>
              <TableHead className="text-right">30d sales</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-8 text-center text-xs">
                  No reorder alerts. All SKUs are above threshold.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((m) => (
                <TableRow key={m.sku_id}>
                  <TableCell className="font-mono text-primary text-xs font-semibold">
                    {m.sku_id}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[280px] truncate text-xs">
                    {m.description ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{m.available_qty}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {m.min_reorder_qty}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right tabular-nums">
                    {m.sold_30d}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
