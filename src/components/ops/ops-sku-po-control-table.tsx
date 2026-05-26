"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  DataTable,
  DataTableToolbar,
  type DataTableSort,
  type DataTableSortDir,
} from "@/components/data-table";
import type { OpsSkuPoControlListResult } from "@/types/opsSkuPoControl";
import { buildOpsSkuPoControlColumns } from "@/components/ops/ops-sku-po-control-columns";
import { OpsSkuPoControlSummaryStrip } from "@/components/ops/ops-sku-po-control-summary";

export type OpsSkuPoControlTableProps = {
  data: OpsSkuPoControlListResult | null;
  loading: boolean;
  sort: DataTableSort;
  onSortChange: (columnId: string, dir: DataTableSortDir | null) => void;
  page: number;
  onPageChange: (page: number) => void;
  toolbar: React.ReactNode;
  phase?: 1 | 2;
};

export function OpsSkuPoControlTable({
  data,
  loading,
  sort,
  onSortChange,
  page,
  onPageChange,
  toolbar,
  phase = 2,
}: OpsSkuPoControlTableProps) {
  const columns = React.useMemo(
    () => buildOpsSkuPoControlColumns({ phase, companies: data?.companies }),
    [phase, data?.companies]
  );

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.per_page_count))
    : 1;

  return (
    <Card className="border-primary/10 shadow-sm">
      <DataTableToolbar>{toolbar}</DataTableToolbar>
      {data?.summary ? (
        <div className="px-4 pb-3">
          <OpsSkuPoControlSummaryStrip summary={data.summary} skuCount={data.total} />
          <p className="text-muted-foreground mt-2 text-xs">
            {data.meta.computed_from_cache && data.meta.cache_computed_at
              ? `Cached ${new Date(data.meta.cache_computed_at).toLocaleString()} · `
              : "Live-computed (cache missing or >6h old) · "}
            Refreshes after sync:eautomate:all (upserts inbound/outbound POs, GRNs, listings — safe to re-run) + metrics refresh.
          </p>
          {data.meta.pos_without_snapshot > 0 ? (
            <p className="text-muted-foreground mt-2 text-xs">
              {data.meta.pos_without_snapshot} open outbound PO(s) have no line snapshot — run{" "}
              <span className="font-mono">npm run sync:outbound-po-detail</span>.
            </p>
          ) : null}
        </div>
      ) : null}
      <CardContent className="p-0">
        <DataTable
          columns={columns}
          data={data?.content ?? []}
          rowKey={(row) => row.master_sku}
          isLoading={loading}
          emptyMessage={
            <>
              No SKU metrics yet. Run{" "}
              <span className="font-mono">npm run refresh:ops-sku-po-metrics</span> after
              outbound/inbound sync.
            </>
          }
          sort={sort}
          onSortChange={onSortChange}
          stickyFirstColumn
          pagination={
            data && data.total > data.per_page_count
              ? {
                  page,
                  totalPages,
                  total: data.total,
                  pageSize: data.per_page_count,
                  onPageChange,
                }
              : undefined
          }
        />
      </CardContent>
    </Card>
  );
}
