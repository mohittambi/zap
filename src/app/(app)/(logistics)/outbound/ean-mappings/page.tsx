"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { AppPageTitle } from "@/components/layout/app-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  DataTable,
  DataTableToolbar,
  type DataTableColumn,
  type DataTableSort,
  type DataTableSortDir,
} from "@/components/data-table";

type EanColumnConfig = {
  company_id: number;
  column_key: string;
  label: string;
};

type MatrixRow = {
  sku_code: string;
  universal_ean: string | null;
  by_column: Record<string, string | null>;
};

type MatrixPageData = {
  total: number;
  current_page: number;
  per_page_count: number;
  curr_page_count: number;
  columns: EanColumnConfig[];
  content: MatrixRow[];
  summary: { total_mappings: number; sku_count: number };
};

function cellValue(v: string | null | undefined): React.ReactNode {
  const s = v?.trim();
  if (!s) return <span className="text-muted-foreground">—</span>;
  return <span className="font-mono text-xs tabular-nums">{s}</span>;
}

export default function OutboundEanMappingsPage() {
  const [draftSearch, setDraftSearch] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [companyId, setCompanyId] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [sort, setSort] = React.useState<DataTableSort>({
    columnId: "sku_code",
    dir: "asc",
  });
  const [data, setData] = React.useState<MatrixPageData | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        page: String(page),
        limit: "50",
      });
      if (search.trim()) q.set("search", search.trim());
      if (companyId) q.set("company_id", companyId);
      if (sort) {
        q.set("sort", sort.columnId);
        q.set("sort_dir", sort.dir);
      }
      const res = await apiFetch<MatrixPageData>(`/api/ean-mappings/matrix?${q}`);
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load EAN mappings");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, search, companyId, sort]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleSortChange = React.useCallback(
    (columnId: string, dir: DataTableSortDir | null) => {
      setPage(1);
      if (!dir) {
        setSort({ columnId: "sku_code", dir: "asc" });
        return;
      }
      setSort({ columnId, dir });
    },
    []
  );

  const columns = React.useMemo((): DataTableColumn<MatrixRow>[] => {
    const fixed: DataTableColumn<MatrixRow>[] = [
      {
        id: "sku_code",
        header: "SKU Code",
        sortable: true,
        cell: (row) => (
          <Link
            href={`/listings/${encodeURIComponent(row.sku_code)}`}
            className="text-primary font-mono text-xs font-medium underline-offset-4 hover:underline"
          >
            {row.sku_code}
          </Link>
        ),
      },
      {
        id: "universal_ean",
        header: "Universal EAN (EAN 1)",
        sortable: true,
        cell: (row) => cellValue(row.universal_ean),
      },
    ];
    const dynamic: DataTableColumn<MatrixRow>[] = (data?.columns ?? []).map(
      (col) => ({
        id: col.column_key,
        header: col.label,
        sortable: true,
        className: "max-w-[200px]",
        cell: (row) => cellValue(row.by_column[col.column_key]),
      })
    );
    return [...fixed, ...dynamic];
  }, [data?.columns]);

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.per_page_count))
    : 1;

  const companyOptions = data?.columns ?? [];

  return (
    <div className="space-y-4">
      <AppPageTitle
        title="SKU / EAN Mappings"
        description="Company-specific EAN and item codes per master SKU (wide view). Used on outbound PO line items and consignment dispatch."
      />
      {data?.summary ? (
        <p className="text-muted-foreground text-xs">
          {data.summary.sku_count.toLocaleString()} SKUs ·{" "}
          {data.summary.total_mappings.toLocaleString()} mapping rows
          {companyId
            ? ` · filtered to ${companyOptions.find((c) => String(c.company_id) === companyId)?.label ?? "company"}`
            : ""}
        </p>
      ) : null}

      <Card className="border-primary/10 shadow-sm">
        <DataTableToolbar>
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-[200px] flex-1 space-y-2">
              <Label htmlFor="ean-matrix-company">Company filter</Label>
              <select
                id="ean-matrix-company"
                className="border-input bg-background h-11 w-full rounded-md border px-3 text-sm"
                value={companyId}
                onChange={(e) => {
                  setCompanyId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All companies</option>
                {companyOptions.map((c) => (
                  <option key={c.company_id} value={String(c.company_id)}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[220px] flex-[2] space-y-2">
              <Label htmlFor="ean-matrix-search">Search</Label>
              <Input
                id="ean-matrix-search"
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setPage(1);
                    setSearch(draftSearch);
                  }
                }}
                placeholder="SKU code or any EAN value…"
                className="min-h-11"
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="min-h-11"
                onClick={() => {
                  setPage(1);
                  setSearch(draftSearch);
                }}
              >
                Apply
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => {
                  setDraftSearch("");
                  setSearch("");
                  setCompanyId("");
                  setPage(1);
                  setSort({ columnId: "sku_code", dir: "asc" });
                }}
              >
                Reset
              </Button>
            </div>
          </div>
        </DataTableToolbar>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={data?.content ?? []}
            rowKey={(row) => row.sku_code}
            isLoading={loading}
            emptyMessage={
              <>
                No mappings found. Run{" "}
                <span className="font-mono">npm run migrate</span> then{" "}
                <span className="font-mono">npm run seed:ean-mappings</span>.
              </>
            }
            sort={sort}
            onSortChange={handleSortChange}
            stickyFirstColumn
            pagination={
              data && data.total > data.per_page_count
                ? {
                    page,
                    totalPages,
                    total: data.total,
                    pageSize: data.per_page_count,
                    onPageChange: setPage,
                  }
                : undefined
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
