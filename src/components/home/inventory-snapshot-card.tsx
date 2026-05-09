"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { InventorySnapshot } from "@/server/services/homeSummaryService";

const fmt = new Intl.NumberFormat("en-IN");

export function InventorySnapshotCard({
  snapshot,
  scopedToCompany,
  loading,
}: {
  snapshot: InventorySnapshot | undefined;
  scopedToCompany: boolean;
  loading: boolean;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Inventory snapshot
        </CardTitle>
        <CardDescription className="text-[11px]">
          {scopedToCompany ? "Across catalogue" : "Live, point-in-time"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {loading || !snapshot ? (
          <>
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-5 w-28" />
          </>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-2xl font-semibold tabular-nums">
                {fmt.format(snapshot.units_on_hand)}
              </span>
              <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
                Units on hand
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className={
                  snapshot.skus_at_zero > 0
                    ? "text-amber-700 dark:text-amber-400 font-mono text-sm font-semibold tabular-nums"
                    : "font-mono text-sm font-semibold tabular-nums"
                }
              >
                {fmt.format(snapshot.skus_at_zero)}
              </span>
              <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
                SKUs at zero
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
