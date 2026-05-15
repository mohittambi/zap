"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type KpiCardProps = {
  value: number | null;
  format?: "number" | "percent";
  delta_mom_pct: number | null;
  delta_yoy_pct: number | null;
  loading?: boolean;
  empty?: { hint: string };
  /** When set, the value becomes a link → drill-down. */
  href?: string;
  /** Optional sparkline data — shown next to the number when chart-type is "sparkline". */
  sparkline?: { day: string; v: number }[];
};

function formatValue(v: number | null, format: "number" | "percent"): string {
  if (v == null) return "—";
  if (format === "percent") return `${v.toFixed(1)}%`;
  return new Intl.NumberFormat("en-IN").format(Math.round(v));
}

function DeltaBadge({ pct, label }: { pct: number | null; label: string }) {
  if (pct == null) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-0.5 text-[11px]">
        <Minus className="size-3" /> {label}
      </span>
    );
  }
  const positive = pct >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  const color = positive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-medium", color)}>
      <Icon className="size-3" />
      {Math.abs(pct).toFixed(1)}% {label}
    </span>
  );
}

/** Inline 80×24 sparkline using bare SVG — no Recharts overhead per KPI tile. */
function Sparkline({ data }: { data: { day: string; v: number }[] }) {
  if (data.length < 2) return null;
  const W = 80;
  const H = 24;
  const max = Math.max(1, ...data.map((p) => p.v));
  const min = Math.min(...data.map((p) => p.v));
  const range = max - min || 1;
  const stepX = W / (data.length - 1);
  const points = data
    .map((p, i) => `${i * stepX},${H - ((p.v - min) / range) * H}`)
    .join(" ");
  return (
    <svg width={W} height={H} className="opacity-80">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        points={points}
        className="text-primary"
      />
    </svg>
  );
}

export function KpiCardBody({
  value,
  format = "number",
  delta_mom_pct,
  delta_yoy_pct,
  loading,
  empty,
  href,
  sparkline,
}: KpiCardProps) {
  if (loading) {
    return <Skeleton className="h-8 w-24" />;
  }
  if (empty) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-2xl font-semibold tabular-nums">—</span>
        <span className="text-muted-foreground text-[11px]">{empty.hint}</span>
      </div>
    );
  }
  const valueEl = (
    <span className="font-heading text-2xl font-semibold tabular-nums">
      {formatValue(value, format)}
    </span>
  );
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        {href ? (
          <Link
            href={href}
            className="hover:text-primary inline-flex items-center gap-1 transition-colors"
          >
            {valueEl}
            <ArrowUpRight className="text-muted-foreground size-3" />
          </Link>
        ) : (
          valueEl
        )}
        {sparkline && sparkline.length > 1 ? (
          <Sparkline data={sparkline} />
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
        <DeltaBadge pct={delta_mom_pct} label="MoM" />
        <DeltaBadge pct={delta_yoy_pct} label="YoY" />
      </div>
    </div>
  );
}
