"use client";

import * as React from "react";
import { isTypingTarget, matchShortcut, type ShortcutKeys } from "@/lib/keyboard-shortcuts";

export type ShortcutHandler = {
  keys: ShortcutKeys;
  handler: (event: KeyboardEvent) => void;
  /** When true, fires even if focus is in an input (default false). */
  allowInInput?: boolean;
  /** When true, only fires on desktop widths (default false). */
  desktopOnly?: boolean;
};

export function useKeyboardShortcuts(
  shortcuts: ShortcutHandler[],
  enabled = true
) {
  React.useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      const typing = isTypingTarget(event.target);

      for (const shortcut of shortcuts) {
        if (typing && !shortcut.allowInInput) continue;
        if (shortcut.desktopOnly && typeof window !== "undefined") {
          if (window.matchMedia("(max-width: 767px)").matches) continue;
        }
        if (!matchShortcut(event, shortcut.keys)) continue;

        event.preventDefault();
        event.stopPropagation();
        shortcut.handler(event);
        return;
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [shortcuts, enabled]);
}
