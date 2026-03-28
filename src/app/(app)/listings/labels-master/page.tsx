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

type Row = {
  id: number;
  secondary_sku: string;
  ean_code?: string | null;
  size?: string | null;
  color?: string | null;
  one_set_contains?: string | null;
  material?: string | null;
  mrp?: string | number | null;
};

type PageData = {
  total: number;
  current_page: number;
  per_page_count: number;
  content: Row[];
};

export default function LabelsMasterPage() {
  const [draft, setDraft] = React.useState("");
  const [keyword, setKeyword] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<PageData | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), count: "100" });
      if (keyword.trim()) q.set("search_keyword", keyword.trim());
      const res = await apiFetch<PageData>(`/api/labels-master?${q}`);
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
      <div>
        <h1 className="text-primary text-2xl font-semibold">Labels Master Data</h1>
        <p className="text-sm text-muted-foreground">
          EAN, size, color, material, and MRP per secondary SKU.
        </p>
      </div>
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
              placeholder="SKU, EAN, color, material…"
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
            <Skeleton className="h-64 w-full" />
          ) : !data?.content?.length ? (
            <EmptyState title="No label rows" />
          ) : (
            <>
              <div className="hidden overflow-x-auto xl:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Secondary SKU</TableHead>
                      <TableHead>EAN</TableHead>
                      <TableHead>size</TableHead>
                      <TableHead>color</TableHead>
                      <TableHead className="max-w-[240px]">long description</TableHead>
                      <TableHead>material</TableHead>
                      <TableHead className="text-right">MRP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.content.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-sm">{row.secondary_sku}</TableCell>
                        <TableCell className="font-mono text-sm">{row.ean_code ?? "—"}</TableCell>
                        <TableCell>{row.size ?? "—"}</TableCell>
                        <TableCell>{row.color ?? "—"}</TableCell>
                        <TableCell className="max-w-[240px] text-xs text-muted-foreground">
                          {row.one_set_contains ?? "—"}
                        </TableCell>
                        <TableCell>{row.material ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.mrp != null ? String(row.mrp) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-2 xl:hidden">
                {data.content.map((row) => (
                  <div key={row.id} className="rounded-lg border p-3 text-sm">
                    <p className="font-mono font-semibold">{row.secondary_sku}</p>
                    <p className="text-muted-foreground text-xs">EAN {row.ean_code}</p>
                    <p>MRP {row.mrp ?? "—"}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-between gap-2">
                <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={!data || data.content.length < data.per_page_count}
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
