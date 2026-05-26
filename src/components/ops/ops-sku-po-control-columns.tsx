"use client";

import * as React from "react";
import Link from "next/link";
import type { DataTableColumn } from "@/components/data-table";
import type {
  OpsCompanyOutboundColumn,
  OpsSkuPoControlRow,
} from "@/types/opsSkuPoControl";

export const OPS_SKU_PO_SORTABLE_COLUMN_IDS = [
  "master_sku",
  "open_actual_po_qty",
  "open_po_qty_sent",
  "open_po_fill_rate_pct",
  "total_pending",
  "order_placed_by_ops",
  "app_stock",
  "order_place_pending",
] as const;

function numCell(n: number): React.ReactNode {
  if (!n) return <span className="text-muted-foreground tabular-nums">0</span>;
  return <span className="tabular-nums">{n.toLocaleString("en-IN")}</span>;
}

function pctCell(n: number | null): React.ReactNode {
  if (n == null || !Number.isFinite(n)) {
    return <span className="text-muted-foreground">—</span>;
  }
  return <span className="tabular-nums">{n.toFixed(2)}%</span>;
}

function companyPendingCell(
  row: OpsSkuPoControlRow,
  columnKey: string
): React.ReactNode {
  const co = row.outbound_by_company[columnKey];
  if (!co || co.total_pending <= 0) {
    return <span className="text-muted-foreground tabular-nums">—</span>;
  }
  return (
    <span className="tabular-nums" title={`Open: ${co.open_actual_po_qty}, Sent: ${co.open_po_qty_sent}`}>
      {co.total_pending.toLocaleString("en-IN")}
    </span>
  );
}

export function buildOpsSkuPoControlColumns(opts: {
  phase: 1 | 2;
  companies?: OpsCompanyOutboundColumn[];
}): DataTableColumn<OpsSkuPoControlRow>[] {
  const cols: DataTableColumn<OpsSkuPoControlRow>[] = [
    {
      id: "master_sku",
      header: "Master SKU",
      sortable: true,
      cell: (row) => (
        <Link
          href={`/ops/sku-po-control/${encodeURIComponent(row.master_sku)}`}
          className="text-primary font-mono text-xs font-medium underline-offset-4 hover:underline"
        >
          {row.master_sku}
        </Link>
      ),
    },
    {
      id: "open_actual_po_qty",
      header: "All Co. Open Actual",
      sortable: true,
      className: "text-right",
      headerClassName: "text-right whitespace-nowrap",
      cell: (row) => numCell(row.open_actual_po_qty),
    },
    {
      id: "open_po_qty_sent",
      header: "All Co. Qty Sent",
      sortable: true,
      className: "text-right",
      headerClassName: "text-right whitespace-nowrap",
      cell: (row) => numCell(row.open_po_qty_sent),
    },
    {
      id: "open_po_fill_rate_pct",
      header: "All Co. Fill Rate",
      sortable: true,
      className: "text-right",
      headerClassName: "text-right whitespace-nowrap",
      cell: (row) => pctCell(row.open_po_fill_rate_pct),
    },
    {
      id: "total_pending",
      header: "All Co. Pending",
      sortable: true,
      className: "text-right font-semibold",
      headerClassName: "text-right whitespace-nowrap",
      cell: (row) => numCell(row.total_pending),
    },
  ];

  for (const company of opts.companies ?? []) {
    cols.push({
      id: company.column_key,
      header: (
        <span className="block max-w-[120px] truncate" title={company.name}>
          {company.name} Pending
        </span>
      ),
      sortable: true,
      className: "text-right bg-sky-50/80 dark:bg-sky-950/20",
      headerClassName:
        "text-right whitespace-nowrap bg-sky-50/80 dark:bg-sky-950/20",
      cell: (row) => companyPendingCell(row, company.column_key),
    });
  }

  if (opts.phase >= 2) {
    cols.push(
      {
        id: "order_place_pending",
        header: "Order Place Pending",
        sortable: true,
        className: "bg-yellow-200/80 text-right font-medium dark:bg-yellow-900/40",
        headerClassName: "bg-yellow-200/80 text-right dark:bg-yellow-900/40",
        cell: (row) => numCell(row.order_place_pending),
      },
      {
        id: "order_placed_by_ops",
        header: "Order Placed by Ops",
        sortable: true,
        className: "text-right",
        headerClassName: "text-right",
        cell: (row) => numCell(row.order_placed_by_ops),
      },
      {
        id: "app_stock",
        header: "App Stock",
        sortable: true,
        className: "text-right",
        headerClassName: "text-right",
        cell: (row) => numCell(row.app_stock),
      }
    );
  }

  return cols;
}
