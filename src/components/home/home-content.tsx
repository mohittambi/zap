"use client";

import * as React from "react";
import { AppPageShell, AppPageTitle } from "@/components/layout/app-page-shell";
import { HomeFilters } from "@/components/home/home-filters";
import { KpiCardsRow } from "@/components/home/kpi-cards-row";
import { TrendChartsRow } from "@/components/home/trend-charts-row";
import { ReorderAlertsStrip } from "@/components/home/reorder-alerts-strip";
import { SavedQueryPanel } from "@/components/home/saved-query-panel";
import { useHomeSummary } from "@/hooks/use-home-summary";

export function HomeContent() {
  const [companyId, setCompanyId] = React.useState<number | null>(null);
  const { data, loading } = useHomeSummary(companyId);

  return (
    <AppPageShell>
      <AppPageTitle
        title="Operations overview"
        description="Trailing 30 days vs the prior 30 days (MoM) and the same 30 days last year (YoY)."
      />
      <div className="flex flex-col gap-6">
        <HomeFilters companyId={companyId} onCompanyChange={setCompanyId} />
        <KpiCardsRow data={data} loading={loading} />
        <TrendChartsRow data={data} loading={loading} />
        <ReorderAlertsStrip data={data} loading={loading} />
        <SavedQueryPanel />
      </div>
    </AppPageShell>
  );
}
