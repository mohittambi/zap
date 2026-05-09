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
import type { OpsQueues } from "@/server/services/homeSummaryService";

const fmt = new Intl.NumberFormat("en-IN");

function Row({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="hover:bg-muted -mx-2 flex items-center justify-between rounded px-2 py-1.5 transition-colors"
    >
      <span className="text-xs">{label}</span>
      <span className="inline-flex items-center gap-1 font-mono text-sm font-semibold tabular-nums">
        {fmt.format(value)}
        <ArrowUpRight className="text-muted-foreground size-3" />
      </span>
    </Link>
  );
}

export function OpsQueuesCard({
  queues,
  loading,
}: {
  queues: OpsQueues | undefined;
  loading: boolean;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Ops queues
        </CardTitle>
        <CardDescription className="text-[11px]">Pending action</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-0.5">
        {loading || !queues ? (
          <>
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </>
        ) : (
          <>
            <Row label="GRN audit" value={queues.audit_pending} href="/inbound" />
            <Row label="Invoice collection" value={queues.invoice_collection_pending} href="/inbound" />
            <Row label="Debit/credit notes" value={queues.debit_credit_notes_pending} href="/inbound" />
          </>
        )}
      </CardContent>
    </Card>
  );
}
