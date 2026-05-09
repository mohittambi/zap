"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api-browser";
import {
  DASHBOARD_CARD_IDS,
  type DashboardCardId,
  type DashboardLayout,
} from "@/lib/dashboard-card-ids";

const FALLBACK: DashboardLayout = {
  visible_cards: [...DASHBOARD_CARD_IDS],
  default_company_id: null,
};

export function useDashboardPrefs() {
  const [layout, setLayout] = React.useState<DashboardLayout>(FALLBACK);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch<{ layout: DashboardLayout }>("/api/home/prefs");
        if (!cancelled) setLayout(res.layout);
      } catch {
        if (!cancelled) setLayout(FALLBACK);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = React.useCallback(async (next: DashboardLayout) => {
    setSaving(true);
    try {
      const res = await apiFetch<{ layout: DashboardLayout }>("/api/home/prefs", {
        method: "PUT",
        body: JSON.stringify({ layout: next }),
      });
      setLayout(res.layout);
    } finally {
      setSaving(false);
    }
  }, []);

  const isVisible = React.useCallback(
    (id: DashboardCardId) => layout.visible_cards.includes(id),
    [layout]
  );

  return { layout, loading, saving, save, isVisible };
}
