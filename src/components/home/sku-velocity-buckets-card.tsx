"use client";

import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  SKU_VELOCITY_FAST_THRESHOLD,
  SKU_VELOCITY_MEDIUM_THRESHOLD,
  type SkuVelocityBuckets,
} from "@/lib/skuVelocity";

const fmt = new Intl.NumberFormat("en-IN");

type Bucket = {
  key: keyof SkuVelocityBuckets;
  label: string;
  rule: string;
  className: string;
  href?: string;
};

const BUCKETS: Bucket[] = [
  {
    key: "fast",
    label: "Fast",
    rule: `≥ ${SKU_VELOCITY_FAST_THRESHOLD}/30d`,
    className: "text-green-700 dark:text-green-400",
  },
  {
    key: "medium",
    label: "Medium",
    rule: `${SKU_VELOCITY_MEDIUM_THRESHOLD}-${SKU_VELOCITY_FAST_THRESHOLD - 1}/30d`,
    className: "text-sky-700 dark:text-sky-400",
  },
  {
    key: "slow",
    label: "Slow",
    rule: `1-${SKU_VELOCITY_MEDIUM_THRESHOLD - 1}/30d`,
    className: "text-amber-700 dark:text-amber-400",
  },
  {
    key: "dead",
    label: "Dead",
    rule: "0/30d, stock > 0",
    className: "text-red-700 dark:text-red-400",
  },
];

export function SkuVelocityBucketsBody({
  buckets,
  loading,
}: {
  buckets: SkuVelocityBuckets | undefined;
  loading: boolean;
}) {
  if (loading || !buckets) {
    return (
      <div className="grid grid-cols-4 gap-3">
        {BUCKETS.map((b) => (
          <Skeleton key={b.key} className="h-16 w-full" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {BUCKETS.map((b) => {
        const inner = (
          <div className="bg-muted/30 hover:bg-muted/50 flex flex-col gap-0.5 rounded px-3 py-2 transition-colors">
            <span
              className={cn(
                "font-heading text-xl font-semibold tabular-nums",
                b.className
              )}
            >
              {fmt.format(buckets[b.key])}
            </span>
            <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
              {b.label}
            </span>
            <span className="text-muted-foreground text-[10px]">{b.rule}</span>
          </div>
        );
        return b.href ? (
          <Link key={b.key} href={b.href} className="block">
            {inner}
          </Link>
        ) : (
          <div key={b.key}>{inner}</div>
        );
      })}
    </div>
  );
}
