"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { CompanyLogo } from "@/components/company/company-logo";
import { Input } from "@/components/ui/input";
import { openSelectDropdownOnArrowKey } from "@/lib/open-select-dropdown-on-arrow-key";
import { cn } from "@/lib/utils";

export type SearchableSelectOption = {
  key: string;
  label: string;
  /** Company / brand mark shown beside the label when set. */
  imageUrl?: string | null;
  imageName?: string | null;
};

export function SearchableSelect({
  value,
  onChange,
  onBlur,
  options,
  placeholder,
  emptyText = "No matches",
  variant = "solid",
  size = "default",
  disabled = false,
  className,
  triggerClassName,
  mono = false,
}: {
  value: string | null;
  onChange: (key: string) => void;
  /** Fired when the control loses focus or the dropdown closes. */
  onBlur?: () => void;
  options: SearchableSelectOption[];
  placeholder: string;
  emptyText?: string;
  variant?: "solid" | "soft" | "outline";
  size?: "default" | "sm";
  disabled?: boolean;
  className?: string;
  /** Applied to the trigger button (e.g. font-mono). */
  triggerClassName?: string;
  /** Use monospace font on trigger and list items. */
  mono?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const wasOpenRef = React.useRef(false);
  const [q, setQ] = React.useState("");
  const [mounted, setMounted] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [panelBox, setPanelBox] = React.useState({ top: 0, left: 0, width: 0 });

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const updatePanelPosition = React.useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPanelBox({
      top: r.bottom + 4,
      left: r.left,
      width: r.width,
    });
  }, []);

  React.useLayoutEffect(() => {
    if (!open) return;
    updatePanelPosition();
  }, [open, options.length, updatePanelPosition]);

  React.useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePanelPosition();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, updatePanelPosition]);

  React.useEffect(() => {
    if (disabled && open) setOpen(false);
  }, [disabled, open]);

  React.useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [open]);

  React.useEffect(() => {
    if (wasOpenRef.current && !open) {
      onBlur?.();
    }
    wasOpenRef.current = open;
  }, [open, onBlur]);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const selected = options.find((o) => o.key === value);
  const qTrim = q.trim().toLowerCase();
  const filtered = options.filter((o) => o.label.toLowerCase().includes(qTrim));

  const dropdown =
    open && mounted ? (
      <div
        ref={panelRef}
        role="listbox"
        className="bg-popover text-popover-foreground border-border fixed z-[500] max-h-[min(280px,calc(100vh-24px))] overflow-hidden rounded-md border p-2 shadow-lg"
        style={{
          top: panelBox.top,
          left: panelBox.left,
          width: Math.max(panelBox.width, 200),
        }}
      >
        <Input
          placeholder="Filter options..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="mb-2 h-9 w-full"
          autoFocus
          onKeyDown={(e) => e.stopPropagation()}
        />
        <div
          className="max-h-[200px] overflow-y-auto overflow-x-hidden"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {filtered.length === 0 ? (
            <p className="text-muted-foreground px-2 py-2 text-sm">{emptyText}</p>
          ) : (
            <div className="flex flex-col gap-px py-0.5">
              {filtered.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  role="option"
                  aria-selected={value === o.key}
                  className={cn(
                    "hover:bg-muted rounded px-2 py-2 text-left text-sm",
                    value === o.key && "bg-muted/80 font-medium",
                    mono && "font-mono"
                  )}
                  onClick={() => {
                    onChange(o.key);
                    setOpen(false);
                    setQ("");
                  }}
                >
                  <span className="flex items-center gap-2">
                    {o.imageUrl != null || o.imageName ? (
                      <CompanyLogo
                        name={o.imageName ?? o.label}
                        logoUrl={o.imageUrl}
                        size={18}
                      />
                    ) : null}
                    <span className="truncate">{o.label}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    ) : null;

  return (
    <div className={cn("relative w-full", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        className={cn(
          "flex w-full items-center justify-between gap-1 rounded-md text-left font-medium shadow-sm",
          size === "sm"
            ? "min-h-8 h-8 px-2 py-1 text-xs"
            : "min-h-11 px-4 py-2 text-sm",
          variant === "outline"
            ? "border border-input bg-background px-3 text-foreground hover:bg-muted/50"
            : variant === "soft"
              ? "bg-primary/15 text-foreground border-primary/35 hover:bg-primary/22 border"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
          open &&
            !disabled &&
            (variant === "outline"
              ? "ring-1 ring-ring"
              : "ring-ring ring-2 ring-offset-2 ring-offset-background"),
          disabled && "pointer-events-none cursor-not-allowed opacity-50",
          !selected && variant === "outline" && "text-muted-foreground",
          mono && "font-mono",
          triggerClassName
        )}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          openSelectDropdownOnArrowKey(e, setOpen, open);
        }}
        onBlur={() => onBlur?.()}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-disabled={disabled}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {selected && (selected.imageUrl != null || selected.imageName) ? (
            <CompanyLogo
              name={selected.imageName ?? selected.label}
              logoUrl={selected.imageUrl}
              size={18}
            />
          ) : null}
          <span className="truncate">{selected?.label ?? placeholder}</span>
        </span>
        <ChevronDown
          className={cn(
            "shrink-0 opacity-90 transition-transform",
            size === "sm" ? "size-3.5" : "size-4",
            open && "rotate-180",
            (variant === "soft" || variant === "outline") && "text-muted-foreground"
          )}
        />
      </button>
      {dropdown && typeof document !== "undefined"
        ? createPortal(dropdown, document.body)
        : null}
    </div>
  );
}
