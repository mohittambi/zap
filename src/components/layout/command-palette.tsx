"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useShellUi } from "@/contexts/shell-ui-context";
import {
  filterNavItemsByQuery,
  flattenNavItems,
  type FlatNavItem,
} from "@/lib/keyboard-shortcuts";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

function groupFilteredItems(items: FlatNavItem[]) {
  const groups = new Map<string, FlatNavItem[]>();
  for (const item of items) {
    const list = groups.get(item.groupLabel) ?? [];
    list.push(item);
    groups.set(item.groupLabel, list);
  }
  return groups;
}

export function CommandPalette() {
  const router = useRouter();
  const { isAdmin, isSuperAdmin, hasPermission } = useAuth();
  const { commandPaletteOpen, setCommandPaletteOpen, setMobileNavOpen } =
    useShellUi();

  const allItems = React.useMemo(
    () => flattenNavItems(undefined, isAdmin, isSuperAdmin, hasPermission),
    [isAdmin, isSuperAdmin, hasPermission]
  );

  const [query, setQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const itemRefs = React.useRef<Map<number, HTMLButtonElement>>(new Map());

  const filtered = React.useMemo(
    () => filterNavItemsByQuery(allItems, query),
    [allItems, query]
  );

  const grouped = React.useMemo(() => groupFilteredItems(filtered), [filtered]);
  const flatFiltered = React.useMemo(() => filtered, [filtered]);

  React.useEffect(() => {
    if (!commandPaletteOpen) {
      setQuery("");
      setSelectedIndex(0);
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [commandPaletteOpen]);

  React.useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  React.useEffect(() => {
    if (!commandPaletteOpen) return;
    const el = itemRefs.current.get(selectedIndex);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, commandPaletteOpen, filtered]);

  const navigateTo = React.useCallback(
    (href: string) => {
      setCommandPaletteOpen(false);
      setMobileNavOpen(false);
      router.push(href);
    },
    [router, setCommandPaletteOpen, setMobileNavOpen]
  );

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, Math.max(flatFiltered.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = flatFiltered[selectedIndex];
      if (item) navigateTo(item.href);
    }
  };

  let runningIndex = -1;
  itemRefs.current = new Map();

  return (
    <Dialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
      <DialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-lg"
        showCloseButton={false}
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Command palette</DialogTitle>
          <DialogDescription>Search and jump to any page</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 border-b px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages…"
            className="h-12 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>

        <ScrollArea className="max-h-[min(360px,50vh)]">
          <div className="p-2">
            {flatFiltered.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                No pages match your search.
              </p>
            ) : (
              [...grouped.entries()].map(([groupLabel, items]) => (
                <div key={groupLabel} className="mb-2 last:mb-0">
                  <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {groupLabel}
                  </p>
                  <ul className="space-y-0.5">
                    {items.map((item) => {
                      runningIndex += 1;
                      const index = runningIndex;
                      const active = index === selectedIndex;
                      const ItemIcon = item.icon;
                      return (
                        <li key={item.href}>
                          <button
                            type="button"
                            ref={(el) => {
                              if (el) itemRefs.current.set(index, el);
                            }}
                            data-selected={active ? "" : undefined}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                              active
                                ? "bg-primary/10 text-primary"
                                : "text-foreground hover:bg-muted"
                            )}
                            onMouseEnter={() => setSelectedIndex(index)}
                            onClick={() => navigateTo(item.href)}
                          >
                            <ItemIcon className="size-4 shrink-0" />
                            <span className="min-w-0 flex-1 truncate font-medium">
                              {item.label}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {item.sectionTitle}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
          <span>↑↓ navigate · Enter open · Esc close</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
