"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { VendorQuality } from "@/server/services/homeSummaryService";

function Delta({
  pct,
  label,
  goodDirection,
}: {
  pct: number | null;
  label: string;
  goodDirection: "up" | "down";
}) {
  if (pct == null) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-0.5 text-[11px]">
        <Minus className="size-3" /> {label}
      </span>
    );
  }
  const isUp = pct >= 0;
  const isGood = goodDirection === "up" ? isUp : !isUp;
  const Icon = isUp ? ArrowUpRight : ArrowDownRight;
  const color = isGood ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-medium", color)}>
      <Icon className="size-3" />
      {Math.abs(pct).toFixed(1)}% {label}
    </span>
  );
}

export function VendorQualityCard({
  vq,
  loading,
}: {
  vq: VendorQuality | undefined;
  loading: boolean;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Vendor quality
        </CardTitle>
        <CardDescription className="text-[11px]">GRN ratios, 30 days</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {loading || !vq ? (
          <>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-32" />
          </>
        ) : (
          <>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-baseline gap-2">
                <span className="font-heading text-xl font-semibold tabular-nums">
                  {vq.acceptance_rate_pct.value.toFixed(1)}%
                </span>
                <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
                  Acceptance
                </span>
              </div>
              <div className="flex flex-wrap gap-x-3">
                <Delta pct={vq.acceptance_rate_pct.delta_mom_pct} label="MoM" goodDirection="up" />
                <Delta pct={vq.acceptance_rate_pct.delta_yoy_pct} label="YoY" goodDirection="up" />
              </div>
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-baseline gap-2">
                <span className="font-heading text-xl font-semibold tabular-nums">
                  {vq.shortage_rate_pct.value.toFixed(2)}%
                </span>
                <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
                  Shortage
                </span>
              </div>
              <div className="flex flex-wrap gap-x-3">
                <Delta pct={vq.shortage_rate_pct.delta_mom_pct} label="MoM" goodDirection="down" />
                <Delta pct={vq.shortage_rate_pct.delta_yoy_pct} label="YoY" goodDirection="down" />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
