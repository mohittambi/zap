"use client";

import { Button } from "@/components/ui/button";
import type { DataTablePaginationProps } from "./types";

export function DataTablePagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}: DataTablePaginationProps) {
  if (total <= pageSize) return null;

  return (
    <div className="flex items-center justify-between gap-4 border-t px-4 py-3">
      <p className="text-muted-foreground text-xs">
        Page {page} of {totalPages} ({total.toLocaleString()} rows)
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
