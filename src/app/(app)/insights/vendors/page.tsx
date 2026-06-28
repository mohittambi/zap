"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { InsightsShell } from "@/components/insights/insights-shell";
import { Badge } from "@/components/ui/badge";
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

type VendorRow = {
  vendor_id: number;
  vendor_name: string;
  score: number;
  band: string;
  acceptance_rate_pct: number;
  shortage_rate_pct: number;
  rate_diff_dn_count: number;
  grn_count: number;
};

function bandBadge(band: string) {
  if (band === "PREFERRED") return <Badge className="bg-green-100 text-green-800">Preferred</Badge>;
  if (band === "HIGH_RISK") return <Badge variant="destructive">High risk</Badge>;
  if (band === "REVIEW") return <Badge className="bg-amber-100 text-amber-800">Review</Badge>;
  return <Badge variant="secondary">Acceptable</Badge>;
}

function scoreColor(score: number) {
  if (score >= 85) return "text-green-700";
  if (score >= 70) return "text-foreground";
  if (score >= 50) return "text-amber-700";
  return "text-red-700";
}

const BAND_SUMMARY: Array<{ band: string; label: string }> = [
  { band: "PREFERRED", label: "Preferred" },
  { band: "ACCEPTABLE", label: "Acceptable" },
  { band: "REVIEW", label: "Review" },
  { band: "HIGH_RISK", label: "High risk" },
];

export default function InsightsVendorsPage() {
  const [rows, setRows] = React.useState<VendorRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<{ content: VendorRow[] }>("/api/insights/vendors?limit=50");
        setRows(data.content ?? []);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load vendor scores");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const counts = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of rows) map[r.band] = (map[r.band] ?? 0) + 1;
    return map;
  }, [rows]);

  return (
    <InsightsShell
      title="Vendor Reliability"
      description="Composite 0–100 score from acceptance rate, shortage rate, and rate-diff debit notes over the last 90 days."
    >
      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {BAND_SUMMARY.map(({ band, label }) => (
              <Card key={band} className="shadow-sm">
                <CardContent className="p-3 text-center">
                  <p className="text-muted-foreground text-xs">{label}</p>
                  <p className="text-2xl font-semibold">{counts[band] ?? 0}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vendor scorecards</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {rows.length === 0 ? (
                <p className="text-muted-foreground p-6 text-sm">
                  No vendor GRN activity in the last 90 days.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead>Band</TableHead>
                      <TableHead className="text-right">Accept %</TableHead>
                      <TableHead className="text-right">Shortage %</TableHead>
                      <TableHead className="text-right">Rate-diff DNs</TableHead>
                      <TableHead className="text-right">GRNs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.vendor_id}>
                        <TableCell>{row.vendor_name}</TableCell>
                        <TableCell className={`text-right font-semibold ${scoreColor(row.score)}`}>
                          {row.score}
                        </TableCell>
                        <TableCell>{bandBadge(row.band)}</TableCell>
                        <TableCell className="text-right">
                          {row.acceptance_rate_pct.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.shortage_rate_pct.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right">{row.rate_diff_dn_count}</TableCell>
                        <TableCell className="text-right">{row.grn_count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </InsightsShell>
  );
}
