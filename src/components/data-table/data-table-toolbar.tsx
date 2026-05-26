"use client";

import type { ReactNode } from "react";
import { CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Toolbar slot for filters, search, and action buttons above a DataTable. */
export function DataTableToolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <CardHeader
      className={cn(
        "flex flex-col gap-4 border-b lg:flex-row lg:items-end lg:justify-between",
        className
      )}
    >
      {children}
    </CardHeader>
  );
}
