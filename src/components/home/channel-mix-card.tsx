"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
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
import type { ChannelMixRow } from "@/server/services/homeSummaryService";

const fmt = new Intl.NumberFormat("en-IN");

export function ChannelMixCard({
  rows,
  loading,
  onCompanyClick,
}: {
  rows: ChannelMixRow[] | null | undefined;
  loading: boolean;
  /** Click handler when a bar is clicked. Passes the company name. */
  onCompanyClick?: (companyName: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Channel mix — top 5 (trailing 30 days)</CardTitle>
        <CardDescription className="text-xs">
          Units shipped per company. Pick a company in the filter to drill into one channel.
        </CardDescription>
      </CardHeader>
      <CardContent className="h-[260px]">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : !rows || rows.length === 0 ? (
          <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
            No shipments in this window.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 8, right: 24, left: 16, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                type="number"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => fmt.format(v)}
              />
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
        )}
      </CardContent>
    </Card>
  );
}
