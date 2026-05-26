  "use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { AppPageTitle } from "@/components/layout/app-page-shell";
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

type DetailPayload = {
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

export default function OpsSkuPoControlDetailPage() {
  const params = useParams();
  const masterSku = decodeURIComponent(String(params.masterSku ?? ""));
  const [data, setData] = React.useState<DetailPayload | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!masterSku) return;
    setLoading(true);
    void apiFetch<DetailPayload>(
      `/api/ops/sku-po-control/${encodeURIComponent(masterSku)}`
    )
      .then(setData)
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Failed to load detail");
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [masterSku]);

  const t = data?.totals;

  return (
    <div className="space-y-4">
      <AppPageTitle
        title={masterSku}
        description={`SKU PO Control drill-down · live-computed on each load from synced DB (not the list’s 6h cache)`}
      />

      {loading ? (
        <Skeleton className="h-24 w-full" />
      ) : t ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Totals</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <span className="text-muted-foreground">Total pending</span>
              <p className="font-semibold tabular-nums">{t.total_pending}</p>
            </div>
            <div className="rounded-md bg-yellow-200/80 px-2 py-1 dark:bg-yellow-900/40">
              <span className="text-muted-foreground">Order place pending</span>
              <p className="font-semibold tabular-nums">{t.order_place_pending}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Order placed by ops</span>
              <p className="font-semibold tabular-nums">{t.order_placed_by_ops}</p>
            </div>
            <div>
              <span className="text-muted-foreground">App stock</span>
              <p className="font-semibold tabular-nums">{t.app_stock}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!loading && t && data?.companies && data.companies.length > 0 ? (
        <Card>
          <CardHeader>
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
                {data.companies.map((company) => {
                  const co = t.outbound_by_company[company.column_key];
                  if (!co || co.total_pending <= 0) return null;
                  return (
                    <TableRow key={company.company_id}>
                      <TableCell>{company.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {co.open_actual_po_qty.toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {co.open_po_qty_sent.toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {co.open_po_fill_rate_pct != null
                          ? `${co.open_po_fill_rate_pct.toFixed(2)}%`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {co.total_pending.toLocaleString("en-IN")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Open outbound PO lines</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Channel SKU</TableHead>
                <TableHead className="text-right">Demand</TableHead>
                <TableHead className="text-right">Pending</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ) : (data?.outbound_lines.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground text-center">
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
                      {line.line_pending}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Open inbound vendor PO lines</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
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
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ) : (data?.inbound_lines.length ?? 0) === 0 ? (
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
        </CardContent>
      </Card>
    </div>
  );
}
