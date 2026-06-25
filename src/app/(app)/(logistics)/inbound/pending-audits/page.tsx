"use client";

import * as React from "react";
import Link from "next/link";
import { CircleHelp, ListFilter, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MermaidDiagram } from "@/components/ui/mermaid";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { AppPageTitle } from "@/components/layout/app-page-shell";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type GrnRow = {
  grn_id: number;
  po_id: number;
  vendor_id: number;
  vendor_name: string | null;
  grn_status: string | null;
  grn_audit_status: string | null;
  grn_audit_by: string | null;
  vendor_invoice_number: string | null;
  box_count_invoice: number;
  actual_box_count_recieved: number;
  grn_sku_count: number;
  grn_accepted_quantity: string;
  grn_rejected_quantity: string;
  grn_shortage_quantity: string;
  po_sku_count: number;
  po_total_quantity: number;
  created_by: string | null;
  created_at: string | null;
  grn_audit_price_total?: number | null;
};

type GrnListResponse = {
  total: number;
  current_page: number;
  per_page_count: number;
  curr_page_count: number;
  content: GrnRow[];
};

type AuditLine = {
  line_index: number;
  sku_id: string | null;
  sku_description: string | null;
  quantity: number;
  rejected_quantity: number;
  short_quantity: number;
  vendor_price: number;
  audit_price: number;
  price_diff: number;
  debit_amount: number;
  has_discrepancy: boolean;
};

const PENDING_AUDITS_WORKFLOW = `
flowchart TD
  openPage["Open this pending list"] --> seeList["Each row is one GRN waiting for audit"]
  seeList --> review["Review quantities invoice vs received and other columns"]
  review --> markBtn["Mark Audited"]
  markBtn --> done["Audited GRNs no longer appear here"]
`;

const displayFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function formatDisplayDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return displayFormatter.format(d);
}

function statusToneClass(value: string | null): string {
  if (!value) return "";
  const up = value.trim().toUpperCase();
  if (
    up === "CLOSED" ||
    up === "DONE" ||
    up === "COMPLETED" ||
    up === "SETTLED"
  ) {
    return "text-violet-600 dark:text-violet-400 font-medium";
  }
  return "";
}

function isAuditDone(value: string | null): boolean {
  if (!value) return false;
  const up = value.trim().toUpperCase();
  return up === "CLOSED" || up === "AUDITED" || up === "DONE" || up === "COMPLETED";
}

function FilterableHead({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <TableHead className={cn("whitespace-nowrap", className)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <ListFilter
          className="text-muted-foreground size-3.5 shrink-0 opacity-70"
          aria-hidden
        />
      </span>
    </TableHead>
  );
}

export default function InboundPendingAuditsPage() {
  const { isAdmin } = useAuth();
  const [page, setPage] = React.useState(1);
  const [searchDraft, setSearchDraft] = React.useState("");
  const [searchApplied, setSearchApplied] = React.useState("");
  const [data, setData] = React.useState<GrnListResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [markingId, setMarkingId] = React.useState<number | null>(null);
  const [confirmRow, setConfirmRow] = React.useState<GrnRow | null>(null);
  const [auditLines, setAuditLines] = React.useState<AuditLine[]>([]);
  const [auditLinesLoading, setAuditLinesLoading] = React.useState(false);
  const [auditPriceEdits, setAuditPriceEdits] = React.useState<Record<number, string>>({});
  const [workflowOpen, setWorkflowOpen] = React.useState(false);
  const [workflowChartMounted, setWorkflowChartMounted] =
    React.useState(false);

  const perPage = 100;

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        page: String(page),
        count: String(perPage),
        search_keyword: searchApplied,
      });
      const res = await apiFetch<GrnListResponse>(
        `/api/inbound/pending-audits/grns?${q}`
      );
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load pending audits");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, searchApplied, perPage]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const applySearch = () => {
    setPage(1);
    setSearchApplied(searchDraft.trim());
  };

  function openConfirmDialog(row: GrnRow) {
    setConfirmRow(row);
    setAuditLines([]);
    setAuditPriceEdits({});
    setAuditLinesLoading(true);
    apiFetch<{ lines: AuditLine[] }>(
      `/api/inbound/grns/${row.grn_id}/debit-note?preview=1`
    )
      .then((d) => {
        const lines = d.lines ?? [];
        setAuditLines(lines);
        const edits: Record<number, string> = {};
        for (const l of lines) {
          edits[l.line_index] = l.audit_price > 0 ? String(l.audit_price) : "";
        }
        setAuditPriceEdits(edits);
      })
      .catch(() => toast.error("Failed to load GRN line items"))
      .finally(() => setAuditLinesLoading(false));
  }

  function computedLines(): (AuditLine & { edited_audit_price: number; edited_diff: number; edited_debit: number })[] {
    return auditLines.map((l) => {
      const raw = auditPriceEdits[l.line_index] ?? "";
      const editedAudit = raw === "" ? 0 : Number(raw);
      const ap = Number.isFinite(editedAudit) && editedAudit >= 0 ? editedAudit : l.audit_price;
      const diff = l.vendor_price - ap;
      return {
        ...l,
        edited_audit_price: ap,
        edited_diff: diff,
        edited_debit: l.quantity * diff,
      };
    });
  }

  async function confirmMarkAudited() {
    if (!confirmRow) return;
    const grnId = confirmRow.grn_id;
    setMarkingId(grnId);
    try {
      const lines = computedLines();
      const priceSaves = lines.filter(
        (l) => l.edited_audit_price !== l.audit_price && l.edited_audit_price > 0
      );
      for (const l of priceSaves) {
        await apiFetch(`/api/inbound/grns/${grnId}/items/${l.line_index}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audit_price: l.edited_audit_price }),
        });
      }
      await apiFetch(`/api/inbound/grns/${grnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grn_audit_status: "CLOSED" }),
      });
      toast.success(`GRN ${grnId} marked as Audited`);
      setConfirmRow(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to mark audited");
    } finally {
      setMarkingId(null);
    }
  }

  const totalPages =
    data && data.total > 0
      ? Math.ceil(data.total / data.per_page_count)
      : 1;

  return (
    <div className="mx-auto max-w-[1920px] space-y-4 px-2 py-4 md:px-4">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <AppPageTitle
          className="mb-0 min-w-0 flex-1"
          title="Pending Audits"
          description="GRNs waiting to be audited."
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 self-end sm:mt-1 sm:shrink-0 sm:self-start"
          onClick={() => {
            setWorkflowOpen(true);
            setWorkflowChartMounted(true);
          }}
        >
          <CircleHelp className="h-4 w-4" aria-hidden />
          How this queue works
        </Button>
      </div>

      <Sheet
        open={workflowOpen}
        onOpenChange={(open) => {
          setWorkflowOpen(open);
          if (open) {
            setWorkflowChartMounted(true);
          }
        }}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg"
        >
          <SheetHeader className="border-b bg-muted/20 px-4 py-4 text-left">
            <SheetTitle>How this queue works</SheetTitle>
            <SheetDescription>
              Steps for each row on this screen. Scroll for the diagram.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 p-4">
            <p className="text-muted-foreground text-sm leading-relaxed">
              When you open this page, you see every GRN that still needs your audit
              for this workflow. Review vendor, PO, quantities, and invoice vs
              received box counts in the columns, then record completion with{" "}
              <strong className="text-foreground">Mark Audited</strong> on the far
              right of the row. While the update runs the button shows{" "}
              <strong className="text-foreground">Saving…</strong>; when the audit
              is already closed it shows{" "}
              <strong className="text-foreground">Audited</strong> and is
              disabled. Rows that finish this step disappear from this list.
            </p>
            {workflowChartMounted ? (
              <MermaidDiagram
                chart={PENDING_AUDITS_WORKFLOW}
                className="w-full overflow-x-auto"
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={confirmRow !== null}
        onOpenChange={(open) => {
          if (!open && markingId === null) setConfirmRow(null);
        }}
      >
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Confirm Audit</DialogTitle>
            <DialogDescription>
              Review line-level quantities and set audited prices before marking this GRN as audited.
            </DialogDescription>
          </DialogHeader>
          {confirmRow ? (() => {
            const lines = computedLines();
            const totalAccepted = lines.reduce((s, l) => s + l.quantity, 0);
            const totalRejected = lines.reduce((s, l) => s + l.rejected_quantity, 0);
            const totalShortage = lines.reduce((s, l) => s + l.short_quantity, 0);
            const totalDebit = lines.reduce((s, l) => s + (l.edited_diff > 0 ? l.edited_debit : 0), 0);
            const discrepancyCount = lines.filter((l) => l.edited_diff > 0 && l.quantity > 0).length;
            return (
            <div className="space-y-3 text-sm min-h-0 flex flex-col">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground text-xs">GRN Id</dt>
                  <dd className="font-mono font-medium">{confirmRow.grn_id}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Vendor</dt>
                  <dd className="truncate">{confirmRow.vendor_name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Vendor invoice #</dt>
                  <dd>{confirmRow.vendor_invoice_number ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">GRN shortage quantity</dt>
                  <dd className="font-mono">{confirmRow.grn_shortage_quantity}</dd>
                </div>
              </dl>

              {auditLinesLoading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-xs">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading line items…
                </div>
              ) : auditLines.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-xs">
                  No line items found for this GRN.
                </p>
              ) : (
                <div className="overflow-auto border rounded-md min-h-0 flex-1">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/60 hover:bg-muted/60">
                        <TableHead className="whitespace-nowrap text-xs">SKU</TableHead>
                        <TableHead className="whitespace-nowrap text-xs min-w-[120px]">Description</TableHead>
                        <TableHead className="text-right whitespace-nowrap text-xs">Accepted</TableHead>
                        <TableHead className="text-right whitespace-nowrap text-xs">Rejected</TableHead>
                        <TableHead className="text-right whitespace-nowrap text-xs">Shortage</TableHead>
                        <TableHead className="text-right whitespace-nowrap text-xs">Vendor Price</TableHead>
                        <TableHead className="text-right whitespace-nowrap text-xs min-w-[110px]">Audited Price</TableHead>
                        <TableHead className="text-right whitespace-nowrap text-xs">Diff</TableHead>
                        <TableHead className="text-right whitespace-nowrap text-xs">Debit Amt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((l, idx) => (
                        <TableRow key={l.line_index} className={cn(idx % 2 === 1 ? "bg-muted/20" : "")}>
                          <TableCell className="font-mono text-xs">{l.sku_id ?? "—"}</TableCell>
                          <TableCell className="text-xs max-w-[160px] truncate" title={l.sku_description ?? undefined}>
                            {l.sku_description ?? "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">{l.quantity}</TableCell>
                          <TableCell className={cn("text-right font-mono text-xs tabular-nums", l.rejected_quantity > 0 && "text-red-600 dark:text-red-400")}>
                            {l.rejected_quantity}
                          </TableCell>
                          <TableCell className={cn("text-right font-mono text-xs tabular-nums", l.short_quantity > 0 && "text-amber-600 dark:text-amber-400")}>
                            {l.short_quantity}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">
                            {l.vendor_price > 0 ? `₹${l.vendor_price.toFixed(2)}` : "—"}
                          </TableCell>
                          <TableCell className="text-right p-1">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="h-7 w-[100px] ml-auto text-right font-mono text-xs tabular-nums"
                              value={auditPriceEdits[l.line_index] ?? ""}
                              onChange={(e) =>
                                setAuditPriceEdits((prev) => ({
                                  ...prev,
                                  [l.line_index]: e.target.value,
                                }))
                              }
                              disabled={markingId !== null}
                            />
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-mono text-xs tabular-nums font-semibold",
                            l.edited_diff > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                          )}>
                            {l.edited_diff !== 0 ? `₹${l.edited_diff.toFixed(2)}` : "—"}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-mono text-xs tabular-nums",
                            l.edited_diff > 0 && "text-red-600 dark:text-red-400 font-semibold"
                          )}>
                            {l.edited_diff > 0 && l.quantity > 0 ? `₹${l.edited_debit.toFixed(2)}` : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {lines.length > 0 && (
                        <TableRow className="bg-muted/40 font-semibold">
                          <TableCell className="text-xs" colSpan={2}>Total ({lines.length} lines)</TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">{totalAccepted}</TableCell>
                          <TableCell className={cn("text-right font-mono text-xs tabular-nums", totalRejected > 0 && "text-red-600 dark:text-red-400")}>{totalRejected}</TableCell>
                          <TableCell className={cn("text-right font-mono text-xs tabular-nums", totalShortage > 0 && "text-amber-600 dark:text-amber-400")}>{totalShortage}</TableCell>
                          <TableCell colSpan={2} />
                          <TableCell className="text-right text-xs">Debit →</TableCell>
                          <TableCell className={cn("text-right font-mono text-xs tabular-nums", totalDebit > 0 && "text-red-600 dark:text-red-400")}>
                            {totalDebit > 0 ? `₹${totalDebit.toFixed(2)}` : "—"}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              {!auditLinesLoading && discrepancyCount > 0 && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                  A rate-diff Debit Note will be auto-generated for{" "}
                  <strong>{discrepancyCount} line(s)</strong>, total{" "}
                  <strong>₹{totalDebit.toFixed(2)}</strong>. It will appear in the
                  Pending Debit & Credit Notes section.
                </p>
              )}

              <p className="text-muted-foreground rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed dark:border-amber-900/50 dark:bg-amber-950/30">
                This action is irreversible. GRN lines will be locked after audit.
              </p>
            </div>
            );
          })() : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={markingId !== null}
              onClick={() => setConfirmRow(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={markingId !== null || auditLinesLoading}
              onClick={() => void confirmMarkAudited()}
            >
              {markingId !== null ? "Saving…" : "Confirm & Mark Audited"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-primary/10 shadow-sm">
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex w-full flex-col gap-2 sm:max-w-md sm:flex-1">
            <Label
              htmlFor="pending-audit-search"
              className="text-muted-foreground text-xs font-medium"
            >
              Search
            </Label>
            <div className="flex gap-2">
              <Input
                id="pending-audit-search"
                placeholder="GRN id, PO, vendor, invoice #, status…"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applySearch();
                }}
              />
              <Button type="button" variant="secondary" onClick={applySearch}>
                Apply
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 px-4 py-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}
          {!loading && (!data || data.content.length === 0) ? (
            <div className="px-4 py-8">
              <EmptyState
                title="No grns were found"
                description="No GRNs are currently in the pending audit queue."
              />
            </div>
          ) : null}
          {!loading && data && data.content.length > 0 ? (
            <>
              <p className="text-muted-foreground border-b px-4 py-2 text-sm">
                Showing {data.curr_page_count} of {data.total} grn(s).
              </p>
              <p className="text-muted-foreground border-b bg-muted/30 px-4 py-2 text-xs">
                Scroll right on the table to reach{" "}
                <strong className="text-foreground">Mark Audited</strong>.
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/60 hover:bg-muted/60">
                      <FilterableHead label="GRN Id" />
                      <FilterableHead label="PO Number" />
                      <TableHead>GRN status</TableHead>
                      <TableHead>GRN audit status</TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        PO SKU count
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        PO total demand
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        GRN SKU count
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        GRN accepted quantity
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        GRN rejected quantity
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        GRN shortage quantity
                      </TableHead>
                      <FilterableHead
                        label="Vendor invoice number"
                        className="min-w-[120px]"
                      />
                      <FilterableHead label="Vendor Id" />
                      <FilterableHead
                        label="Vendor name"
                        className="min-w-[140px]"
                      />
                      <TableHead className="text-right whitespace-nowrap">
                        Box count in invoice
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Actual box count recieved
                      </TableHead>
                      {isAdmin ? (
                        <TableHead className="text-right whitespace-nowrap">
                          Audited Price Total
                        </TableHead>
                      ) : null}
                      <TableHead className="whitespace-nowrap">
                        GRN audited by
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        GRN opened by
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        GRN opened at
                      </TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.content.map((row, idx) => (
                      (() => {
                        const audited = isAuditDone(row.grn_audit_status);
                        const actionLabel =
                          markingId === row.grn_id
                            ? "Saving…"
                            : audited
                              ? "Audited"
                              : "Mark Audited";
                        return (
                      <TableRow
                        key={row.grn_id}
                        className={cn(
                          "hover:bg-muted/40",
                          idx % 2 === 1 ? "bg-muted/20" : ""
                        )}
                      >
                        <TableCell className="font-mono text-xs">
                          <Link
                            href={`/inbound/grns/${row.grn_id}`}
                            className="text-primary font-medium underline-offset-4 hover:underline"
                          >
                            {row.grn_id}
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          <Link
                            href={`/inbound/vendors/${row.vendor_id}/purchase-orders/${row.po_id}`}
                            className="text-primary font-medium underline-offset-4 hover:underline"
                          >
                            {row.po_id}
                          </Link>
                        </TableCell>
                        <TableCell
                          className={cn("text-xs", statusToneClass(row.grn_status))}
                        >
                          {row.grn_status ?? "—"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-xs",
                            statusToneClass(row.grn_audit_status)
                          )}
                        >
                          {row.grn_audit_status ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {row.po_sku_count}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {row.po_total_quantity}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {row.grn_sku_count}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {row.grn_accepted_quantity}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {row.grn_rejected_quantity}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {row.grn_shortage_quantity}
                        </TableCell>
                        <TableCell className="max-w-[140px] truncate text-xs">
                          {row.vendor_invoice_number ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          <Link
                            href={`/inbound/vendors/${row.vendor_id}`}
                            className="text-primary font-medium underline-offset-4 hover:underline"
                          >
                            {row.vendor_id}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate text-sm">
                          {row.vendor_name ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {row.box_count_invoice}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {row.actual_box_count_recieved}
                        </TableCell>
                        {isAdmin ? (
                          <TableCell className="text-right font-mono text-xs">
                            {row.grn_audit_price_total != null &&
                            row.grn_audit_price_total > 0
                              ? row.grn_audit_price_total
                              : "—"}
                          </TableCell>
                        ) : null}
                        <TableCell className="text-muted-foreground max-w-[120px] truncate text-xs">
                          {row.grn_audit_by ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[120px] truncate text-xs">
                          {row.created_by ?? "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatDisplayDateTime(row.created_at)}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 whitespace-nowrap px-2 text-xs"
                            disabled={
                              !isAdmin || markingId === row.grn_id || audited
                            }
                            title={
                              !isAdmin
                                ? "Only admins can mark a GRN as audited"
                                : undefined
                            }
                            onClick={() => openConfirmDialog(row)}
                          >
                            {actionLabel}
                          </Button>
                        </TableCell>
                      </TableRow>
                        );
                      })()
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : null}
          {data && data.total > 0 ? (
            <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-xs">
              <span>
                Page {data.current_page} of {totalPages} — {data.total} grn(s)
                total
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    loading || page * data.per_page_count >= data.total
                  }
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
