"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  OpsCompanyOutboundColumn,
  OpsSkuPoControlRow,
} from "@/types/opsSkuPoControl";

export type OpsSkuPoControlDetailPayload = {
  master_sku: string;
  totals: OpsSkuPoControlRow | null;
  companies: OpsCompanyOutboundColumn[];
  outbound_lines: {
    outbound_po_id: number;
    po_number: string;
    company_name: string | null;
    po_secondary_sku: string | null;
    line_demand: number;
    line_packed: number;
    line_dispatched: number;
    line_pending: number;
  }[];
  inbound_lines: {
    vendor_po_id: number;
    vendor_id: number;
    vendor_name: string | null;
    sku_id: string;
    line_quantity: number;
    po_status: string | null;
  }[];
};

function num(n: number): string {
  return n.toLocaleString("en-IN");
}

function TotalsAndCompanyCards({
  t,
  companies,
}: {
  t: OpsSkuPoControlRow;
  companies: OpsCompanyOutboundColumn[];
}) {
  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Totals</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <span className="text-muted-foreground">Total pending</span>
            <p className="font-semibold tabular-nums">{num(t.total_pending)}</p>
          </div>
          <div className="rounded-md bg-yellow-200/80 px-3 py-2 dark:bg-yellow-900/40">
            <span className="text-muted-foreground">Order place pending</span>
            <p className="font-semibold tabular-nums">{num(t.order_place_pending)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Order placed by ops</span>
            <p className="font-semibold tabular-nums">{num(t.order_placed_by_ops)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">App stock</span>
            <p className="font-semibold tabular-nums">{num(t.app_stock)}</p>
          </div>
        </CardContent>
      </Card>

      {companies.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Outbound by company</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead className="text-right">Open actual</TableHead>
                  <TableHead className="text-right">Qty sent</TableHead>
                  <TableHead className="text-right">Fill rate</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => {
                  const co = t.outbound_by_company[company.column_key];
                  return (
                    <TableRow key={company.company_id}>
                      <TableCell>{company.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {num(co?.open_actual_po_qty ?? 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {num(co?.open_po_qty_sent ?? 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {co?.open_po_fill_rate_pct != null
                          ? `${co.open_po_fill_rate_pct.toFixed(2)}%`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {num(co?.total_pending ?? 0)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

function TrailSkeleton() {
  return <Skeleton className="h-40 w-full" />;
}

export function OpsSkuPoControlDetailPanel({
  masterSku,
  companies: companiesProp,
  initialRow,
  listFromCache,
  refreshKey = 0,
  onLoadComplete,
}: {
  masterSku: string;
  companies?: OpsCompanyOutboundColumn[];
  /** Row from list grid — shown immediately while live detail loads. */
  initialRow?: OpsSkuPoControlRow | null;
  listFromCache?: boolean;
  /** Increment to re-fetch detail (trail + totals). */
  refreshKey?: number;
  onLoadComplete?: () => void;
}) {
  const [data, setData] = React.useState<OpsSkuPoControlDetailPayload | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!masterSku) return;
    setLoading(true);
    if (refreshKey > 0) setData(null);
    void apiFetch<OpsSkuPoControlDetailPayload>(
      `/api/ops/sku-po-control/${encodeURIComponent(masterSku)}`
    )
      .then(setData)
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Failed to load detail");
        setData(null);
      })
      .finally(() => {
        setLoading(false);
        onLoadComplete?.();
      });
  }, [masterSku, refreshKey]);

  const companies =
    companiesProp && companiesProp.length > 0
      ? companiesProp
      : (data?.companies ?? []);

  const displayTotals = data?.totals ?? initialRow ?? null;

  const totalsUpdated =
    !loading &&
    data?.totals &&
    initialRow &&
    (data.totals.total_pending !== initialRow.total_pending ||
      data.totals.open_actual_po_qty !== initialRow.open_actual_po_qty);

  if (!displayTotals && loading) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!displayTotals) {
    return (
      <p className="text-muted-foreground p-8 text-sm">
        No metrics found for this master SKU.
      </p>
    );
  }

  return (
    <div className="space-y-4 p-8">
      {totalsUpdated ? (
        <p className="text-muted-foreground rounded-md border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs dark:border-amber-900/50 dark:bg-amber-950/30">
          Totals refreshed from live data
          {listFromCache ? " (list was cached; values now match modal)" : ""}.
        </p>
      ) : null}

      <TotalsAndCompanyCards t={displayTotals} companies={companies} />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Open outbound PO lines</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="p-4">
              <TrailSkeleton />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Channel SKU</TableHead>
                  <TableHead className="text-right">Demand</TableHead>
                  <TableHead className="text-right">Packed</TableHead>
                  <TableHead className="text-right">Dispatched</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.outbound_lines.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground text-center">
                      No open outbound lines
                    </TableCell>
                  </TableRow>
                ) : (
                  data!.outbound_lines.map((line, i) => (
                    <TableRow key={`${line.outbound_po_id}-${i}`}>
                      <TableCell>
                        <Link
                          href={`/outbound/po/${line.outbound_po_id}`}
                          className="text-primary font-mono text-xs hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {line.po_number}
                        </Link>
                      </TableCell>
                      <TableCell>{line.company_name ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {line.po_secondary_sku ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {line.line_demand}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {line.line_packed}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {line.line_dispatched}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {line.line_pending}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Open inbound vendor PO lines</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="p-4">
              <TrailSkeleton />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.inbound_lines.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground text-center">
                      No open inbound lines
                    </TableCell>
                  </TableRow>
                ) : (
                  data!.inbound_lines.map((line, i) => (
                    <TableRow key={`${line.vendor_po_id}-${line.sku_id}-${i}`}>
                      <TableCell>
                        <Link
                          href={`/inbound/vendors/${line.vendor_id}/purchase-orders/${line.vendor_po_id}`}
                          className="text-primary font-mono text-xs hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {line.vendor_po_id}
                        </Link>
                      </TableCell>
                      <TableCell>{line.vendor_name ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{line.sku_id}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {line.line_quantity}
                      </TableCell>
                      <TableCell>{line.po_status ?? "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
