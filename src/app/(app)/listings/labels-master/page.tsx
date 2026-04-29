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
        <CardContent className="p-0">
          <div className="hidden overflow-x-auto xl:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
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
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        {[1, 2, 3, 4, 5, 6, 7].map((j) => (
                          <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  : !data?.content?.length
                  ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-muted-foreground py-10 text-center text-sm">
                        No label rows match the current search.
                      </TableCell>
                    </TableRow>
                  )
                  : data.content.map((row) => (
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
          {!loading && data?.content?.length ? (
            <>
              <div className="flex flex-col gap-2 border-t pt-4 px-4 xl:hidden">
                {data.content.map((row) => (
                  <div key={row.id} className="rounded-lg border p-3 text-sm">
                    <p className="font-mono font-semibold">{row.secondary_sku}</p>
                    <p className="text-muted-foreground text-xs">EAN {row.ean_code}</p>
                    <p>MRP {row.mrp ?? "—"}</p>
                  </div>
                ))}
              </div>
              <div className="flex justify-between gap-2 border-t px-4 py-3">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data || data.content.length < data.per_page_count}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
