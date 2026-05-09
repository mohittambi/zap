"use client";

import * as React from "react";
import { GripVertical } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CardActionsMenu,
  type CardAction,
} from "@/components/home/card-actions-menu";
import { ChartTypePicker } from "@/components/home/chart-type-picker";
import type { ChartType } from "@/lib/dashboard-card-ids";

export type CardFrameProps = {
  title: string;
  description?: string;
  /** Chart-type swap, only when the card supports more than one type. */
  chartType?: { value: ChartType; options: ChartType[]; onChange: (t: ChartType) => void };
  /** Overflow menu actions in the order they appear. */
  actions?: { available: CardAction[]; onAction: (action: CardAction) => void };
  /** Render a small "Custom filter" badge next to the title. */
  filterActive?: boolean;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
};

/**
 * Shared card chrome for every dashboard tile. The DOM contract:
 *   - the header is the drag handle (`.dashboard-grid-handle` for react-grid-layout)
 *   - any element with `data-no-drag` (chart-type buttons, action menu, etc.)
 *     is excluded by `react-grid-layout` via the `cancel` prop on DashboardGrid
 *   - the card body is non-draggable so links inside it stay clickable
 */
export function CardFrame({
  title,
  description,
  chartType,
  actions,
  filterActive,
  className,
  bodyClassName,
  children,
}: CardFrameProps) {
  return (
    <Card
      size="sm"
      className={cn(
        "flex h-full flex-col overflow-hidden",
        className
      )}
    >
      <header className="dashboard-grid-handle flex shrink-0 cursor-grab items-start gap-2 border-b px-3 py-2 active:cursor-grabbing">
        <GripVertical className="text-muted-foreground/60 mt-0.5 size-3.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-foreground text-xs font-medium uppercase tracking-wide">
              {title}
            </span>
            {filterActive ? (
              <Badge variant="outline" className="h-4 px-1 text-[9px]">
                Custom filter
              </Badge>
            ) : null}
          </div>
          {description ? (
            <p className="text-muted-foreground truncate text-[11px]">{description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1" data-no-drag>
          {chartType ? (
            <ChartTypePicker
              value={chartType.value}
              options={chartType.options}
              onChange={chartType.onChange}
            />
          ) : null}
          {actions ? (
            <CardActionsMenu available={actions.available} onAction={actions.onAction} />
          ) : null}
        </div>
      </header>
      <div className={cn("flex min-h-0 flex-1 flex-col overflow-auto p-3", bodyClassName)}>
        {children}
      </div>
    </Card>
  );
}
