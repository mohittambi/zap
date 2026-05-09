"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type KpiCardProps = {
  title: string;
  description?: string;
  value: number | null;
  format?: "number" | "percent";
  delta_mom_pct: number | null;
  delta_yoy_pct: number | null;
  loading?: boolean;
  empty?: { hint: string };
  /** When set, the card body becomes a link; an arrow icon shows top-right. */
  href?: string;
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

export function KpiCard({
  title,
  description,
  value,
  format = "number",
  delta_mom_pct,
  delta_yoy_pct,
  loading,
  empty,
  href,
}: KpiCardProps) {
  const inner = (
    <Card
      size="sm"
      className={href ? "relative hover:border-primary/40 cursor-pointer transition-colors" : undefined}
    >
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          {title}
        </CardTitle>
        {description ? <CardDescription className="text-[11px]">{description}</CardDescription> : null}
        {href ? (
          <ArrowUpRight className="text-muted-foreground absolute right-3 top-3 size-3" />
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5">
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : empty ? (
          <div className="flex flex-col gap-1">
            <span className="text-2xl font-semibold tabular-nums">—</span>
            <span className="text-muted-foreground text-[11px]">{empty.hint}</span>
          </div>
        ) : (
          <>
            <span className="font-heading text-2xl font-semibold tabular-nums">
              {formatValue(value, format)}
            </span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <DeltaBadge pct={delta_mom_pct} label="MoM" />
              <DeltaBadge pct={delta_yoy_pct} label="YoY" />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
  if (!href) return inner;
  return (
    <Link href={href} className="relative block">
      {inner}
    </Link>
  );
}
