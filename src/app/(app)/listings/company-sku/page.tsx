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
  relation_id: number;
  company_id: number;
  company_name: string;
  company_code_primary: string;
  secondary_sku: string;
};

type PageData = {
  total: number;
  current_page: number;
  per_page_count: number;
  content: Row[];
};

export default function CompanySkuRelationPage() {
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
      const res = await apiFetch<PageData>(`/api/company-sku-relations?${q}`);
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

  const start = data ? (data.current_page - 1) * data.per_page_count + 1 : 0;
  const end = data
    ? Math.min(data.current_page * data.per_page_count, data.total)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-primary text-2xl font-semibold">Secondary Company SKU Relation</h1>
        <p className="text-sm text-muted-foreground">
          Company directory mapped to secondary SKUs.
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
              placeholder="Company id, name, code, secondary SKU…"
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
          {data && (
            <p className="mb-4 text-sm text-muted-foreground">
              Showing {start}–{end} of {data.total}
            </p>
          )}
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : !data?.content?.length ? (
            <EmptyState title="No relations" />
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company Id</TableHead>
                      <TableHead>Company Name</TableHead>
                      <TableHead>Company Code Primary</TableHead>
                      <TableHead>Secondary SKU</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.content.map((row) => (
                      <TableRow key={row.relation_id}>
                        <TableCell className="tabular-nums">{row.company_id}</TableCell>
                        <TableCell>{row.company_name}</TableCell>
                        <TableCell className="font-mono text-sm">{row.company_code_primary}</TableCell>
                        <TableCell className="font-mono text-sm">{row.secondary_sku}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-2 lg:hidden">
                {data.content.map((row) => (
                  <div key={row.relation_id} className="rounded-lg border p-3 text-sm">
                    <p className="font-semibold">{row.company_name}</p>
                    <p className="text-muted-foreground text-xs">
                      #{row.company_id} · {row.company_code_primary}
                    </p>
                    <p className="mt-1 font-mono">{row.secondary_sku}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-between gap-2">
                <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={!data || end >= data.total}
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
