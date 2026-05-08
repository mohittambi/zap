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
import type { TrendPoint } from "@/server/services/homeSummaryService";

function shortDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        {description ? <CardDescription className="text-xs">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="h-[260px]">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : empty ? (
          <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
            No data in this window.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="day"
                tickFormatter={shortDay}
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis tick={{ fontSize: 11 }} width={48} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                labelFormatter={(label) => `Day ${shortDay(String(label))}`}
              />
              <Line
                type="monotone"
                dataKey="v"
                name="This year"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={false}
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
        )}
      </CardContent>
    </Card>
  );
}
