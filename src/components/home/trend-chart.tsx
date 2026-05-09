"use client";

import {
  Area,
  AreaChart,
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
import { formatIstDate, formatIstShortDay } from "@/lib/format-ist";
import type { ChartType } from "@/lib/dashboard-card-ids";
import type { TrendPoint } from "@/server/services/homeSummaryService";

type DotProps = {
  cx?: number;
  cy?: number;
  index?: number;
  payload?: TrendPoint;
};

function AnomalyDot(props: DotProps) {
  const { cx, cy, payload, index } = props;
  if (cx == null || cy == null || payload?.anomaly_z == null) {
    return <g key={`d-${index ?? 0}`} />;
  }
  return (
    <circle
      key={`d-${index ?? 0}`}
      cx={cx}
      cy={cy}
      r={4}
      className="fill-red-500 stroke-background"
      strokeWidth={1.5}
    />
  );
}

function tooltipFormatter(value: unknown, name: unknown, item: { payload?: TrendPoint }) {
  if (name === "This year" && item.payload?.anomaly_z != null) {
    const z = item.payload.anomaly_z;
    const dir = z >= 0 ? "above" : "below";
    return [`${value} · ${Math.abs(z).toFixed(1)}σ ${dir} 30-day mean`, "This year (anomaly)"];
  }
  return [String(value), String(name ?? "")];
}

export function TrendChartBody({
  data,
  loading,
  chartType = "line",
}: {
  data: TrendPoint[] | null;
  loading?: boolean;
  chartType?: ChartType;
}) {
  const empty = !loading && (!data || data.every((p) => p.v === 0 && p.v_prev_year === 0));
  const anomalyCount = data?.filter((p) => p.anomaly_z != null).length ?? 0;

  if (loading) return <Skeleton className="h-full w-full" />;
  if (empty) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
        No data in this window.
      </div>
    );
  }

  const sharedAxes = (
    <>
      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
      <XAxis
        dataKey="day"
        tickFormatter={formatIstShortDay}
        tick={{ fontSize: 11 }}
        interval="preserveStartEnd"
        minTickGap={28}
      />
      <YAxis tick={{ fontSize: 11 }} width={48} />
      <Tooltip
        contentStyle={{ fontSize: 12 }}
        labelFormatter={(label) => formatIstDate(String(label))}
        formatter={tooltipFormatter as never}
      />
    </>
  );

  return (
    <div className="flex h-full flex-col gap-1.5">
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "bar" ? (
            <BarChart data={data ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              {sharedAxes}
              <Bar dataKey="v" name="This year" fill="var(--primary)" />
              <Bar dataKey="v_prev_year" name="Last year" fill="var(--muted-foreground)" fillOpacity={0.4} />
            </BarChart>
          ) : chartType === "area" ? (
            <AreaChart data={data ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              {sharedAxes}
              <Area
                type="monotone"
                dataKey="v"
                name="This year"
                stroke="var(--primary)"
                fill="var(--primary)"
                fillOpacity={0.18}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="v_prev_year"
                name="Last year"
                stroke="var(--muted-foreground)"
                fill="var(--muted-foreground)"
                fillOpacity={0.08}
                strokeDasharray="4 4"
                strokeWidth={1.5}
              />
            </AreaChart>
          ) : (
            <LineChart data={data ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              {sharedAxes}
              <Line
                type="monotone"
                dataKey="v"
                name="This year"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={AnomalyDot as never}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="v_prev_year"
                name="Last year"
                stroke="var(--muted-foreground)"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      <p className="text-muted-foreground pl-1 text-[10px]">
        {anomalyCount === 0
          ? "No anomalies in the last 90 days."
          : `${anomalyCount} ${anomalyCount === 1 ? "anomaly" : "anomalies"} flagged (|z| ≥ 2.5σ over a trailing 30-day window).`}
      </p>
    </div>
  );
}
