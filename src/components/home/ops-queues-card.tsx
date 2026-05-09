"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
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

export function OpsQueuesBody({
  queues,
  loading,
}: {
  queues: OpsQueues | undefined;
  loading: boolean;
}) {
  if (loading || !queues) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      <Row label="GRN audit" value={queues.audit_pending} href="/inbound" />
      <Row label="Invoice collection" value={queues.invoice_collection_pending} href="/inbound" />
      <Row label="Debit/credit notes" value={queues.debit_credit_notes_pending} href="/inbound" />
    </div>
  );
}
