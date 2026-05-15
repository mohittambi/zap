"use client";

import * as React from "react";
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
import type { SkuMovementRow } from "@/server/services/homeSummaryService";

type Window = "30d" | "60d" | "90d";

const fmt = new Intl.NumberFormat("en-IN");

function qtyFor(row: SkuMovementRow, w: Window): number {
  if (w === "30d") return row.qty_30d;
  if (w === "60d") return row.qty_60d;
  return row.qty_90d;
}

export function SkuMovementBody({
  rows,
  loading,
}: {
  rows: SkuMovementRow[] | undefined;
  loading: boolean;
}) {
  const [sortBy, setSortBy] = React.useState<Window>("30d");

  const sorted = React.useMemo(() => {
    if (!rows) return [];
    return [...rows].sort((a, b) => qtyFor(b, sortBy) - qtyFor(a, sortBy));
  }, [rows, sortBy]);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-1 text-xs" data-no-drag>
        <span className="text-muted-foreground mr-1">Sort by:</span>
        {(["30d", "60d", "90d"] as const).map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setSortBy(w)}
            className={cn(
              "rounded px-2 py-0.5 font-medium transition-colors",
              sortBy === w
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-muted-foreground"
            )}
          >
            {w}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="font-mono">SKU</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">30d</TableHead>
              <TableHead className="text-right">60d</TableHead>
              <TableHead className="text-right">90d</TableHead>
              <TableHead className="text-right">On hand</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground py-8 text-center text-xs"
                >
                  No SKU movement in the last 90 days.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((m) => (
                <TableRow key={m.sku_id}>
                  <TableCell className="font-mono text-primary text-xs font-semibold">
                    {m.sku_id}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[280px] truncate text-xs">
                    {m.description ?? "—"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      sortBy === "30d" && "font-semibold"
                    )}
                  >
                    {fmt.format(m.qty_30d)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      sortBy === "60d" && "font-semibold"
                    )}
                  >
                    {fmt.format(m.qty_60d)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      sortBy === "90d" && "font-semibold"
                    )}
                  >
                    {fmt.format(m.qty_90d)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right tabular-nums">
                    {fmt.format(m.available_qty)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
