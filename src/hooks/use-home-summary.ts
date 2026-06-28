"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api-browser";
import type { SummaryDateRange } from "@/lib/dashboard-date-range";
import type { HomeSummary } from "@/server/services/homeSummaryService";

export function useHomeSummary(
  companyId: number | null,
  dateRange: SummaryDateRange | null
) {
  const [data, setData] = React.useState<HomeSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (companyId != null) q.set("company_id", String(companyId));
      if (dateRange != null) {
        q.set("from", dateRange.from);
        q.set("to", dateRange.to);
      }
      const qs = q.toString();
      const summary = await apiFetch<HomeSummary>(
        `/api/home/summary${qs ? `?${qs}` : ""}`
      );
      setData(summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, dateRange?.from, dateRange?.to]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, refresh: load };
}
