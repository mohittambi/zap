"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api-browser";
import {
  DEFAULT_LAYOUT_V2,
  defaultPositionFor,
  migrateLayout,
  type CardConfig,
  type CardFilters,
  type CardPosition,
  type ChartType,
  type DashboardCardId,
  type DashboardLayoutV2,
} from "@/lib/dashboard-card-ids";

type Setter = (next: DashboardLayoutV2) => void;

function patchCard(
  layout: DashboardLayoutV2,
  id: DashboardCardId,
  patch: Partial<CardConfig>
): DashboardLayoutV2 {
  const idx = layout.cards.findIndex((c) => c.id === id);
  const cards = [...layout.cards];
  if (idx === -1) {
    cards.push({ id, pos: defaultPositionFor(id), ...patch });
  } else {
    cards[idx] = { ...cards[idx], ...patch };
  }
  return { ...layout, cards };
}

export function useDashboardPrefs() {
  const [layout, setLayout] = React.useState<DashboardLayoutV2>(DEFAULT_LAYOUT_V2);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [previewMode, setPreviewMode] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch<{ layout: unknown }>("/api/home/prefs");
        if (!cancelled) setLayout(migrateLayout(res.layout));
      } catch {
        if (!cancelled) setLayout(DEFAULT_LAYOUT_V2);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = React.useCallback(async (next: DashboardLayoutV2) => {
    setSaving(true);
    try {
      const res = await apiFetch<{ layout: unknown }>("/api/home/prefs", {
        method: "PUT",
        body: JSON.stringify({ layout: next }),
      });
      setLayout(migrateLayout(res.layout));
    } finally {
      setSaving(false);
    }
  }, []);

  // Save unless we're previewing a shared layout — preview never auto-saves.
  const save = React.useCallback(
    async (next: DashboardLayoutV2) => {
      if (previewMode) {
        setLayout(next);
        return;
      }
      await persist(next);
    },
    [persist, previewMode]
  );

  // Apply a shared layout to the in-memory state without persisting.
  const enterPreview = React.useCallback((shared: DashboardLayoutV2) => {
    setPreviewMode(true);
    setLayout(shared);
  }, []);

  const exitPreviewAndPersist = React.useCallback(async () => {
    setPreviewMode(false);
    await persist(layout);
  }, [persist, layout]);

  const exitPreviewAndDiscard: Setter = React.useCallback(async () => {
    setPreviewMode(false);
    setLoading(true);
    try {
      const res = await apiFetch<{ layout: unknown }>("/api/home/prefs");
      setLayout(migrateLayout(res.layout));
    } catch {
      setLayout(DEFAULT_LAYOUT_V2);
    } finally {
      setLoading(false);
    }
  }, []) as unknown as Setter;

  const isVisible = React.useCallback(
    (id: DashboardCardId) => {
      const c = layout.cards.find((x) => x.id === id);
      return !c?.hidden;
    },
    [layout]
  );

  const getCardConfig = React.useCallback(
    (id: DashboardCardId): CardConfig => {
      const c = layout.cards.find((x) => x.id === id);
      if (c) return c;
      return { id, pos: defaultPositionFor(id) };
    },
    [layout]
  );

  const updateCard = React.useCallback(
    (id: DashboardCardId, patch: Partial<CardConfig>) => {
      const next = patchCard(layout, id, patch);
      void save(next);
    },
    [layout, save]
  );

  const updatePositions = React.useCallback(
    (positions: Partial<Record<DashboardCardId, CardPosition>>) => {
      let next = layout;
      for (const [id, pos] of Object.entries(positions)) {
        if (pos) next = patchCard(next, id as DashboardCardId, { pos });
      }
      if (next !== layout) void save(next);
    },
    [layout, save]
  );

  const setHidden = React.useCallback(
    (id: DashboardCardId, hidden: boolean) => updateCard(id, { hidden }),
    [updateCard]
  );

  const setChartType = React.useCallback(
    (id: DashboardCardId, chart_type: ChartType | undefined) =>
      updateCard(id, { chart_type }),
    [updateCard]
  );

  const setCardFilters = React.useCallback(
    (id: DashboardCardId, filters: CardFilters | undefined) =>
      updateCard(id, { filters }),
    [updateCard]
  );

  const resetLayout = React.useCallback(async () => {
    await save(DEFAULT_LAYOUT_V2);
  }, [save]);

  return {
    layout,
    loading,
    saving,
    previewMode,
    isVisible,
    getCardConfig,
    save,
    updateCard,
    updatePositions,
    setHidden,
    setChartType,
    setCardFilters,
    resetLayout,
    enterPreview,
    exitPreviewAndPersist,
    exitPreviewAndDiscard,
  };
}
