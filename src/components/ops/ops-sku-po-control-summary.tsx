"use client";

import type { OpsSkuPoControlSummary } from "@/types/opsSkuPoControl";

export function OpsSkuPoControlSummaryStrip({
  summary,
  skuCount,
}: {
  summary: OpsSkuPoControlSummary | null | undefined;
  skuCount: number;
}) {
  if (!summary) return null;
  return (
    <div className="bg-muted/40 flex flex-wrap gap-x-6 gap-y-2 rounded-lg border px-4 py-3 text-xs">
      <span>
        <span className="text-muted-foreground">SKUs shown:</span>{" "}
        <span className="font-semibold tabular-nums">{skuCount.toLocaleString("en-IN")}</span>
      </span>
      <span>
        <span className="text-muted-foreground">Σ Open actual:</span>{" "}
        <span className="font-semibold tabular-nums">
          {summary.summary_open_actual_po_qty.toLocaleString("en-IN")}
        </span>
      </span>
      <span>
        <span className="text-muted-foreground">Σ Qty sent:</span>{" "}
        <span className="font-semibold tabular-nums">
          {summary.summary_open_po_qty_sent.toLocaleString("en-IN")}
        </span>
      </span>
      <span>
        <span className="text-muted-foreground">Σ Total pending:</span>{" "}
        <span className="font-semibold tabular-nums">
          {summary.summary_total_pending.toLocaleString("en-IN")}
        </span>
      </span>
      <span>
        <span className="text-muted-foreground">Σ Order place pending:</span>{" "}
        <span className="font-semibold tabular-nums">
          {summary.summary_order_place_pending.toLocaleString("en-IN")}
        </span>
      </span>
    </div>
  );
}
