"use client";

import type { HomeSummary } from "@/server/services/homeSummaryService";
import { KpiCard } from "@/components/home/kpi-card";

export function KpiCardsRow({
  data,
  loading,
}: {
  data: HomeSummary | null;
  loading: boolean;
}) {
  const k = data?.kpis;
  const isFilteredByCompany = data?.scoped.company_id != null;
  const inboundDescription = isFilteredByCompany
    ? "GRN accepted (across vendors)"
    : "GRN accepted";

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      <KpiCard
        title="Sales orders (qty)"
        description="Units shipped (RTD)"
        value={k?.sales_qty.value ?? null}
        delta_mom_pct={k?.sales_qty.delta_mom_pct ?? null}
        delta_yoy_pct={k?.sales_qty.delta_yoy_pct ?? null}
        loading={loading}
      />
      <KpiCard
        title="Sales POs raised"
        description="By PO issue date"
        value={k?.sales_pos.value ?? null}
        delta_mom_pct={k?.sales_pos.delta_mom_pct ?? null}
        delta_yoy_pct={k?.sales_pos.delta_yoy_pct ?? null}
        loading={loading}
      />
      <KpiCard
        title="Avg fill rate"
        description="Weighted by qty"
        value={k?.fill_rate_pct.value ?? null}
        format="percent"
        delta_mom_pct={k?.fill_rate_pct.delta_mom_pct ?? null}
        delta_yoy_pct={k?.fill_rate_pct.delta_yoy_pct ?? null}
        loading={loading}
      />
      <KpiCard
        title="Inbound received (qty)"
        description={inboundDescription}
        value={k?.inbound_qty.value ?? null}
        delta_mom_pct={k?.inbound_qty.delta_mom_pct ?? null}
        delta_yoy_pct={k?.inbound_qty.delta_yoy_pct ?? null}
        loading={loading}
      />
      <KpiCard
        title="SKUs below reorder"
        description="Live alert count"
        value={k?.skus_below_reorder.value ?? null}
        delta_mom_pct={null}
        delta_yoy_pct={null}
        loading={loading}
      />
    </div>
  );
}
