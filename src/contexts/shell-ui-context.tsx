"use client";

import * as React from "react";
import { SIDEBAR_OPEN_KEY } from "@/lib/keyboard-shortcuts";

type ShellUiContextValue = {
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSidebar: () => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  shortcutsGuideOpen: boolean;
  setShortcutsGuideOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mobileNavOpen: boolean;
  setMobileNavOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

const ShellUiContext = React.createContext<ShellUiContextValue | null>(null);

export function ShellUiProvider({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);
  const [shortcutsGuideOpen, setShortcutsGuideOpen] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_OPEN_KEY);
      if (stored !== null) setSidebarOpen(stored === "true");
    } catch {
      // ignore storage errors
    }
  }, []);

  const toggleSidebar = React.useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_OPEN_KEY, String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const value = React.useMemo(
    () => ({
      sidebarOpen,
      setSidebarOpen,
      toggleSidebar,
      commandPaletteOpen,
      setCommandPaletteOpen,
      shortcutsGuideOpen,
      setShortcutsGuideOpen,
      mobileNavOpen,
      setMobileNavOpen,
    }),
    [
      sidebarOpen,
      toggleSidebar,
      commandPaletteOpen,
      shortcutsGuideOpen,
      mobileNavOpen,
    ]
  );

  return (
    <ShellUiContext.Provider value={value}>{children}</ShellUiContext.Provider>
  );
}

export function useShellUi() {
  const ctx = React.useContext(ShellUiContext);
  if (!ctx) throw new Error("useShellUi must be used within ShellUiProvider");
  return ctx;
}
