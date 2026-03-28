"use client";

import * as React from "react";
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
import { AppPageTitle } from "@/components/layout/app-page-shell";

type Row = {
  id: number;
  secondary_sku: string;
  master_sku?: string;
  inventory_sku_id?: string;
  pack_combo_sku_id?: string;
  sku_type?: string;
  inventory_bypass_status?: string;
  ais_quantity?: number;
  effective_available_quantity?: number;
};

export default function ListingsSecondaryPage() {
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
    <div className="space-y-6">
      <AppPageTitle
        title="Secondary Listings"
        description="Channel SKUs mapped to master / inventory SKUs."
      />
      <Card className="border-primary/10 shadow-sm">
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
              placeholder="Search secondary_sku, master_sku, inventory_sku…"
              className="min-h-11 font-mono text-sm"
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
            <Skeleton className="h-64 w-full" />
          ) : !data?.content?.length ? (
            <EmptyState title="No rows" />
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>secondary_sku</TableHead>
                      <TableHead>master_sku</TableHead>
                      <TableHead>inventory_sku</TableHead>
                      <TableHead>pack_combo_sku</TableHead>
                      <TableHead className="text-right">ais_quantity</TableHead>
                      <TableHead className="text-right">effective_available_quantity</TableHead>
                      <TableHead>inventory_bypass_status</TableHead>
                      <TableHead>sku_type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.content.map((row, i) => (
                      <TableRow key={row.id}>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {(page - 1) * 100 + i + 1}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{row.secondary_sku}</TableCell>
                        <TableCell className="font-mono text-sm">{row.master_sku ?? "—"}</TableCell>
                        <TableCell className="font-mono text-sm">{row.inventory_sku_id ?? "—"}</TableCell>
                        <TableCell className="font-mono text-sm">{row.pack_combo_sku_id ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.ais_quantity ?? 0}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.effective_available_quantity ?? "—"}
                        </TableCell>
                        <TableCell>{row.inventory_bypass_status ?? "—"}</TableCell>
                        <TableCell>{row.sku_type ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-2 lg:hidden">
                {data.content.map((row) => (
                  <div key={row.id} className="rounded-lg border p-3 text-sm">
                    <p className="font-mono font-semibold">{row.secondary_sku}</p>
                    <p className="text-muted-foreground text-xs">master {row.master_sku}</p>
                    <p className="mt-1 tabular-nums">Avail: {row.effective_available_quantity ?? "—"}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-between gap-2">
                <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={data.content.length < 100}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
