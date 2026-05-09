"use client";

import type { ListSort } from "@/hooks/use-list-query-state";

const OPTIONS: { value: ListSort; label: string }[] = [
  { value: "sku_asc", label: "SKU A–Z" },
  { value: "sku_desc", label: "SKU Z–A" },
  { value: "qty_desc", label: "Qty (high → low)" },
  { value: "qty_asc", label: "Qty (low → high)" },
  { value: "created_desc", label: "Recently added" },
];

export function ListingsSort({
  value,
  onChange,
}: {
  value: ListSort;
  onChange: (next: ListSort) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
        Sort
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ListSort)}
        className="h-9 rounded-md border border-input bg-background px-2 text-xs"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
