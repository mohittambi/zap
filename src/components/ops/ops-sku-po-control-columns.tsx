"use client";

import * as React from "react";
import type { DataTableColumn } from "@/components/data-table";
import type {
  OpsCompanyOutboundColumn,
  OpsSkuPoControlRow,
} from "@/types/opsSkuPoControl";
import {
  companyOutboundOpenColumnKey,
  companyOutboundSentColumnKey,
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

const COMPANY_GROUP_CLASS =
  "text-right bg-sky-50/80 dark:bg-sky-950/20 border-l border-sky-200/80 dark:border-sky-800/50";
const COMPANY_GROUP_HEADER_CLASS =
  "text-right whitespace-nowrap text-xs bg-sky-50/80 dark:bg-sky-950/20 border-l border-sky-200/80 dark:border-sky-800/50";

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

function companyMetricCell(
  row: OpsSkuPoControlRow,
  columnKey: string,
  field: "open_actual_po_qty" | "open_po_qty_sent" | "total_pending"
): React.ReactNode {
  const co = row.outbound_by_company[columnKey];
  const n = co?.[field] ?? 0;
  if (!n) return <span className="text-muted-foreground tabular-nums">0</span>;
  if (field === "total_pending") {
    return (
      <span
        className="tabular-nums font-medium"
        title={`Open: ${co?.open_actual_po_qty ?? 0}, Sent: ${co?.open_po_qty_sent ?? 0}`}
      >
        {n.toLocaleString("en-IN")}
      </span>
    );
  }
  return <span className="tabular-nums">{n.toLocaleString("en-IN")}</span>;
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
      className: "font-mono text-xs",
      cell: (row) => (
        <span className="font-mono text-xs font-medium">{row.master_sku}</span>
      ),
    },
    {
      id: "open_actual_po_qty",
      header: "All Co. Open Actual",
      sortable: true,
      className: "text-right",
      headerClassName: "text-right whitespace-nowrap text-xs",
      cell: (row) => numCell(row.open_actual_po_qty),
    },
    {
      id: "open_po_qty_sent",
      header: "All Co. Qty Sent",
      sortable: true,
      className: "text-right",
      headerClassName: "text-right whitespace-nowrap text-xs",
      cell: (row) => numCell(row.open_po_qty_sent),
    },
    {
      id: "open_po_fill_rate_pct",
      header: "All Co. Fill Rate",
      sortable: true,
      className: "text-right",
      headerClassName: "text-right whitespace-nowrap text-xs",
      cell: (row) => pctCell(row.open_po_fill_rate_pct),
    },
    {
      id: "total_pending",
      header: "All Co. Pending",
      sortable: true,
      className: "text-right font-semibold",
      headerClassName: "text-right whitespace-nowrap text-xs",
      cell: (row) => numCell(row.total_pending),
    },
  ];

  for (const company of opts.companies ?? []) {
    const dataKey = company.column_key;
    cols.push(
      {
        id: companyOutboundOpenColumnKey(company.company_id),
        header: (
          <span className="whitespace-nowrap" title={`${company.name} — open actual`}>
            {company.name} Open
          </span>
        ),
        sortable: true,
        className: COMPANY_GROUP_CLASS,
        headerClassName: COMPANY_GROUP_HEADER_CLASS,
        cell: (row) => companyMetricCell(row, dataKey, "open_actual_po_qty"),
      },
      {
        id: companyOutboundSentColumnKey(company.company_id),
        header: (
          <span className="whitespace-nowrap" title={`${company.name} — qty sent`}>
            {company.name} Sent
          </span>
        ),
        sortable: true,
        className: COMPANY_GROUP_CLASS,
        headerClassName: COMPANY_GROUP_HEADER_CLASS,
        cell: (row) => companyMetricCell(row, dataKey, "open_po_qty_sent"),
      },
      {
        id: company.column_key,
        header: (
          <span className="whitespace-nowrap" title={`${company.name} — pending`}>
            {company.name} Pending
          </span>
        ),
        sortable: true,
        className: `${COMPANY_GROUP_CLASS} font-medium`,
        headerClassName: COMPANY_GROUP_HEADER_CLASS,
        cell: (row) => companyMetricCell(row, dataKey, "total_pending"),
      }
    );
  }

  if (opts.phase >= 2) {
    cols.push(
      {
        id: "order_place_pending",
        header: "Order Place Pending",
        sortable: true,
        className: "bg-yellow-200/80 text-right font-medium dark:bg-yellow-900/40",
        headerClassName:
          "bg-yellow-200/80 text-right whitespace-nowrap text-xs dark:bg-yellow-900/40",
        cell: (row) => numCell(row.order_place_pending),
      },
      {
        id: "order_placed_by_ops",
        header: "Order Placed by Ops",
        sortable: true,
        className: "text-right",
        headerClassName: "text-right whitespace-nowrap text-xs",
        cell: (row) => numCell(row.order_placed_by_ops),
      },
      {
        id: "app_stock",
        header: "App Stock",
        sortable: true,
        className: "text-right",
        headerClassName: "text-right whitespace-nowrap text-xs",
        cell: (row) => numCell(row.app_stock),
      }
    );
  }

  return cols;
}
