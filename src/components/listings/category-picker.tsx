"use client";

import * as React from "react";
import { ChevronDown, X } from "lucide-react";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Category = { name: string; count: number };

export function CategoryPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [keyword, setKeyword] = React.useState("");
  const [items, setItems] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const sp = new URLSearchParams();
        if (keyword.trim()) sp.set("keyword", keyword.trim());
        sp.set("limit", "30");
        const res = await apiFetch<{ categories: Category[] }>(
          `/api/listings/categories?${sp.toString()}`
        );
        if (!cancelled) setItems(res.categories);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [keyword, open]);

  React.useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div className="flex flex-col gap-1" ref={containerRef}>
      <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
        Category
      </span>
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 w-56 justify-between text-xs"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="truncate">{value ?? "Any"}</span>
          {value ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
                setKeyword("");
              }}
              className="hover:bg-muted ml-1 inline-flex size-4 items-center justify-center rounded"
              aria-label="Clear category"
            >
              <X className="size-3" />
            </button>
          ) : (
            <ChevronDown className="size-3" />
          )}
        </Button>
        {open && (
          <div className="bg-popover absolute z-30 mt-1 w-72 overflow-hidden rounded-md border shadow-md">
            <div className="border-b p-2">
              <Input
                autoFocus
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Search…"
                className="h-8 text-xs"
              />
            </div>
            <ul className="max-h-72 overflow-y-auto py-1">
              {loading && items.length === 0 ? (
                <li className="text-muted-foreground px-3 py-2 text-xs">Loading…</li>
              ) : items.length === 0 ? (
                <li className="text-muted-foreground px-3 py-2 text-xs">No matches</li>
              ) : (
                items.map((c) => (
                  <li key={c.name}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(c.name);
                        setOpen(false);
                        setKeyword("");
                      }}
                      className={cn(
                        "hover:bg-muted flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs",
                        value === c.name && "bg-muted"
                      )}
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="text-muted-foreground tabular-nums">{c.count}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
