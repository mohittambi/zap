"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ListSort } from "@/hooks/use-list-query-state";

/**
 * Each column maps to a pair of (asc, desc) sort values. Clicking the head
 * toggles between them; clicking a different head jumps to that column's asc.
 */
export type SortPair = { asc: ListSort; desc: ListSort };

export const SORT_PAIRS = {
  sku: { asc: "sku_asc", desc: "sku_desc" },
  qty: { asc: "qty_asc", desc: "qty_desc" },
  // No asc-by-created in the v1 enum; clicking "Added" cycles desc-only.
  created: { asc: "created_desc", desc: "created_desc" },
} as const satisfies Record<string, SortPair>;

export function SortableTableHead({
  children,
  pair,
  current,
  onChange,
  className,
}: {
  children: React.ReactNode;
  pair: SortPair;
  current: ListSort;
  onChange: (next: ListSort) => void;
  className?: string;
}) {
  const isAsc = current === pair.asc;
  const isDesc = current === pair.desc;
  const isActive = isAsc || isDesc;

  function click() {
    if (isAsc) onChange(pair.desc);
    else onChange(pair.asc);
  }

  const Icon = isAsc ? ArrowUp : isDesc ? ArrowDown : ArrowUpDown;

  return (
    <TableHead className={cn("p-0", className)}>
      <button
        type="button"
        onClick={click}
        className={cn(
          "hover:text-foreground inline-flex h-10 w-full items-center gap-1 px-2 text-left font-medium transition-colors",
          isActive ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {children}
        <Icon className={cn("size-3", !isActive && "opacity-50")} />
      </button>
    </TableHead>
  );
}
