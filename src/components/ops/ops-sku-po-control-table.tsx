"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  DataTable,
  DataTableToolbar,
  type DataTableSort,
  type DataTableSortDir,
} from "@/components/data-table";
import type {
  OpsCompanyOutboundColumn,
  OpsSkuPoControlListResult,
  OpsSkuPoControlRow,
} from "@/types/opsSkuPoControl";
import { buildOpsSkuPoControlColumns } from "@/components/ops/ops-sku-po-control-columns";
import { OpsSkuPoControlSummaryStrip } from "@/components/ops/ops-sku-po-control-summary";
import { OpsSkuPoControlDetailDialog } from "@/components/ops/ops-sku-po-control-detail-dialog";

export type OpsSkuPoControlTableProps = {
  data: OpsSkuPoControlListResult | null;
  loading: boolean;
  sort: DataTableSort;
  onSortChange: (columnId: string, dir: DataTableSortDir | null) => void;
  page: number;
  onPageChange: (page: number) => void;
  toolbar: React.ReactNode;
  phase?: 1 | 2;
  dataSource?: "cache" | "live";
  statusLine?: string | null;
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
  dataSource,
  statusLine,
}: OpsSkuPoControlTableProps) {
  const [selectedSku, setSelectedSku] = React.useState<string | null>(null);
  const [selectedRow, setSelectedRow] = React.useState<OpsSkuPoControlRow | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [lastCompanies, setLastCompanies] = React.useState<OpsCompanyOutboundColumn[]>(
    []
  );

  React.useEffect(() => {
    if (data?.companies && data.companies.length > 0) {
      setLastCompanies(data.companies);
    }
  }, [data?.companies]);

  const companies =
    data?.companies && data.companies.length > 0 ? data.companies : lastCompanies;

  const columns = React.useMemo(
    () => buildOpsSkuPoControlColumns({ phase, companies }),
    [phase, companies]
  );

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.per_page_count))
    : 1;

  const handleRowClick = React.useCallback((row: OpsSkuPoControlRow) => {
    setSelectedSku(row.master_sku);
    setSelectedRow(row);
    setDetailOpen(true);
  }, []);

  return (
    <>
      <Card className="border-primary/10 shadow-sm">
        <DataTableToolbar className="px-6 py-4">{toolbar}</DataTableToolbar>
        {data?.summary ? (
          <div className="px-6 pb-4">
            <OpsSkuPoControlSummaryStrip summary={data.summary} skuCount={data.total} />
            {statusLine ? (
              <p className="text-muted-foreground mt-3 text-xs font-medium">{statusLine}</p>
            ) : null}
            <p className="text-muted-foreground mt-2 text-xs">
              <span className="font-medium">Refresh</span> (header icon) loads live data, same as
              row detail. <span className="font-medium">Rebuild cache</span> after{" "}
              <span className="font-mono">sync:eautomate:all</span> for faster paging; cache
              auto-invalidates when synced data changes
              {dataSource === "live" ? " · showing live data" : ""}.
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              CI/cron: <span className="font-mono">npm run refresh:ops-sku-po-metrics</span>
            </p>
            {data.meta.pos_without_snapshot > 0 ? (
              <p className="text-muted-foreground mt-2 text-xs">
                {data.meta.pos_without_snapshot} open outbound PO(s) have no line snapshot — run{" "}
                <span className="font-mono">npm run sync:outbound-po-detail</span>.
              </p>
            ) : null}
            <p className="text-muted-foreground mt-2 text-xs">
              Click a row to open SKU detail and PO trail.
            </p>
          </div>
        ) : null}
        <CardContent className="px-2 pb-4 pt-0">
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
            onRowClick={handleRowClick}
            className="rounded-md border"
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

      <OpsSkuPoControlDetailDialog
        masterSku={selectedSku}
        companies={companies}
        initialRow={selectedRow}
        listFromCache={data?.meta.data_source === "cache"}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setSelectedSku(null);
            setSelectedRow(null);
          }
        }}
      />
    </>
  );
}
