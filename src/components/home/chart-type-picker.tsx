"use client";

import { Activity, AreaChart, BarChart3, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChartType } from "@/lib/dashboard-card-ids";

const ICONS: Record<ChartType, typeof Activity> = {
  line: Activity,
  bar: BarChart3,
  area: AreaChart,
  sparkline: TrendingUp,
};

const LABELS: Record<ChartType, string> = {
  line: "Line",
  bar: "Bar",
  area: "Area",
  sparkline: "Sparkline",
};

export function ChartTypePicker({
  value,
  options,
  onChange,
}: {
  value: ChartType;
  options: ChartType[];
  onChange: (next: ChartType) => void;
}) {
  if (options.length <= 1) return null;
  return (
    <div className="border-input inline-flex overflow-hidden rounded-md border" data-no-drag>
      {options.map((t) => {
        const Icon = ICONS[t];
        const active = value === t;
        return (
          <Button
            key={t}
            type="button"
            variant="ghost"
            size="icon-xs"
            title={LABELS[t]}
            aria-label={LABELS[t]}
            onClick={(e) => {
              e.stopPropagation();
              onChange(t);
            }}
            className={cn(
              "h-6 w-6 rounded-none border-0",
              active && "bg-primary text-primary-foreground hover:bg-primary"
            )}
          >
            <Icon className="size-3" />
          </Button>
        );
      })}
    </div>
  );
}
