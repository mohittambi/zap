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

  const applySearch = () => {
    setPage(1);
    setSearchApplied(searchDraft.trim());
  };

  const totalPages =
    data && data.total > 0
      ? Math.ceil(data.total / data.per_page_count)
      : 1;

  return (
    <div className="mx-auto max-w-[1920px] space-y-4 px-2 py-4 md:px-4">
      <AppPageTitle
        title="Pending Invoice Collection"
        description="GRNs from eautomate pending-for-invoice-collection API. Run npm run sync:grns:pending-invoice-collection to refresh."
      />

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
                description="Run npm run migrate (027), sync vendors, then npm run sync:grns:pending-invoice-collection with EAUTOMATE_COOKIE."
              />
            </div>
          ) : null}
          {!loading && data && data.content.length > 0 ? (
            <>
              <p className="text-muted-foreground border-b px-4 py-2 text-sm">
                Showing {data.curr_page_count} of {data.total} Invoice(s).
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/60 hover:bg-muted/60">
                      <TableHead className="w-10" />
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
                            className="border-input size-4 rounded"
                            disabled
                            aria-label={`Select GRN ${row.grn_id}`}
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
