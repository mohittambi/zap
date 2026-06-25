"use client";

import * as React from "react";
import Link from "next/link";
import { CircleHelp, ListFilter } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { useAuth } from "@/contexts/auth-context";
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
import {
  buildPendingGrnsListQuery,
  formatInboundListDate,
  formatInboundListDateTime as formatDisplayDateTime,
  inboundPaginatedTotalPages,
  statusToneClass,
} from "@/lib/inboundPoGrnPendingUi";
import { cn } from "@/lib/utils";

type GrnRow = {
  grn_id: number;
  po_id: number;
  vendor_id: number;
  vendor_name: string | null;
  grn_status: string | null;
  grn_audit_status: string | null;
  grn_audit_by: string | null;
  accounts_status: string | null;
  accounts_by: string | null;
  vendor_invoice_number: string | null;
  original_invoice_date: string | null;
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
};

type GrnListResponse = {
  total: number;
  current_page: number;
  per_page_count: number;
  curr_page_count: number;
  content: GrnRow[];
};

const PENDING_ACCOUNTS_WORKFLOW = `
flowchart TD
  openPage["Open this pending list"] --> seeGrns["Each row is one GRN awaiting accounts"]
  seeGrns --> review["Review vendor invoice and GRN quantities"]
  review --> decide{"Approve or Reject?"}
  decide -->|Approve| approved["Accounts approved"]
  decide -->|Reject| rejected["Accounts rejected"]
  approved --> booking["Warehouse can book inventory for this GRN"]
  booking --> doneRow["Row leaves this list"]
  rejected --> doneRow
`;

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

export default function InboundPendingAccountsPage() {
  const { isAdmin } = useAuth();
  const [page, setPage] = React.useState(1);
  const [searchDraft, setSearchDraft] = React.useState("");
  const [searchApplied, setSearchApplied] = React.useState("");
  const [data, setData] = React.useState<GrnListResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [actingId, setActingId] = React.useState<number | null>(null);
  const [workflowOpen, setWorkflowOpen] = React.useState(false);
  const [workflowChartMounted, setWorkflowChartMounted] = React.useState(false);

  const perPage = 100;

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildPendingGrnsListQuery({
        page,
        count: perPage,
        searchKeyword: searchApplied,
      });
      const res = await apiFetch<GrnListResponse>(
        `/api/inbound/pending-accounts/grns?${qs}`
      );
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load pending accounts");
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

  async function handleAction(grnId: number, status: "APPROVED" | "REJECTED") {
    setActingId(grnId);
    try {
      await apiFetch(`/api/inbound/grns/${grnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accounts_status: status }),
      });
      toast.success(`GRN ${grnId} accounts ${status === "APPROVED" ? "approved" : "rejected"}`);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActingId(null);
    }
  }

  const totalPages = data
    ? inboundPaginatedTotalPages(data.total, data.per_page_count)
    : 1;

  return (
    <div className="mx-auto max-w-[1920px] space-y-4 px-2 py-4 md:px-4">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <AppPageTitle
          className="mb-0 min-w-0 flex-1"
          title="Pending Accounts Approval"
          description="GRNs waiting for accounts approval before inventory can be booked."
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 self-end sm:self-start sm:mt-1 sm:shrink-0"
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
              Accounts sign-off before inventory booking. Scroll for the diagram.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 p-4">
            <p className="text-muted-foreground text-sm leading-relaxed">
              This list shows every goods receipt (GRN) that still needs an accounts decision.
              Each row is one GRN: use the columns for vendor, invoice, quantities, and audit context.
              Use <strong className="text-foreground">Approve</strong> when the case is ready for
              warehouse booking, or <strong className="text-foreground">Reject</strong> when it must
              go back for correction. Completed rows no longer appear here.
            </p>
            {workflowChartMounted ? (
              <MermaidDiagram
                chart={PENDING_ACCOUNTS_WORKFLOW}
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
              htmlFor="pending-accounts-search"
              className="text-muted-foreground text-xs font-medium"
            >
              Search
            </Label>
            <div className="flex gap-2">
              <Input
                id="pending-accounts-search"
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
                title="No GRNs found"
                description="No GRNs are currently pending accounts approval."
              />
            </div>
          ) : null}
          {!loading && data && data.content.length > 0 ? (
            <>
              <p className="text-muted-foreground border-b px-4 py-2 text-sm">
                Showing {data.curr_page_count} of {data.total} grn(s).
              </p>
              <p className="text-muted-foreground border-b bg-muted/30 px-4 py-2 text-xs">
                Scroll right on the table to reach Approve and Reject.
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/60 hover:bg-muted/60">
                      <FilterableHead label="GRN Id" />
                      <FilterableHead label="PO Number" />
                      <TableHead>GRN status</TableHead>
                      <TableHead>Audit status</TableHead>
                      <TableHead>Accounts status</TableHead>
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
                        GRN accepted qty
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        GRN rejected qty
                      </TableHead>
                      <FilterableHead
                        label="Vendor invoice number"
                        className="min-w-[120px]"
                      />
                      <FilterableHead
                        label="Original Invoice Date"
                        className="min-w-[120px]"
                      />
                      <FilterableHead label="Vendor Id" />
                      <FilterableHead
                        label="Vendor name"
                        className="min-w-[140px]"
                      />
                      <TableHead className="whitespace-nowrap">
                        Audit by
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        Accounts by
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
                        <TableCell className={cn("text-xs", statusToneClass(row.grn_status))}>
                          {row.grn_status ?? "—"}
                        </TableCell>
                        <TableCell className={cn("text-xs", statusToneClass(row.grn_audit_status))}>
                          {row.grn_audit_status ?? "—"}
                        </TableCell>
                        <TableCell className={cn("text-xs", statusToneClass(row.accounts_status))}>
                          {row.accounts_status ?? "—"}
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
                        <TableCell className="max-w-[140px] truncate text-xs">
                          {row.vendor_invoice_number ?? "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatInboundListDate(row.original_invoice_date)}
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
                          {row.accounts_by ?? "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatDisplayDateTime(row.created_at)}
                        </TableCell>
                        <TableCell>
                          {isAdmin ? (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 whitespace-nowrap px-2 text-xs text-green-600 hover:text-green-700"
                                disabled={actingId === row.grn_id || row.accounts_status === "APPROVED"}
                                onClick={() => void handleAction(row.grn_id, "APPROVED")}
                              >
                                {actingId === row.grn_id ? "Saving…" : "Approve"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 whitespace-nowrap px-2 text-xs text-destructive hover:text-destructive"
                                disabled={actingId === row.grn_id || row.accounts_status === "REJECTED"}
                                onClick={() => void handleAction(row.grn_id, "REJECTED")}
                              >
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span
                              className="text-muted-foreground text-xs"
                              title="Only admins can approve or reject accounts"
                            >
                              Admin only
                            </span>
                          )}
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
                Page {data.current_page} of {totalPages} — {data.total} grn(s) total
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
                  disabled={loading || page * data.per_page_count >= data.total}
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
