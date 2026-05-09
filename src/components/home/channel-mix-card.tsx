"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChartType } from "@/lib/dashboard-card-ids";
import type { ChannelMixRow } from "@/server/services/homeSummaryService";

const fmt = new Intl.NumberFormat("en-IN");

export function ChannelMixBody({
  rows,
  loading,
  chartType = "bar",
  onCompanyClick,
}: {
  rows: ChannelMixRow[] | null | undefined;
  loading: boolean;
  chartType?: ChartType;
  onCompanyClick?: (companyName: string) => void;
}) {
  if (loading) return <Skeleton className="h-full w-full" />;
  if (!rows || rows.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
        No shipments in this window.
      </div>
    );
  }

  if (chartType === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="company" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={48} tickFormatter={(v: number) => fmt.format(v)} />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(v) => [fmt.format(Number(v)), "Qty"]}
          />
          <Line type="monotone" dataKey="qty" stroke="var(--primary)" strokeWidth={2} dot />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 24, left: 16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmt.format(v)} />
        <YAxis type="category" dataKey="company" tick={{ fontSize: 11 }} width={140} />
        <Tooltip
          contentStyle={{ fontSize: 12 }}
          formatter={(v) => [fmt.format(Number(v)), "Qty"]}
        />
        <Bar
          dataKey="qty"
          name="Qty"
          fill="var(--primary)"
          cursor={onCompanyClick ? "pointer" : undefined}
          onClick={
            onCompanyClick
              ? ((d: unknown) => {
                  const company = (d as { payload?: { company?: string } })?.payload?.company;
                  if (company) onCompanyClick(company);
                }) as never
              : undefined
          }
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
