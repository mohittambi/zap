"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { OpenPosStat } from "@/server/services/homeSummaryService";

const fmt = new Intl.NumberFormat("en-IN");

export function OpenPosBody({
  stat,
  loading,
  href,
}: {
  stat: OpenPosStat | undefined;
  loading: boolean;
  href?: string;
}) {
  if (loading || !stat) return <Skeleton className="h-8 w-24" />;
  const value = (
    <span className="font-heading text-2xl font-semibold tabular-nums">
      {fmt.format(stat.open)}
    </span>
  );
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        {href ? (
          <Link href={href} className="hover:text-primary inline-flex items-center gap-1 transition-colors">
            {value}
            <ArrowUpRight className="text-muted-foreground size-3" />
          </Link>
        ) : (
          value
        )}
      </div>
      <span
        className={
          stat.aged_over_7d > 0
            ? "text-amber-700 dark:text-amber-400 text-[11px] font-medium"
            : "text-muted-foreground text-[11px]"
        }
      >
        {fmt.format(stat.aged_over_7d)} aged &gt; 7 days
      </span>
    </div>
  );
}
