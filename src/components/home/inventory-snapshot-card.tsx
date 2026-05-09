"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { InventorySnapshot } from "@/server/services/homeSummaryService";

const fmt = new Intl.NumberFormat("en-IN");

function StatRow({
  value,
  label,
  href,
  emphasised,
}: {
  value: string;
  label: string;
  href?: string;
  emphasised?: boolean;
}) {
  const inner = (
    <div className="flex items-baseline gap-2">
      <span
        className={
          emphasised
            ? "text-amber-700 dark:text-amber-400 font-mono text-sm font-semibold tabular-nums"
            : "font-heading text-2xl font-semibold tabular-nums"
        }
      >
        {value}
      </span>
      <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
        {label}
      </span>
      {href ? (
        <ArrowUpRight className="text-muted-foreground ml-auto size-3" />
      ) : null}
    </div>
  );
  if (!href) return inner;
  return (
    <Link
      href={href}
      className="hover:bg-muted -mx-2 block rounded px-2 py-1 transition-colors"
    >
      {inner}
    </Link>
  );
}

export function InventorySnapshotBody({
  snapshot,
  loading,
}: {
  snapshot: InventorySnapshot | undefined;
  loading: boolean;
}) {
  if (loading || !snapshot) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-5 w-28" />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <StatRow
        value={fmt.format(snapshot.units_on_hand)}
        label="Units on hand"
        href="/listings/warehouse?stock_state=in_stock"
      />
      <StatRow
        value={fmt.format(snapshot.skus_at_zero)}
        label="SKUs at zero"
        emphasised={snapshot.skus_at_zero > 0}
        href="/listings/warehouse?stock_state=out_of_stock"
      />
    </div>
  );
}
