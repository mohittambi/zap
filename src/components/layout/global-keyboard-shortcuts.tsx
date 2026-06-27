"use client";

import * as React from "react";
import { useShellUi } from "@/contexts/shell-ui-context";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

export function GlobalKeyboardShortcuts() {
  const {
    toggleSidebar,
    setCommandPaletteOpen,
    setShortcutsGuideOpen,
    commandPaletteOpen,
    shortcutsGuideOpen,
  } = useShellUi();

  const shortcuts = React.useMemo(
    () => [
      {
        keys: { key: "k", metaOrCtrl: true } as const,
        handler: () => setCommandPaletteOpen(true),
      },
      {
        keys: { key: "b", metaOrCtrl: true } as const,
        handler: () => toggleSidebar(),
        desktopOnly: true,
      },
      {
        keys: { key: "?", shift: true } as const,
        handler: () => setShortcutsGuideOpen(true),
      },
      {
        keys: { key: "/", shift: true } as const,
        handler: () => setShortcutsGuideOpen(true),
      },
    ],
    [toggleSidebar, setCommandPaletteOpen, setShortcutsGuideOpen]
  );

  useKeyboardShortcuts(shortcuts, !commandPaletteOpen && !shortcutsGuideOpen);

  return null;
}
