"use client";

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

export function ReorderAlertsBody({
  data,
  loading,
}: {
  data: HomeSummary | null;
  loading: boolean;
}) {
  const rows = data?.reorder_top ?? [];
  return (
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
  );
}
