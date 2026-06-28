"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { InsightsShell } from "@/components/insights/insights-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type WcSummary = {
  total_capital_tied: number;
  dead_stock_capital: number;
  dio_days: number | null;
  rows: Array<{
    sku_id: string;
    description: string | null;
    on_hand_qty: number;
    unit_cost: number;
    capital_tied: number;
    is_dead_stock: boolean;
  }>;
};

export default function InsightsWorkingCapitalPage() {
  const [data, setData] = React.useState<WcSummary | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    void (async () => {
      try {
        const wc = await apiFetch<WcSummary>("/api/insights/working-capital?limit=50");
        setData(wc);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load working capital");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <InsightsShell
      title="Working Capital"
      description="Capital tied in inventory; unit cost uses latest GRN received price with bulk_price fallback."
    >
      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : data ? (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Total capital tied</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  ₹{data.total_capital_tied.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Dead stock capital</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  ₹{data.dead_stock_capital.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">DIO (days)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {data.dio_days != null ? data.dio_days.toFixed(1) : "—"}
                </p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top SKUs by capital</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>On hand</TableHead>
                    <TableHead>Unit cost</TableHead>
                    <TableHead>Capital</TableHead>
                    <TableHead>Dead?</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((row) => (
                    <TableRow key={row.sku_id}>
                      <TableCell className="font-mono text-xs">{row.sku_id}</TableCell>
                      <TableCell>{row.on_hand_qty}</TableCell>
                      <TableCell>{row.unit_cost.toFixed(2)}</TableCell>
                      <TableCell>{row.capital_tied.toFixed(0)}</TableCell>
                      <TableCell>{row.is_dead_stock ? "Yes" : "No"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </InsightsShell>
  );
}
