"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DataTableSort, DataTableSortDir } from "./types";

export function DataTableColumnHeader({
  label,
  columnId,
  sort,
  onSortChange,
  className,
}: {
  label: React.ReactNode;
  columnId: string;
  sort: DataTableSort;
  onSortChange: (columnId: string, dir: DataTableSortDir | null) => void;
  className?: string;
}) {
  const active = sort?.columnId === columnId;
  let Icon = ChevronsUpDown;
  if (active) Icon = sort.dir === "asc" ? ArrowUp : ArrowDown;

  function click() {
    if (!active) {
      onSortChange(columnId, "asc");
      return;
    }
    if (sort.dir === "asc") {
      onSortChange(columnId, "desc");
      return;
    }
    onSortChange(columnId, null);
  }

  return (
    <button
      type="button"
      onClick={click}
      className={cn(
        "inline-flex items-center gap-1 font-semibold whitespace-nowrap",
        "hover:text-primary",
        active ? "text-primary" : "text-foreground",
        className
      )}
    >
      {label}
      <Icon className={cn("size-3", active ? "opacity-100" : "opacity-50")} />
    </button>
  );
}
