"use client";

import { Button } from "@/components/ui/button";
import { CategoryPicker } from "@/components/listings/category-picker";
import { StockStateControl } from "@/components/listings/stock-state-control";
import { TagPicker } from "@/components/listings/tag-picker";
import type {
  ListQueryState,
  ListStockState,
} from "@/hooks/use-list-query-state";

export type ListingsFiltersConfig = {
  category?: boolean;
  stockState?: boolean;
  tags?: boolean;
};

export function ListingsFilters({
  state,
  onChange,
  onClearAll,
  enable = { category: true, stockState: true, tags: true },
}: {
  state: ListQueryState;
  onChange: (patch: Partial<ListQueryState>) => void;
  onClearAll: () => void;
  enable?: ListingsFiltersConfig;
}) {
  const hasActive =
    state.category != null ||
    state.stockState != null ||
    state.tagIds.length > 0 ||
    state.skuType != null;

  return (
    <div className="flex flex-wrap items-end gap-3">
      {enable.category ? (
        <CategoryPicker
          value={state.category}
          onChange={(v) => onChange({ category: v })}
        />
      ) : null}
      {enable.stockState ? (
        <StockStateControl
          value={state.stockState}
          onChange={(v: ListStockState | null) => onChange({ stockState: v })}
        />
      ) : null}
      {enable.tags ? (
        <TagPicker
          value={state.tagIds}
          onChange={(v) => onChange({ tagIds: v })}
        />
      ) : null}
      {hasActive ? (
        <Button variant="ghost" size="sm" className="h-9" onClick={onClearAll}>
          Clear all
        </Button>
      ) : null}
    </div>
  );
}
