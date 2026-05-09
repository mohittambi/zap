"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { OpenPosStat } from "@/server/services/homeSummaryService";

const fmt = new Intl.NumberFormat("en-IN");

export function OpenPosCard({
  stat,
  loading,
  href,
}: {
  stat: OpenPosStat | undefined;
  loading: boolean;
  href?: string;
}) {
  const card = (
    <Card
      size="sm"
      className={href ? "relative hover:border-primary/40 cursor-pointer transition-colors" : undefined}
    >
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Open sales POs
        </CardTitle>
        <CardDescription className="text-[11px]">
          OPEN + ACKNOWLEDGEMENT PENDING
        </CardDescription>
        {href ? (
          <ArrowUpRight className="text-muted-foreground absolute right-3 top-3 size-3" />
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5">
        {loading || !stat ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <>
            <span className="font-heading text-2xl font-semibold tabular-nums">
              {fmt.format(stat.open)}
            </span>
            <span
              className={
                stat.aged_over_7d > 0
                  ? "text-amber-700 dark:text-amber-400 text-[11px] font-medium"
                  : "text-muted-foreground text-[11px]"
              }
            >
              {fmt.format(stat.aged_over_7d)} aged &gt; 7 days
            </span>
          </>
        )}
      </CardContent>
    </Card>
  );
  if (!href) return card;
  return <Link href={href} className="block">{card}</Link>;
}
