"use client";

import * as React from "react";
import { useShellUi } from "@/contexts/shell-ui-context";
import {
  formatShortcut,
  getShortcutKeysForLabel,
  getShortcutsByCategory,
  GLOBAL_SHORTCUTS,
  type ShortcutCategory,
} from "@/lib/keyboard-shortcuts";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  navigation: "Navigation",
  shell: "Shell",
  help: "Help",
};

function ShortcutRow({ label }: { label: string }) {
  const keysList = getShortcutKeysForLabel(label, GLOBAL_SHORTCUTS);
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-foreground">{label}</span>
      <KbdGroup>
        {keysList.map((keys, i) => (
          <React.Fragment key={i}>
            {i > 0 ? (
              <span className="text-xs text-muted-foreground">or</span>
            ) : null}
            <Kbd>{formatShortcut(keys)}</Kbd>
          </React.Fragment>
        ))}
      </KbdGroup>
    </div>
  );
}

export function KeyboardShortcutsGuide() {
  const { shortcutsGuideOpen, setShortcutsGuideOpen } = useShellUi();
  const categories: ShortcutCategory[] = ["navigation", "shell", "help"];

  return (
    <Dialog open={shortcutsGuideOpen} onOpenChange={setShortcutsGuideOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Quick actions available anywhere in the app.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {categories.map((category) => {
            const shortcuts = getShortcutsByCategory(category);
            if (shortcuts.length === 0) return null;
            return (
              <div key={category}>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
                  {CATEGORY_LABELS[category]}
                </h3>
                <div className="divide-y divide-border/60 rounded-lg border px-3">
                  {shortcuts.map((shortcut) => (
                    <ShortcutRow key={shortcut.id} label={shortcut.label} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          Shortcuts are disabled while typing in a text field. Press{" "}
          <Kbd className="mx-0.5">Esc</Kbd> to close dialogs.
        </p>
      </DialogContent>
    </Dialog>
  );
}
