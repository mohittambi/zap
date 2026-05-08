"use client";

import type { HomeSummary } from "@/server/services/homeSummaryService";
import { TrendChart } from "@/components/home/trend-chart";

export function TrendChartsRow({
  data,
  loading,
}: {
  data: HomeSummary | null;
  loading: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <TrendChart
        title="Sales (qty) — trailing 90 days"
        description="Daily units shipped vs same days last year"
        data={data?.trends.sales_qty_daily ?? null}
        loading={loading}
      />
      <TrendChart
        title="Inbound received (qty) — trailing 90 days"
        description="Daily GRN accepted qty vs same days last year"
        data={data?.trends.inbound_qty_daily ?? null}
        loading={loading}
      />
    </div>
  );
}
