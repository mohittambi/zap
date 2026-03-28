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

export default function InventoryPacksPage() {
  const [draft, setDraft] = React.useState("");
  const [keyword, setKeyword] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<{
    total: number;
    content: { pack_combo_sku_id: string }[];
  } | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), count: "100" });
      if (keyword.trim()) q.set("search_keyword", keyword.trim());
      const res = await apiFetch<{
        total: number;
        content: { pack_combo_sku_id: string }[];
      }>(`/api/inventory/secondary_listings/packs_and_combos/paginated?${q}`);
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
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pack / combo SKUs</h1>
        <p className="text-sm text-muted-foreground">
          Paginated distinct pack/combo IDs.
        </p>
      </div>
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label>Filter</Label>
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  setKeyword(draft);
                }
              }}
              placeholder="Search pack_combo_sku_id…"
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
            Apply
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : !data?.content?.length ? (
            <EmptyState title="No rows" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono">pack_combo_sku_id</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.content.map((r) => (
                    <TableRow key={r.pack_combo_sku_id}>
                      <TableCell className="font-mono text-sm">
                        {r.pack_combo_sku_id}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
