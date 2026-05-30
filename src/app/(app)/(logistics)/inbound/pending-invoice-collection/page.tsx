"use client";

import * as React from "react";
import Link from "next/link";
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
import { CircleHelp, Download } from "lucide-react";
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

type GrnRow = {
  grn_id: number;
  po_id: number;
  vendor_id: number;
  vendor_name: string | null;
  grn_status: string | null;
  grn_audit_status: string | null;
  grn_audit_by: string | null;
  grn_invoice_collection_status: string | null;
  grn_invoice_collection_by: string | null;
  vendor_invoice_number: string | null;
  grn_sku_count: number;
  grn_invoice_quantity: string;
  grn_accepted_quantity: string;
  grn_rejected_quantity: string;
  grn_shortage_quantity: string;
  created_by: string | null;
  created_at: string | null;
};

type GrnListResponse = {
  total: number;
  current_page: number;
  per_page_count: number;
  curr_page_count: number;
  content: GrnRow[];
};

const PENDING_INVOICE_COLLECTION_WORKFLOW = `
flowchart TD
  openPage["Open this pending list"] --> seeList["Each row needs physical invoice marked collected"]
  seeList --> how{"How do you want to mark?"}
  how -->|One GRN| rowBtn["Mark received on that row"]
  how -->|Many GRNs| pick["Select checkboxes"]
  pick --> bulkBtn["Mark as received in bulk"]
  rowBtn --> done["Updated rows no longer appear here"]
  bulkBtn --> done
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

/** Purple/pink emphasis for CLOSED-style GRN / audit status (eCraft reference). */
function closedStatusClass(value: string | null): string {
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

/** Green for OPEN invoice collection (eCraft reference). */
function invoiceCollectionStatusClass(value: string | null): string {
  if (!value) return "";
  const up = value.trim().toUpperCase();
  if (up === "OPEN" || up === "PENDING" || up === "IN_PROGRESS") {
    return "text-emerald-600 dark:text-emerald-400 font-medium";
  }
  return closedStatusClass(value);
}

export default function InboundPendingInvoiceCollectionPage() {
  const [page, setPage] = React.useState(1);
  const [searchDraft, setSearchDraft] = React.useState("");
  const [searchApplied, setSearchApplied] = React.useState("");
  const [data, setData] = React.useState<GrnListResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [markingId, setMarkingId] = React.useState<number | null>(null);
  /** Selected GRN IDs on the current result set (page rows). */
  const [selectedIds, setSelectedIds] = React.useState<number[]>([]);
  const [bulkMarking, setBulkMarking] = React.useState(false);
  const selectAllRef = React.useRef<HTMLInputElement>(null);
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
        `/api/inbound/pending-invoice-collection/grns?${q}`
      );
      setData(res);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to load pending invoices"
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, searchApplied, perPage]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const idsOnPage = React.useMemo(
    () => (data?.content ?? []).map((r) => r.grn_id),
    [data?.content]
  );

  React.useEffect(() => {
    setSelectedIds([]);
  }, [page, searchApplied]);

  const selectedOnPageCount = React.useMemo(() => {
    const setSel = new Set(selectedIds);
    return idsOnPage.filter((id) => setSel.has(id)).length;
  }, [idsOnPage, selectedIds]);

  React.useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    el.indeterminate =
      idsOnPage.length > 0 &&
      selectedOnPageCount > 0 &&
      selectedOnPageCount < idsOnPage.length;
  }, [idsOnPage.length, selectedOnPageCount]);

  function toggleRow(grnId: number, checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) {
        if (prev.includes(grnId)) return prev;
        return [...prev, grnId];
      }
      return prev.filter((id) => id !== grnId);
    });
  }

  function selectAllOnPage() {
    const next = new Set(selectedIds);
    for (const id of idsOnPage) next.add(id);
    setSelectedIds([...next]);
  }

  function deselectAllOnPage() {
    const drop = new Set(idsOnPage);
    setSelectedIds((prev) => prev.filter((id) => !drop.has(id)));
  }

  const applySearch = () => {
    setPage(1);
    setSearchApplied(searchDraft.trim());
  };

  async function markCollected(grnId: number) {
    setMarkingId(grnId);
    try {
      await apiFetch(`/api/inbound/grns/${grnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grn_invoice_collection_status: "COLLECTED" }),
      });
      toast.success(`GRN ${grnId} invoice marked as Collected`);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to mark collected");
    } finally {
      setMarkingId(null);
    }
  }

  async function markBulkReceived() {
    if (selectedIds.length === 0) return;
    setBulkMarking(true);
    const ids = [...selectedIds];
    let ok = 0;
    let fail = 0;
    for (const gid of ids) {
      try {
        await apiFetch(`/api/inbound/grns/${gid}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grn_invoice_collection_status: "COLLECTED" }),
        });
        ok += 1;
      } catch {
        fail += 1;
      }
    }
    if (ok && !fail) {
      const countLabel = ok === 1 ? "1 invoice" : `${ok} invoices`;
      toast.success(`${countLabel} marked as received (collection closed)`);
    } else if (ok && fail) {
      toast.warning(`${ok} succeeded, ${fail} failed — review permissions or try again`);
    } else {
      toast.error("Could not update invoice collection status");
    }
    setBulkMarking(false);
    setSelectedIds([]);
    void load();
  }

  function downloadBulkInvoiceCsv() {
    if (!data || selectedIds.length === 0) return;
    const selectedRows = data.content.filter((r) => selectedIds.includes(r.grn_id));
    if (selectedRows.length === 0) return;

    const headers = [
      "grn_id", "po_number", "grn_status", "grn_audit_status",
      "invoice_collection_status", "grn_sku_count", "grn_invoice_quantity",
      "grn_accepted_quantity", "grn_rejected_quantity", "grn_shortage_quantity",
      "vendor_invoice_number", "vendor_id", "vendor_name",
      "grn_audited_by", "invoice_collection_by", "grn_opened_by", "grn_opened_at",
    ];

    function csvEscape(v: unknown): string {
      const s = v == null ? "" : String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    }

    const rows = selectedRows.map((r) => [
      r.grn_id,
      r.po_id,
      r.grn_status ?? "",
      r.grn_audit_status ?? "",
      r.grn_invoice_collection_status ?? "",
      r.grn_sku_count,
      r.grn_invoice_quantity,
      r.grn_accepted_quantity,
      r.grn_rejected_quantity,
      r.grn_shortage_quantity,
      r.vendor_invoice_number ?? "",
      r.vendor_id,
      r.vendor_name ?? "",
      r.grn_audit_by ?? "",
      r.grn_invoice_collection_by ?? "",
      r.created_by ?? "",
      r.created_at ?? "",
    ].map(csvEscape).join(","));

    const csv = [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bulk_invoice_data.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${selectedRows.length} invoice(s) as CSV`);
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
          title="Pending Invoice Collection"
          description="GRNs pending invoice collection."
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
              When you open this page, you see GRNs where the physical invoice still
              needs to be marked collected for this workflow. For one line, use{" "}
              <strong className="text-foreground">Mark received</strong> on the far
              right (it shows <strong className="text-foreground">Saving…</strong>{" "}
              while it updates). To mark several at once, tick the checkboxes and
              choose <strong className="text-foreground">Mark as received in bulk</strong>{" "}
              in the bar above—that button shows{" "}
              <strong className="text-foreground">Updating…</strong> during a bulk
              run and is disabled until at least one row is selected. Rows you finish
              disappear from this list (if some bulk updates fail, you will see a
              warning and can retry).
            </p>
            {workflowChartMounted ? (
              <MermaidDiagram
                chart={PENDING_INVOICE_COLLECTION_WORKFLOW}
                className="w-full overflow-x-auto"
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <Card className="border-primary/10 shadow-sm">
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex w-full flex-col gap-2 sm:max-w-md sm:flex-1">
            <Label
              htmlFor="pic-search"
              className="text-muted-foreground text-xs font-medium"
            >
              Search
            </Label>
            <div className="flex gap-2">
              <Input
                id="pic-search"
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
                title="No invoices in queue"
                description="No GRNs are currently pending invoice collection."
              />
            </div>
          ) : null}
          {!loading && data && data.content.length > 0 ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2">
                <p className="text-muted-foreground text-sm">
                  Showing {data.curr_page_count} of {data.total} Invoice(s).
                  {selectedIds.length > 0 ? (
                    <span className="text-foreground ml-2 font-medium">
                      · {selectedIds.length} selected
                    </span>
                  ) : null}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={selectedIds.length === 0 || loading}
                    className={cn(
                      "gap-1.5",
                      selectedIds.length === 0 && "opacity-50"
                    )}
                    onClick={downloadBulkInvoiceCsv}
                  >
                    <Download className="size-3.5" />
                    Download Selected
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={selectedIds.length === 0 || bulkMarking || loading}
                    title="Set invoice collection to Collected for all selected GRNs"
                    className={cn(
                      selectedIds.length === 0 && "opacity-50"
                    )}
                    onClick={() => void markBulkReceived()}
                  >
                    {bulkMarking ? "Updating…" : "Mark as received in bulk"}
                  </Button>
                </div>
              </div>
              <p className="text-muted-foreground border-b bg-muted/30 px-4 py-2 text-xs">
                Use the toolbar above for{" "}
                <strong className="text-foreground">Mark as received in bulk</strong>{" "}
                after selecting rows. Scroll right on the table to reach{" "}
                <strong className="text-foreground">Mark received</strong> on each
                row.
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/60 hover:bg-muted/60">
                      <TableHead className="w-10 px-3">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          checked={
                            idsOnPage.length > 0 &&
                            selectedOnPageCount === idsOnPage.length
                          }
                          onChange={(e) =>
                            e.target.checked
                              ? selectAllOnPage()
                              : deselectAllOnPage()
                          }
                          disabled={bulkMarking || loading}
                          aria-label="Select all invoices on this page"
                          className="border-input accent-primary size-4 cursor-pointer rounded"
                        />
                      </TableHead>
                      <TableHead className="whitespace-nowrap">GRN Id</TableHead>
                      <TableHead className="whitespace-nowrap">PO Number</TableHead>
                      <TableHead>GRN status</TableHead>
                      <TableHead>GRN audit status</TableHead>
                      <TableHead>Invoice collection status</TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        GRN SKU count
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        GRN invoice quantity
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
                      <TableHead className="min-w-[100px]">
                        Vendor invoice number
                      </TableHead>
                      <TableHead className="whitespace-nowrap">Vendor Id</TableHead>
                      <TableHead className="min-w-[140px]">Vendor name</TableHead>
                      <TableHead className="whitespace-nowrap">
                        GRN audited by
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        Invoice collection by
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
                      <TableRow
                        key={row.grn_id}
                        className={cn(
                          "hover:bg-muted/40",
                          idx % 2 === 1 ? "bg-muted/20" : ""
                        )}
                      >
                        <TableCell className="p-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(row.grn_id)}
                            onChange={(e) =>
                              toggleRow(row.grn_id, e.target.checked)
                            }
                            disabled={
                              bulkMarking ||
                              markingId === row.grn_id ||
                              loading
                            }
                            aria-label={`Select GRN ${row.grn_id}`}
                            className="border-input accent-primary size-4 cursor-pointer rounded"
                          />
                        </TableCell>
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
                          className={cn("text-xs", closedStatusClass(row.grn_status))}
                        >
                          {row.grn_status ?? "—"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-xs",
                            closedStatusClass(row.grn_audit_status)
                          )}
                        >
                          {row.grn_audit_status ?? "—"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-xs",
                            invoiceCollectionStatusClass(
                              row.grn_invoice_collection_status
                            )
                          )}
                        >
                          {row.grn_invoice_collection_status ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {row.grn_sku_count}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {row.grn_invoice_quantity}
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
                        <TableCell className="max-w-[120px] truncate text-xs">
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
                        <TableCell className="text-muted-foreground max-w-[120px] truncate text-xs">
                          {row.grn_audit_by ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[120px] truncate text-xs">
                          {row.grn_invoice_collection_by ?? "—"}
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
                              markingId === row.grn_id || bulkMarking
                            }
                            onClick={() => void markCollected(row.grn_id)}
                          >
                            {markingId === row.grn_id ? "Saving…" : "Mark received"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : null}
          {data && data.total > 0 ? (
            <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-xs">
              <span>
                Page {data.current_page} of {totalPages} — {data.total} invoice(s)
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
