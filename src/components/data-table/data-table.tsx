"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTablePagination } from "./data-table-pagination";
import type {
  DataTableColumn,
  DataTablePaginationProps,
  DataTableSort,
  DataTableSortDir,
} from "./types";

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string | number;
  isLoading?: boolean;
  emptyMessage?: React.ReactNode;
  sort?: DataTableSort;
  onSortChange?: (columnId: string, dir: DataTableSortDir | null) => void;
  pagination?: DataTablePaginationProps;
  stickyFirstColumn?: boolean;
  className?: string;
  tableClassName?: string;
  onRowClick?: (row: T) => void;
  rowClassName?: string | ((row: T) => string);
};

export function DataTable<T>({
  columns,
  data,
  rowKey,
  isLoading = false,
  emptyMessage = "No rows to display.",
  sort = null,
  onSortChange,
  pagination,
  stickyFirstColumn = false,
  className,
  tableClassName,
  onRowClick,
  rowClassName,
}: DataTableProps<T>) {
  const colCount = columns.length;

  const handleRowClick = (row: T, e: React.MouseEvent<HTMLTableRowElement>) => {
    if (!onRowClick) return;
    const target = e.target as HTMLElement;
    if (target.closest("a,button,input,select,textarea,[role='button']")) return;
    onRowClick(row);
  };

  return (
    <div className={cn("overflow-x-auto", className)}>
      <Table className={tableClassName}>
        <TableHeader>
          <TableRow className="bg-muted/60 hover:bg-muted/60">
            {columns.map((col, idx) => (
              <TableHead
                key={col.id}
                className={cn(
                  "px-3 py-2.5",
                  col.headerClassName,
                  stickyFirstColumn &&
                    idx === 0 &&
                    "bg-muted/60 sticky left-0 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]"
                )}
              >
                {col.sortable && onSortChange ? (
                  <DataTableColumnHeader
                    label={col.header}
                    columnId={col.id}
                    sort={sort}
                    onSortChange={onSortChange}
                  />
                ) : (
                  <span className="font-semibold">{col.header}</span>
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={`sk-${i}`}>
                <TableCell colSpan={colCount}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ))
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={colCount}
                className="text-muted-foreground py-10 text-center text-sm"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => (
              <TableRow
                key={rowKey(row)}
                className={cn(
                  onRowClick && "cursor-pointer hover:bg-muted/60",
                  typeof rowClassName === "function" ? rowClassName(row) : rowClassName
                )}
                onClick={onRowClick ? (e) => handleRowClick(row, e) : undefined}
              >
                {columns.map((col, idx) => (
                  <TableCell
                    key={col.id}
                    className={cn(
                      "px-3 py-2.5",
                      col.className,
                      stickyFirstColumn &&
                        idx === 0 &&
                        "bg-background sticky left-0 z-10 font-mono text-xs shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]"
                    )}
                  >
                    {col.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {pagination ? <DataTablePagination {...pagination} /> : null}
    </div>
  );
}
