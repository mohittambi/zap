"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api-browser";
import { AppPageShell, AppPageTitle } from "@/components/layout/app-page-shell";
import { HomeFilters } from "@/components/home/home-filters";
import { KpiCardsRow } from "@/components/home/kpi-cards-row";
import { PhaseTwoOpsRow } from "@/components/home/phase-two-ops-row";
import { ChannelMixCard } from "@/components/home/channel-mix-card";
import { TrendChartsRow } from "@/components/home/trend-charts-row";
import { ReorderAlertsStrip } from "@/components/home/reorder-alerts-strip";
import { SavedQueryPanel } from "@/components/home/saved-query-panel";
import { CustomiseDashboardSheet } from "@/components/home/customise-dashboard-sheet";
import { useHomeSummary } from "@/hooks/use-home-summary";
import { useDashboardPrefs } from "@/hooks/use-dashboard-prefs";
import { formatIstRangeInclusive } from "@/lib/format-ist";

type Company = { id: number; name: string };

export function HomeContent() {
  const [companyId, setCompanyId] = React.useState<number | null>(null);
  const [companies, setCompanies] = React.useState<Company[]>([]);
  const { data, loading } = useHomeSummary(companyId);
  const { layout, saving, save, isVisible } = useDashboardPrefs();

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch<{ companies: Company[] }>("/api/home/companies");
        if (!cancelled) setCompanies(res.companies);
      } catch {
        /* non-fatal — channel-mix click-through just won't work without the map */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const subtitle = data
    ? `Trailing 30 days (${formatIstRangeInclusive(data.range.from, data.range.to)} IST) vs the prior 30 days (MoM) and the same 30 days last year (YoY).`
    : "Trailing 30 days vs the prior 30 days (MoM) and the same 30 days last year (YoY).";

  function handleChannelBarClick(name: string) {
    const match = companies.find((c) => c.name === name);
    if (match) setCompanyId(match.id);
  }

  return (
    <AppPageShell>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <AppPageTitle title="Operations overview" description={subtitle} className="mb-0" />
        <CustomiseDashboardSheet layout={layout} saving={saving} onSave={save} />
      </div>
      <div className="flex flex-col gap-6">
        <HomeFilters companyId={companyId} onCompanyChange={setCompanyId} />
        <KpiCardsRow data={data} loading={loading} isVisible={isVisible} />
        <PhaseTwoOpsRow data={data} loading={loading} isVisible={isVisible} />
        {isVisible("trends") ? (
          <TrendChartsRow data={data} loading={loading} />
        ) : null}
        {companyId == null && isVisible("channel_mix") ? (
          <ChannelMixCard
            rows={data?.channel_mix ?? null}
            loading={loading}
            onCompanyClick={handleChannelBarClick}
          />
        ) : null}
        {isVisible("reorder_alerts_strip") ? (
          <ReorderAlertsStrip data={data} loading={loading} />
        ) : null}
        {isVisible("saved_query_panel") ? <SavedQueryPanel /> : null}
      </div>
    </AppPageShell>
  );
}
