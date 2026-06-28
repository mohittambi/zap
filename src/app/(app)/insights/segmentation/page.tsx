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

type Segment = {
  sku_id: string;
  abc: string;
  xyz: string;
  value_30d: number;
  cv: number;
  policy: string;
};

export default function InsightsSegmentationPage() {
  const [matrix, setMatrix] = React.useState<Record<string, number>>({});
  const [segments, setSegments] = React.useState<Segment[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<{ matrix: Record<string, number>; segments: Segment[] }>(
          "/api/insights/segmentation?limit=100"
        );
        setMatrix(data.matrix ?? {});
        setSegments(data.segments ?? []);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load segmentation");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <InsightsShell
      title="SKU Segmentation"
      description="ABC/XYZ classification drives inventory policy recommendations."
    >
      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-9">
            {Object.entries(matrix).map(([key, count]) => (
              <Card key={key} className="shadow-sm">
                <CardContent className="p-3 text-center">
                  <p className="text-muted-foreground text-xs">{key}</p>
                  <p className="text-lg font-semibold">{count}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top SKUs by value</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {segments.length === 0 ? (
                <p className="text-muted-foreground p-6 text-sm">
                  No SKU sales in the last 90 days to classify.
                </p>
              ) : (
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>ABC</TableHead>
                    <TableHead>XYZ</TableHead>
                    <TableHead>Value (30d)</TableHead>
                    <TableHead>CV</TableHead>
                    <TableHead>Policy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {segments.map((row) => (
                    <TableRow key={row.sku_id}>
                      <TableCell className="font-mono text-xs">{row.sku_id}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.abc}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{row.xyz}</Badge>
                      </TableCell>
                      <TableCell>{row.value_30d.toFixed(0)}</TableCell>
                      <TableCell>{row.cv.toFixed(2)}</TableCell>
                      <TableCell className="text-xs">{row.policy}</TableCell>
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
