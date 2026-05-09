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
import {
  SortableTableHead,
  type SortPair,
} from "@/components/listings/sortable-table-head";

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

type Sort = "sku_asc" | "sku_desc" | "company_asc" | "company_desc";

type CompanyOption = { id: number; name: string | null };

const SKU_PAIR: SortPair = { asc: "sku_asc" as never, desc: "sku_desc" as never };
const COMPANY_PAIR: SortPair = {
  asc: "company_asc" as never,
  desc: "company_desc" as never,
};

export default function CompanySkuRelationPage() {
  const [draft, setDraft] = React.useState("");
  const [keyword, setKeyword] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [companyId, setCompanyId] = React.useState<number | null>(null);
  const [sort, setSort] = React.useState<Sort>("sku_asc");
  const [companies, setCompanies] = React.useState<CompanyOption[]>([]);
  const [data, setData] = React.useState<PageData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch<{ companies: CompanyOption[] }>(
          "/api/home/companies"
        );
        if (!cancelled) setCompanies(res.companies);
      } catch {
        if (!cancelled) setCompanies([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        page: String(page),
        count: "100",
        sort,
      });
      if (keyword.trim()) q.set("search_keyword", keyword.trim());
      if (companyId != null) q.set("company_id", String(companyId));
      const res = await apiFetch<PageData>(`/api/company-sku-relations?${q}`);
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [keyword, page, companyId, sort]);

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
        <CardHeader className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
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
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
                Company
              </span>
              <select
                value={companyId ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setCompanyId(v === "" ? null : Number(v));
                  setPage(1);
                }}
                className="h-9 min-w-48 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">All companies</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name ?? `#${c.id}`}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {data && (
            <p className="mb-4 text-sm text-muted-foreground">
              Showing {start}–{end} of {data.total}
            </p>
          )}
          <div className="hidden overflow-x-auto lg:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableHead>Company Id</TableHead>
                  <SortableTableHead
                    pair={COMPANY_PAIR}
                    current={sort as never}
                    onChange={(v) => {
                      setSort(v as Sort);
                      setPage(1);
                    }}
                  >
                    Company Name
                  </SortableTableHead>
                  <TableHead>Company Code Primary</TableHead>
                  <SortableTableHead
                    pair={SKU_PAIR}
                    current={sort as never}
                    onChange={(v) => {
                      setSort(v as Sort);
                      setPage(1);
                    }}
                  >
                    Secondary SKU
                  </SortableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        {[1, 2, 3, 4].map((j) => (
                          <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  : !data?.content?.length
                  ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground py-10 text-center text-sm">
                        No company-SKU relations match the current filters.
                      </TableCell>
                    </TableRow>
                  )
                  : data.content.map((row) => (
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
          {!loading && data?.content?.length ? (
            <>
              <div className="flex flex-col gap-2 border-t pt-4 lg:hidden">
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
              <div className="flex justify-between gap-2 border-t px-4 py-3">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data || end >= data.total}
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
