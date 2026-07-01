"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  OutboundPoLineItemsTable,
  type OutboundListingsEnvelope,
} from "@/app/(app)/(logistics)/outbound/outbound-po-detail-line-items-table";

type PoListingsPayload = {
  outboundPoId: number;
  poNumber: string | null;
  poStatus: string | null;
  poType: string | null;
  listings: OutboundListingsEnvelope | Record<string, unknown>;
};

function countLineItems(listings: OutboundListingsEnvelope | Record<string, unknown> | undefined): number | null {
  const c = (listings as OutboundListingsEnvelope | undefined)?.content;
  if (!Array.isArray(c)) return null;
  return c.length;
}

export function ConsignmentPoLineItems({
  consignmentId,
  poNumber,
  refreshKey = 0,
}: Readonly<{
  consignmentId: number;
  poNumber: string | null | undefined;
  /** Increment after Save lines to refetch merged PO line view. */
  refreshKey?: number;
}>) {
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [data, setData] = React.useState<PoListingsPayload | null>(null);

  React.useEffect(() => {
    if (!poNumber?.trim()) {
      setLoading(false);
      setData(null);
      setErr(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const payload = await apiFetch<PoListingsPayload>(
          `/api/outbound/consignments/${consignmentId}/po-listings`
        );
        if (!cancelled) setData(payload);
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Failed to load PO line items");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [consignmentId, poNumber, refreshKey]);

  if (!poNumber?.trim()) {
    return null;
  }

  const lineCount = countLineItems(data?.listings);
  const description = data?.poNumber ? (
    <>
      PO <span className="font-mono">{data.poNumber}</span>
      {data.poType ? ` · ${data.poType}` : null}
      {data.poStatus ? ` · ${data.poStatus}` : null}
    </>
  ) : (
    <>Line items from purchase order {poNumber}</>
  );

  return (
    <details
      className={cn(
        "group overflow-hidden rounded-lg border shadow-sm",
        "bg-card text-card-foreground"
      )}
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3",
          "border-b border-transparent group-open:border-border",
          "hover:bg-muted/40 transition-colors"
        )}
      >
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <ChevronDown
            className={cn(
              "text-muted-foreground mt-0.5 size-4 shrink-0 transition-transform",
              "group-open:rotate-180"
            )}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">PO line items</span>
              {lineCount != null ? (
                <Badge variant="secondary" className="text-[10px] font-normal">
                  {lineCount} {lineCount === 1 ? "line" : "lines"}
                </Badge>
              ) : null}
              {loading ? (
                <Loader2 className="text-muted-foreground size-3.5 animate-spin" />
              ) : null}
            </div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {description}
              <span className="mt-0.5 block">
                Packed quantity is for this consignment (Zap).
              </span>
            </p>
          </div>
        </div>
        {data?.outboundPoId ? (
          <div
            className="shrink-0"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" asChild>
              <Link href={`/outbound/po/${data.outboundPoId}`}>
                Open PO
                <ExternalLink className="size-3.5" />
              </Link>
            </Button>
          </div>
        ) : null}
      </summary>
      <div className="px-4 pb-4 pt-3">
        {loading ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading PO line items…
          </p>
        ) : err ? (
          <p className="text-destructive text-sm">{err}</p>
        ) : data ? (
          <OutboundPoLineItemsTable
            listings={data.listings}
            fillRateMode="packed"
            emptyStateContext="consignment"
          />
        ) : null}
      </div>
    </details>
  );
}
