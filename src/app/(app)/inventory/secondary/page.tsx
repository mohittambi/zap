"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

type Row = {
  id: number;
  secondary_sku: string;
  master_sku?: string;
  available_quantity?: number;
};

export default function InventorySecondaryPage() {
  const [draft, setDraft] = React.useState("");
  const [keyword, setKeyword] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<{
    total: number;
    content: Row[];
  } | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), count: "100" });
      if (keyword.trim()) q.set("search_keyword", keyword.trim());
      const res = await apiFetch<{ total: number; content: Row[] }>(
        `/api/inventory/secondary_listings/paginated?${q}`
      );
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [keyword, page]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Secondary listings</h1>
        <p className="text-sm text-muted-foreground">
          Paginated secondary SKUs. Open SKU wise from the dedicated tool.
        </p>
      </div>
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label>Search</Label>
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  setKeyword(draft);
                }
              }}
              className="min-h-11"
            />
          </div>
          <Button
            className="min-h-11"
            onClick={() => {
              setPage(1);
              setKeyword(draft);
            }}
          >
            Search
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : !data?.content?.length ? (
            <EmptyState title="No secondary listings" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono">secondary_sku</TableHead>
                    <TableHead>master</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.content.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm">
                        <Link
                          className="text-primary underline-offset-4 hover:underline"
                          href={`/inventory/sku-wise?sku=${encodeURIComponent(r.secondary_sku)}`}
                        >
                          {r.secondary_sku}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.master_sku ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.available_quantity ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {data && data.content.length > 0 && (
            <div className="mt-4 flex justify-between">
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
