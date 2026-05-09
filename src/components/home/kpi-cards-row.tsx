"use client";

import type { HomeSummary } from "@/server/services/homeSummaryService";
import type { DashboardCardId } from "@/lib/dashboard-card-ids";
import { KpiCard } from "@/components/home/kpi-card";

function withCompanyParam(base: string, companyId: number | null | undefined) {
  if (companyId == null) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}company_id=${companyId}`;
}

export function KpiCardsRow({
  data,
  loading,
  isVisible = () => true,
}: {
  data: HomeSummary | null;
  loading: boolean;
  isVisible?: (id: DashboardCardId) => boolean;
}) {
  const k = data?.kpis;
  const companyId = data?.scoped.company_id ?? null;
  const isFilteredByCompany = companyId != null;
  const inboundDescription = isFilteredByCompany
    ? "GRN accepted (across vendors)"
    : "GRN accepted";

  const anyVisible =
    isVisible("sales_qty") ||
    isVisible("sales_pos") ||
    isVisible("fill_rate_pct") ||
    isVisible("inbound_qty") ||
    isVisible("skus_below_reorder");
  if (!anyVisible) return null;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      {isVisible("sales_qty") && (
        <KpiCard
          title="Sales orders (qty)"
          description="Units shipped (RTD)"
          value={k?.sales_qty.value ?? null}
          delta_mom_pct={k?.sales_qty.delta_mom_pct ?? null}
          delta_yoy_pct={k?.sales_qty.delta_yoy_pct ?? null}
          loading={loading}
          href={withCompanyParam("/outbound", companyId)}
        />
      )}
      {isVisible("sales_pos") && (
        <KpiCard
          title="Sales POs raised"
          description="By PO issue date"
          value={k?.sales_pos.value ?? null}
          delta_mom_pct={k?.sales_pos.delta_mom_pct ?? null}
          delta_yoy_pct={k?.sales_pos.delta_yoy_pct ?? null}
          loading={loading}
          href={withCompanyParam("/outbound/purchase-orders", companyId)}
        />
      )}
      {isVisible("fill_rate_pct") && (
        <KpiCard
          title="Avg fill rate"
          description="Weighted by qty"
          value={k?.fill_rate_pct.value ?? null}
          format="percent"
          delta_mom_pct={k?.fill_rate_pct.delta_mom_pct ?? null}
          delta_yoy_pct={k?.fill_rate_pct.delta_yoy_pct ?? null}
          loading={loading}
          href={withCompanyParam("/outbound", companyId)}
        />
      )}
      {isVisible("inbound_qty") && (
        <KpiCard
          title="Inbound received (qty)"
          description={inboundDescription}
          value={k?.inbound_qty.value ?? null}
          delta_mom_pct={k?.inbound_qty.delta_mom_pct ?? null}
          delta_yoy_pct={k?.inbound_qty.delta_yoy_pct ?? null}
          loading={loading}
          href="/inbound"
        />
      )}
      {isVisible("skus_below_reorder") && (
        <KpiCard
          title="SKUs below reorder"
          description="Live alert count"
          value={k?.skus_below_reorder.value ?? null}
          delta_mom_pct={null}
          delta_yoy_pct={null}
          loading={loading}
          href="/reorder"
        />
      )}
    </div>
  );
}
