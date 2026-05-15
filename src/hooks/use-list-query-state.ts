"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type ListSort =
  | "sku_asc"
  | "sku_desc"
  | "qty_asc"
  | "qty_desc"
  | "created_desc";

export type ListStockState = "in_stock" | "out_of_stock" | "below_reorder";

export type ListQueryState = {
  search: string;
  category: string | null;
  stockState: ListStockState | null;
  tagIds: number[];
  skuType: string | null;
  sort: ListSort;
  page: number;
};

const DEFAULT_STATE: ListQueryState = {
  search: "",
  category: null,
  stockState: null,
  tagIds: [],
  skuType: null,
  sort: "sku_asc",
  page: 1,
};

const ALL_SORTS: ListSort[] = [
  "sku_asc",
  "sku_desc",
  "qty_asc",
  "qty_desc",
  "created_desc",
];

const ALL_STOCK_STATES: ListStockState[] = [
  "in_stock",
  "out_of_stock",
  "below_reorder",
];

function parseTagIds(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function readFromParams(
  params: URLSearchParams,
  defaults: ListQueryState
): ListQueryState {
  const sortRaw = params.get("sort");
  const stockRaw = params.get("stock_state");
  const pageRaw = Number(params.get("page") ?? "1");
  return {
    search: params.get("search") ?? defaults.search,
    category: params.get("category") ?? defaults.category,
    stockState: ALL_STOCK_STATES.includes(stockRaw as ListStockState)
      ? (stockRaw as ListStockState)
      : defaults.stockState,
    tagIds: parseTagIds(params.get("tag_ids")),
    skuType: params.get("sku_type") ?? defaults.skuType,
    sort: ALL_SORTS.includes(sortRaw as ListSort)
      ? (sortRaw as ListSort)
      : defaults.sort,
    page: Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.trunc(pageRaw) : 1,
  };
}

function writeToParams(state: ListQueryState, base: ListQueryState): URLSearchParams {
  const sp = new URLSearchParams();
  if (state.search) sp.set("search", state.search);
  if (state.category) sp.set("category", state.category);
  if (state.stockState) sp.set("stock_state", state.stockState);
  if (state.tagIds.length) sp.set("tag_ids", state.tagIds.join(","));
  if (state.skuType) sp.set("sku_type", state.skuType);
  if (state.sort !== base.sort) sp.set("sort", state.sort);
  if (state.page > 1) sp.set("page", String(state.page));
  return sp;
}

export function useListQueryState(defaults?: Partial<ListQueryState>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Hold defaults stable across renders.
  const baseRef = React.useRef<ListQueryState>({ ...DEFAULT_STATE, ...defaults });

  const state = React.useMemo(
    () => readFromParams(searchParams ?? new URLSearchParams(), baseRef.current),
    [searchParams]
  );

  const set = React.useCallback(
    (patch: Partial<ListQueryState>) => {
      // Any filter change resets page; sort changes also reset page.
      const resetsPage =
        patch.search !== undefined ||
        patch.category !== undefined ||
        patch.stockState !== undefined ||
        patch.tagIds !== undefined ||
        patch.skuType !== undefined ||
        patch.sort !== undefined;
      const next: ListQueryState = {
        ...state,
        ...patch,
        page: patch.page !== undefined ? patch.page : resetsPage ? 1 : state.page,
      };
      const sp = writeToParams(next, baseRef.current);
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, state]
  );

  const toApiParams = React.useCallback((): URLSearchParams => {
    const sp = new URLSearchParams();
    if (state.search) sp.set("search_keyword", state.search);
    if (state.category) sp.set("category", state.category);
    if (state.stockState) sp.set("stock_state", state.stockState);
    if (state.tagIds.length) sp.set("tag_ids", state.tagIds.join(","));
    if (state.skuType) sp.set("sku_type", state.skuType);
    sp.set("sort", state.sort);
    sp.set("page", String(state.page));
    return sp;
  }, [state]);

  const clearAll = React.useCallback(() => {
    set({
      search: "",
      category: null,
      stockState: null,
      tagIds: [],
      skuType: null,
    });
  }, [set]);

  return { state, set, toApiParams, clearAll };
}
