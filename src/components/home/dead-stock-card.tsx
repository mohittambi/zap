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
import type { DeadStockRow } from "@/server/services/homeSummaryService";

const fmt = new Intl.NumberFormat("en-IN");

function formatDays(d: number | null): string {
  if (d == null) return "never";
  if (d >= 365) return `${Math.floor(d / 365)}y`;
  return `${d}d`;
}

export function DeadStockBody({
  rows,
  loading,
}: {
  rows: DeadStockRow[] | undefined;
  loading: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableHead className="font-mono">SKU</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-right">On hand</TableHead>
          <TableHead className="text-right">Last sale</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: 4 }).map((__, j) => (
                <TableCell key={j}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : !rows || rows.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={4}
              className="text-muted-foreground py-8 text-center text-xs"
            >
              No dead stock — every SKU with inventory has moved in the last 60
              days.
            </TableCell>
          </TableRow>
        ) : (
          rows.map((m) => (
            <TableRow key={m.sku_id}>
              <TableCell className="font-mono text-primary text-xs font-semibold">
                {m.sku_id}
              </TableCell>
              <TableCell className="text-muted-foreground max-w-[240px] truncate text-xs">
                {m.description ?? "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums font-medium">
                {fmt.format(m.available_qty)}
              </TableCell>
              <TableCell className="text-amber-700 dark:text-amber-400 text-right tabular-nums text-xs">
                {formatDays(m.days_since_last_sale)}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
