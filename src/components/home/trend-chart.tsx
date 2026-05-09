"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatIstDate, formatIstShortDay } from "@/lib/format-ist";
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
    // Recharts requires a renderable element; an empty <g> draws nothing.
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

export function TrendChart({
  title,
  description,
  data,
  loading,
}: {
  title: string;
  description?: string;
  data: TrendPoint[] | null;
  loading?: boolean;
}) {
  const empty = !loading && (!data || data.every((p) => p.v === 0 && p.v_prev_year === 0));
  const anomalyCount = data?.filter((p) => p.anomaly_z != null).length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        {description ? <CardDescription className="text-xs">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 h-[290px]">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : empty ? (
          <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
            No data in this window.
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
            </ResponsiveContainer>
            <p className="text-muted-foreground pl-1 text-[10px]">
              {anomalyCount === 0
                ? "No anomalies in the last 90 days."
                : `${anomalyCount} ${anomalyCount === 1 ? "anomaly" : "anomalies"} flagged (|z| ≥ 2.5σ over a trailing 30-day window).`}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
