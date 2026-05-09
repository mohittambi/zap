"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ListStockState } from "@/hooks/use-list-query-state";

const OPTIONS: { value: ListStockState | null; label: string }[] = [
  { value: null, label: "Any" },
  { value: "in_stock", label: "In stock" },
  { value: "out_of_stock", label: "Out of stock" },
  { value: "below_reorder", label: "Below reorder" },
];

export function StockStateControl({
  value,
  onChange,
}: {
  value: ListStockState | null;
  onChange: (next: ListStockState | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
        Stock
      </span>
      <div className="border-input inline-flex overflow-hidden rounded-md border">
        {OPTIONS.map((o) => (
          <Button
            key={o.label}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(o.value)}
            className={cn(
              "h-9 rounded-none border-0 px-3 text-xs",
              value === o.value && "bg-primary text-primary-foreground hover:bg-primary"
            )}
          >
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
