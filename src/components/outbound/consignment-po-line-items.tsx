"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

export function ConsignmentPoLineItems({
  consignmentId,
  poNumber,
}: Readonly<{
  consignmentId: number;
  poNumber: string | null | undefined;
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
  }, [consignmentId, poNumber]);

  if (!poNumber?.trim()) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>PO line items</span>
          {data?.outboundPoId ? (
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" asChild>
              <Link href={`/outbound/po/${data.outboundPoId}`}>
                Open PO
                <ExternalLink className="size-3.5" />
              </Link>
            </Button>
          ) : null}
        </CardTitle>
        <CardDescription className="text-xs">
          {data?.poNumber ? (
            <>
              PO <span className="font-mono">{data.poNumber}</span>
              {data.poType ? ` · ${data.poType}` : null}
              {data.poStatus ? ` · ${data.poStatus}` : null}
            </>
          ) : (
            <>Line items from purchase order {poNumber}</>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading PO line items…
          </p>
        ) : err ? (
          <p className="text-destructive text-sm">{err}</p>
        ) : data ? (
          <OutboundPoLineItemsTable listings={data.listings} />
        ) : null}
      </CardContent>
    </Card>
  );
}
