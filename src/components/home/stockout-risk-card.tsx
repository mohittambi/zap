"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { StockoutRiskRow } from "@/server/services/homeSummaryService";

const fmt = new Intl.NumberFormat("en-IN");

function coverColor(d: number | null): string {
  if (d == null) return "text-muted-foreground";
  if (d < 3) return "text-red-600 dark:text-red-400";
  if (d < 7) return "text-amber-700 dark:text-amber-400";
  return "text-muted-foreground";
}

export function StockoutRiskBody({
  rows,
  loading,
}: {
  rows: StockoutRiskRow[] | undefined;
  loading: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableHead className="font-mono">SKU</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-right">On hand</TableHead>
          <TableHead className="text-right">30d sales</TableHead>
          <TableHead className="text-right">Cover</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: 5 }).map((__, j) => (
                <TableCell key={j}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : !rows || rows.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={5}
              className="text-muted-foreground py-8 text-center text-xs"
            >
              No SKUs at stockout risk — every active SKU has ≥ 14 days of
              cover.
            </TableCell>
          </TableRow>
        ) : (
          rows.map((m) => (
            <TableRow key={m.sku_id}>
              <TableCell className="font-mono text-primary text-xs font-semibold">
                {m.sku_id}
              </TableCell>
              <TableCell className="text-muted-foreground max-w-[200px] truncate text-xs">
                {m.description ?? "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {fmt.format(m.available_qty)}
              </TableCell>
              <TableCell className="text-muted-foreground text-right tabular-nums">
                {fmt.format(m.sold_30d)}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right tabular-nums font-medium",
                  coverColor(m.days_of_cover)
                )}
              >
                {m.days_of_cover == null
                  ? "—"
                  : `${m.days_of_cover.toFixed(1)}d`}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
