"use client";

import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { openSelectDropdownOnArrowKey } from "@/lib/open-select-dropdown-on-arrow-key";
import { cn } from "@/lib/utils";

export type MultiSelectOption = {
  value: string;
  label: string;
};

export type MultiSelectProps = {
  options: ReadonlyArray<MultiSelectOption>;
  selected: ReadonlyArray<string>;
  onChange: (next: string[]) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  /** Optional cap on the popover height when the list is long. */
  maxListHeight?: string;
};

/**
 * Compact multi-select popover.
 * - Click trigger to open; click outside or Escape to close.
 * - Selecting an option toggles it; the trigger shows a count or first label.
 * - "Clear" button (X) wipes selection without opening the panel.
 */
export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "All",
  ariaLabel,
  className,
  maxListHeight = "16rem",
}: Readonly<MultiSelectProps>) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const wrapRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selectedSet = React.useMemo(() => new Set(selected), [selected]);

  const filteredOptions = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const toggle = (value: string) => {
    const next = new Set(selectedSet);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange([...next]);
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const triggerLabel = (() => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) {
      return options.find((o) => o.value === selected[0])?.label ?? selected[0];
    }
    return `${selected.length} selected`;
  })();

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => openSelectDropdownOnArrowKey(e, setOpen, open)}
        className={cn(
          "border-input bg-background flex h-7 w-full items-center justify-between gap-1 rounded border px-1.5 text-[11px]",
          "hover:bg-muted/40"
        )}
      >
        <span
          className={cn(
            "truncate",
            selected.length === 0 ? "text-muted-foreground" : "text-foreground font-medium"
          )}
        >
          {triggerLabel}
        </span>
        <span className="flex items-center gap-0.5 shrink-0">
          {selected.length > 0 ? (
            <span
              role="button"
              tabIndex={-1}
              onClick={clearAll}
              className="hover:text-destructive text-muted-foreground p-0.5"
              aria-label="Clear selection"
            >
              <X className="size-3" />
            </span>
          ) : null}
          <ChevronDown className="text-muted-foreground size-3" />
        </span>
      </button>
      {open ? (
        <div
          role="listbox"
          className={cn(
            "border-input bg-popover text-popover-foreground absolute left-0 z-30 mt-1 w-56 rounded-md border shadow-md",
            "p-1"
          )}
        >
          {options.length > 8 ? (
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="border-input bg-background mb-1 h-7 w-full rounded border px-2 text-xs"
            />
          ) : null}
          <ul className="overflow-y-auto" style={{ maxHeight: maxListHeight }}>
            {filteredOptions.length === 0 ? (
              <li className="text-muted-foreground px-2 py-1.5 text-xs">No matches</li>
            ) : (
              filteredOptions.map((opt) => {
                const isSel = selectedSet.has(opt.value);
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      onClick={() => toggle(opt.value)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs",
                        "hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "border-input flex size-3.5 shrink-0 items-center justify-center rounded-sm border",
                          isSel ? "bg-primary border-primary" : "bg-background"
                        )}
                      >
                        {isSel ? (
                          <Check className="text-primary-foreground size-3" strokeWidth={3} />
                        ) : null}
                      </span>
                      <span className="truncate">{opt.label}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
