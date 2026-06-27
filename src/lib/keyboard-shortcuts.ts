import type { LucideIcon } from "lucide-react";
import {
  filterNavSections,
  navGroups,
  type NavGroup,
} from "@/lib/nav-groups";

export type ShortcutCategory = "navigation" | "shell" | "help";

export type ShortcutKeys = {
  key: string;
  metaOrCtrl?: boolean;
  shift?: boolean;
  alt?: boolean;
};

export type ShortcutDefinition = {
  id: string;
  label: string;
  description?: string;
  category: ShortcutCategory;
  keys: ShortcutKeys;
};

export type FlatNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  groupLabel: string;
  sectionTitle: string;
  searchText: string;
};

export const SIDEBAR_OPEN_KEY = "zap-sidebar-open";

export const GLOBAL_SHORTCUTS: ShortcutDefinition[] = [
  {
    id: "command-palette",
    label: "Open command palette",
    category: "navigation",
    keys: { key: "k", metaOrCtrl: true },
  },
  {
    id: "toggle-sidebar",
    label: "Toggle sidebar",
    category: "shell",
    keys: { key: "b", metaOrCtrl: true },
  },
  {
    id: "shortcuts-guide",
    label: "Open keyboard shortcuts guide",
    category: "help",
    keys: { key: "?", shift: true },
  },
  {
    id: "shortcuts-guide-alt",
    label: "Open keyboard shortcuts guide",
    category: "help",
    keys: { key: "/", shift: true },
  },
];

export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

export function formatShortcut(keys: ShortcutKeys, mac = isMacPlatform()): string {
  const parts: string[] = [];
  if (keys.metaOrCtrl) parts.push(mac ? "⌘" : "Ctrl");
  if (keys.shift) parts.push(mac ? "⇧" : "Shift");
  if (keys.alt) parts.push(mac ? "⌥" : "Alt");

  let keyLabel = keys.key;
  if (keyLabel === "?") keyLabel = "?";
  else if (keyLabel === "/") keyLabel = "/";
  else if (keyLabel.length === 1) keyLabel = keyLabel.toUpperCase();
  else if (keyLabel === "Escape") keyLabel = "Esc";

  parts.push(keyLabel);
  return parts.join(mac ? "" : "+");
}

export function formatShortcutList(keysList: ShortcutKeys[]): string {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const keys of keysList) {
    const label = formatShortcut(keys);
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }
  return labels.join(" or ");
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const el = target as HTMLElement;
  if (typeof HTMLElement !== "undefined" && !(el instanceof HTMLElement)) return false;
  if (!("tagName" in el) || typeof el.tagName !== "string") return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if ("isContentEditable" in el && el.isContentEditable) return true;
  return false;
}

export function flattenNavItems(
  groups: NavGroup[] = navGroups,
  isAdmin = false
): FlatNavItem[] {
  const rows: FlatNavItem[] = [];
  for (const group of groups) {
    const sections = filterNavSections(group.sections, isAdmin);
    for (const section of sections) {
      for (const item of section.items) {
        rows.push({
          href: item.href,
          label: item.label,
          icon: item.icon,
          groupLabel: group.label,
          sectionTitle: section.title,
          searchText: `${group.label} ${section.title} ${item.label} ${item.href}`.toLowerCase(),
        });
      }
    }
  }
  return rows;
}

export function filterNavItemsByQuery(items: FlatNavItem[], query: string): FlatNavItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => item.searchText.includes(q));
}

export function matchShortcut(event: KeyboardEvent, keys: ShortcutKeys): boolean {
  const eventKey = event.key.toLowerCase();
  const targetKey = keys.key.toLowerCase();

  if (eventKey !== targetKey && event.key !== keys.key) {
    if (keys.key === "?" && event.key === "?") {
      // ok
    } else if (keys.key === "/" && event.key === "/") {
      // ok
    } else {
      return false;
    }
  }

  const wantsMetaOrCtrl = keys.metaOrCtrl ?? false;
  const hasMetaOrCtrl = event.metaKey || event.ctrlKey;
  if (wantsMetaOrCtrl !== hasMetaOrCtrl) return false;

  const wantsShift = keys.shift ?? false;
  if (wantsShift !== event.shiftKey) return false;

  const wantsAlt = keys.alt ?? false;
  if (wantsAlt !== event.altKey) return false;

  return true;
}

export function getShortcutsByCategory(
  category: ShortcutCategory,
  shortcuts: ShortcutDefinition[] = GLOBAL_SHORTCUTS
): ShortcutDefinition[] {
  const byLabel = new Map<string, ShortcutDefinition>();
  for (const shortcut of shortcuts) {
    if (shortcut.category !== category) continue;
    const existing = byLabel.get(shortcut.label);
    if (!existing) {
      byLabel.set(shortcut.label, shortcut);
    }
  }
  return [...byLabel.values()];
}

export function getShortcutKeysForLabel(
  label: string,
  shortcuts: ShortcutDefinition[] = GLOBAL_SHORTCUTS
): ShortcutKeys[] {
  return shortcuts.filter((s) => s.label === label).map((s) => s.keys);
}
