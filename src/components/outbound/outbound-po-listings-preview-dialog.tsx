"use client";

import * as React from "react";
import { Loader2, Maximize2, Minimize2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import type {
  OutboundPoListingsPreview,
  OutboundPoListingsPreviewRow,
  OutboundPoListingsPreviewRowStatus,
} from "@/server/services/outboundPurchaseOrdersService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ViewSize = "compact" | "fullscreen";
type RowFilter = "all" | "issues";

function statusBadgeVariant(
  status: OutboundPoListingsPreviewRowStatus
): "outline" | "secondary" | "destructive" {
  if (status === "error") return "destructive";
  if (status === "warning" || status === "repaired") return "secondary";
  return "outline";
}

function isIssueRow(row: OutboundPoListingsPreviewRow): boolean {
  return row.status !== "ok";
}

function commercialCellClass(status: OutboundPoListingsPreviewRowStatus): string {
  if (status === "error") {
    return "bg-destructive/10 text-destructive";
  }
  if (status === "repaired" || status === "warning") {
    return "bg-amber-500/10 text-amber-900 dark:text-amber-200";
  }
  return "";
}

function RowDetailPanel({ row }: { row: OutboundPoListingsPreviewRow }) {
  const entries = Object.entries(row.skuReportCells).filter(([, v]) => v !== "");
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={statusBadgeVariant(row.status)} className="font-normal">
          {row.status}
        </Badge>
        <span className="text-muted-foreground font-mono text-xs">
          Row {row.rowNumber}
          {row.po_secondary_sku ? ` · ${row.po_secondary_sku}` : ""}
        </span>
      </div>
      {row.issues.length > 0 ? (
        <ul className="text-muted-foreground list-disc space-y-1 pl-4 text-xs">
          {row.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}
      <dl className="grid gap-2 sm:grid-cols-2">
        {entries.map(([key, value]) => (
          <div key={key} className="min-w-0 rounded-md border px-2 py-1.5">
            <dt className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
              {key.replaceAll("_", " ")}
            </dt>
            <dd className="mt-0.5 break-words font-mono text-xs">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function PreviewTable({
  rows,
  viewSize,
  selectedRowNumber,
  expandedRowNumber,
  onSelectRow,
  onToggleExpand,
}: {
  rows: OutboundPoListingsPreviewRow[];
  viewSize: ViewSize;
  selectedRowNumber: number | null;
  expandedRowNumber: number | null;
  onSelectRow: (rowNumber: number) => void;
  onToggleExpand: (rowNumber: number) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[720px] border-collapse text-left text-xs">
        <thead>
          <tr className="bg-muted/50 border-b">
            <th className="px-2 py-2">#</th>
            <th className="px-2 py-2">SKU</th>
            <th className="min-w-[180px] px-2 py-2">Title</th>
            <th className="px-2 py-2">Color</th>
            <th className="px-2 py-2 text-right">Rate</th>
            <th className="px-2 py-2 text-right">GST %</th>
            <th className="px-2 py-2 text-right">Demand</th>
            <th className="px-2 py-2 text-right">MRP</th>
            <th className="px-2 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const selected = selectedRowNumber === row.rowNumber;
            const expanded = expandedRowNumber === row.rowNumber;
            const commercialClass = commercialCellClass(row.status);
            return (
              <React.Fragment key={row.rowNumber}>
                <tr
                  className={cn(
                    "border-b align-top cursor-pointer hover:bg-muted/40 transition-colors",
                    selected && viewSize === "fullscreen" && "bg-primary/5"
                  )}
                  onClick={() => {
                    onSelectRow(row.rowNumber);
                    if (viewSize === "compact") onToggleExpand(row.rowNumber);
                  }}
                >
                  <td className="px-2 py-2 tabular-nums">{row.rowNumber}</td>
                  <td className="px-2 py-2 font-mono">{row.po_secondary_sku ?? "—"}</td>
                  <td className="max-w-[220px] px-2 py-2 leading-snug">{row.title ?? "—"}</td>
                  <td className={cn("px-2 py-2", commercialClass)}>{row.color ?? "—"}</td>
                  <td className={cn("px-2 py-2 text-right tabular-nums", commercialClass)}>
                    {row.rate_without_tax ?? "—"}
                  </td>
                  <td className={cn("px-2 py-2 text-right tabular-nums", commercialClass)}>
                    {row.tax_rate ?? "—"}
                  </td>
                  <td className={cn("px-2 py-2 text-right tabular-nums", commercialClass)}>
                    {row.demand ?? "—"}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{row.mrp ?? "—"}</td>
                  <td className="px-2 py-2">
                    <Badge variant={statusBadgeVariant(row.status)} className="font-normal">
                      {row.status}
                    </Badge>
                  </td>
                </tr>
                {viewSize === "compact" && expanded ? (
                  <tr className="bg-muted/20 border-b">
                    <td colSpan={9} className="px-3 py-3">
                      <RowDetailPanel row={row} />
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function OutboundPoListingsPreviewDialog({
  poId,
  poNumber,
  open,
  onOpenChange,
  onDownloadSkuReport,
  downloadBusy = false,
}: Readonly<{
  poId: number;
  poNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownloadSkuReport?: () => void;
  downloadBusy?: boolean;
}>) {
  const [loading, setLoading] = React.useState(false);
  const [preview, setPreview] = React.useState<OutboundPoListingsPreview | null>(null);
  const [viewSize, setViewSize] = React.useState<ViewSize>("compact");
  const [rowFilter, setRowFilter] = React.useState<RowFilter>("all");
  const [selectedRowNumber, setSelectedRowNumber] = React.useState<number | null>(null);
  const [expandedRowNumber, setExpandedRowNumber] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!open) {
      setPreview(null);
      setViewSize("compact");
      setRowFilter("all");
      setSelectedRowNumber(null);
      setExpandedRowNumber(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const data = await apiFetch<OutboundPoListingsPreview>(
          `/api/outbound/purchase-orders/${poId}/eautomate-actions`,
          {
            method: "POST",
            body: JSON.stringify({ action: "preview_listings" }),
          }
        );
        if (!cancelled) setPreview(data);
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Preview failed");
          onOpenChange(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, poId, onOpenChange]);

  const filteredRows = React.useMemo(() => {
    if (!preview) return [];
    if (rowFilter === "issues") return preview.rowsPreview.filter(isIssueRow);
    return preview.rowsPreview;
  }, [preview, rowFilter]);

  const selectedRow = React.useMemo(() => {
    if (!preview || selectedRowNumber == null) return null;
    return preview.rowsPreview.find((r) => r.rowNumber === selectedRowNumber) ?? null;
  }, [preview, selectedRowNumber]);

  const dialogClass =
    viewSize === "fullscreen"
      ? "flex h-[90vh] w-[95vw] max-w-6xl flex-col gap-0 p-0"
      : "sm:max-w-3xl";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogClass, viewSize === "fullscreen" && "overflow-hidden")} showCloseButton>
        <DialogHeader className={cn(viewSize === "fullscreen" && "shrink-0 border-b px-6 py-4")}>
          <DialogTitle>Preview line items</DialogTitle>
          <DialogDescription>
            PO {poNumber} — normalized values as they would appear in the SKU Level Report.
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            "space-y-4",
            viewSize === "fullscreen" ? "flex min-h-0 flex-1 flex-col px-6 py-4" : "max-h-[60vh] overflow-y-auto"
          )}
        >
          {loading ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Loading preview…
            </div>
          ) : preview ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{preview.stats.totalRows} rows</Badge>
                {preview.stats.repairedCount > 0 ? (
                  <Badge variant="secondary">{preview.stats.repairedCount} repaired</Badge>
                ) : null}
                {preview.stats.warningCount > 0 ? (
                  <Badge variant="secondary">{preview.stats.warningCount} warnings</Badge>
                ) : null}
                {preview.stats.errorCount > 0 ? (
                  <Badge variant="destructive">{preview.stats.errorCount} errors</Badge>
                ) : null}
              </div>

              {preview.parseWarning ? (
                <p className="rounded-md border border-amber-300/80 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                  {preview.parseWarning}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={viewSize === "compact" ? "default" : "outline"}
                    onClick={() => setViewSize("compact")}
                  >
                    <Minimize2 className="mr-1 size-3.5" />
                    Compact
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={viewSize === "fullscreen" ? "default" : "outline"}
                    onClick={() => setViewSize("fullscreen")}
                  >
                    <Maximize2 className="mr-1 size-3.5" />
                    Full screen
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={rowFilter === "all" ? "default" : "outline"}
                    onClick={() => setRowFilter("all")}
                  >
                    All
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={rowFilter === "issues" ? "default" : "outline"}
                    onClick={() => setRowFilter("issues")}
                  >
                    Issues only
                  </Button>
                </div>
              </div>

              {viewSize === "fullscreen" ? (
                <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                  <div className="min-h-0 overflow-y-auto">
                    <PreviewTable
                      rows={filteredRows}
                      viewSize={viewSize}
                      selectedRowNumber={selectedRowNumber}
                      expandedRowNumber={expandedRowNumber}
                      onSelectRow={setSelectedRowNumber}
                      onToggleExpand={setExpandedRowNumber}
                    />
                  </div>
                  <div className="min-h-0 overflow-y-auto rounded-md border p-3">
                    {selectedRow ? (
                      <RowDetailPanel row={selectedRow} />
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        Select a row to see full SKU report fields and repair notes.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <PreviewTable
                  rows={filteredRows}
                  viewSize={viewSize}
                  selectedRowNumber={selectedRowNumber}
                  expandedRowNumber={expandedRowNumber}
                  onSelectRow={setSelectedRowNumber}
                  onToggleExpand={(n) =>
                    setExpandedRowNumber((prev) => (prev === n ? null : n))
                  }
                />
              )}
            </>
          ) : null}
        </div>

        <DialogFooter
          className={cn(viewSize === "fullscreen" && "shrink-0 border-t px-6 py-4")}
        >
          {onDownloadSkuReport ? (
            <Button
              type="button"
              variant="outline"
              disabled={downloadBusy || loading || !preview?.ok}
              onClick={onDownloadSkuReport}
            >
              {downloadBusy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Download SKU Level Report
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
