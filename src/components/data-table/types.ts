import type { ReactNode } from "react";

export type DataTableSortDir = "asc" | "desc";

export type DataTableSort = {
  columnId: string;
  dir: DataTableSortDir;
} | null;

export type DataTableColumn<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
};

export type DataTablePaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};
