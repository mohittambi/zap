"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { apiFetch, getStoredToken } from "@/lib/api-browser";

const SESSION_KEY = "zap_activity_session";

export function getActivitySessionId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function resetActivitySessionId(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_KEY);
}

/** Debounced client navigation tracking for activity_log. */
export function useActivityTracker(enabled: boolean) {
  const pathname = usePathname();
  const lastPath = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!enabled || !pathname || !getStoredToken()) return;
    if (pathname === "/login" || pathname.startsWith("/api-docs")) return;
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;

    const timer = window.setTimeout(() => {
      void apiFetch("/api/activity/track", {
        method: "POST",
        body: JSON.stringify({
          action: "navigation",
          path: pathname,
          session_id: getActivitySessionId(),
        }),
      }).catch(() => {
        /* non-blocking */
      });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [enabled, pathname]);
}
