"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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

type NoteRow = {
  note_id: number;
  grn_id: number;
  credit_debit_note_type: string | null;
  credit_debit_note_status: string | null;
  credit_debit_note_number: string | null;
  credit_debit_note_number_assignment_status: string | null;
  credit_debit_note_upload_status: string | null;
  credit_debit_note_uploaded_by: string | null;
  reverse_credit_debit_note_number: string | null;
  reverse_credit_debit_note_upload_status: string | null;
  reverse_credit_debit_note_uploaded_by: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  po_id: number | null;
  grn_status: string | null;
  grn_audit_status: string | null;
  grn_audit_by: string | null;
  vendor_invoice_number: string | null;
  box_count_invoice: number | null;
  actual_box_count_recieved: number | null;
  vendor_id: number | null;
  vendor_name: string | null;
  synced_at: string | null;
};

type ListResponse = {
  total: number;
  current_page: number;
  per_page_count: number;
  curr_page_count: number;
  content: NoteRow[];
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

function debitGood(value: string | null): string {
  if (!value) return "";
  const up = value.trim().toUpperCase();
  if (up === "APPROVED" || up === "UPLOADED" || up === "ASSIGNED") {
    return "text-emerald-600 dark:text-emerald-400 font-medium";
  }
  return "";
}

function debitBad(value: string | null): string {
  if (!value) return "";
  const up = value.trim().toUpperCase();
  if (up.includes("NOT") && up.includes("UPLOAD")) {
    return "text-red-600 dark:text-red-400 font-medium";
  }
  return "";
}

function formatNoteType(t: string | null): string {
  if (!t) return "—";
  return t.replaceAll("_", " ");
}

export default function InboundPendingDebitCreditPage() {
  const [page, setPage] = React.useState(1);
  const [searchDraft, setSearchDraft] = React.useState("");
  const [searchApplied, setSearchApplied] = React.useState("");
  const [data, setData] = React.useState<ListResponse | null>(null);
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
      const res = await apiFetch<ListResponse>(
        `/api/inbound/pending-debit-credit/notes?${q}`
      );
      setData(res);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to load pending debit/credit notes"
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
    data && data.total > 0 ? Math.ceil(data.total / data.per_page_count) : 1;

  return (
    <div className="mx-auto max-w-[1920px] space-y-4 px-2 py-4 md:px-4">
      <AppPageTitle
        title="Pending Debit & Credit Notes"
        description="GRNs awaiting debit or credit note processing."
      />

      <Card className="border-primary/10 shadow-sm">
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex w-full flex-col gap-2 sm:max-w-md sm:flex-1">
            <Label
              htmlFor="pdc-search"
              className="text-muted-foreground text-xs font-medium"
            >
              Search
            </Label>
            <div className="flex gap-2">
              <Input
                id="pdc-search"
                placeholder="Note id, GRN, PO, vendor, invoice #, note #…"
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
                title="No rows in queue"
                description="No records found. Data will appear here once GRNs with pending debit/credit notes are imported."
              />
            </div>
          ) : null}
          {!loading && data && data.content.length > 0 ? (
            <>
              <p className="text-muted-foreground border-b px-4 py-2 text-sm">
                Showing {data.curr_page_count} of {data.total} note(s).
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/60 hover:bg-muted/60">
                      <TableHead className="whitespace-nowrap">Note id</TableHead>
                      <TableHead className="whitespace-nowrap">GRN id</TableHead>
                      <TableHead className="whitespace-nowrap">PO Number</TableHead>
                      <TableHead>GRN status</TableHead>
                      <TableHead>GRN audit status</TableHead>
                      <TableHead className="min-w-[100px]">Vendor inv. #</TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Box (inv.)
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Actual boxes
                      </TableHead>
                      <TableHead className="whitespace-nowrap">Vendor Id</TableHead>
                      <TableHead className="min-w-[120px]">Vendor name</TableHead>
                      <TableHead className="whitespace-nowrap">GRN audited by</TableHead>
                      <TableHead>Credit/Debit type</TableHead>
                      <TableHead>Note status</TableHead>
                      <TableHead className="min-w-[120px]">Note number</TableHead>
                      <TableHead># assignment</TableHead>
                      <TableHead>Upload status</TableHead>
                      <TableHead>Uploaded by</TableHead>
                      <TableHead>Reverse #</TableHead>
                      <TableHead>Reverse upload</TableHead>
                      <TableHead>Reverse by</TableHead>
                      <TableHead className="whitespace-nowrap">Created by</TableHead>
                      <TableHead className="whitespace-nowrap">Created at</TableHead>
                      <TableHead className="whitespace-nowrap">Updated at</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.content.map((row, idx) => (
                      <TableRow
                        key={row.note_id}
                        className={cn(
                          "hover:bg-muted/40",
                          idx % 2 === 1 ? "bg-muted/20" : ""
                        )}
                      >
                        <TableCell className="font-mono text-xs">{row.note_id}</TableCell>
                        <TableCell className="font-mono text-xs">
                          <Link
                            href={`/inbound/grns/${row.grn_id}`}
                            className="text-primary font-medium underline-offset-4 hover:underline"
                          >
                            {row.grn_id}
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.po_id != null && row.vendor_id != null ? (
                            <Link
                              href={`/inbound/vendors/${row.vendor_id}/purchase-orders/${row.po_id}`}
                              className="text-primary font-medium underline-offset-4 hover:underline"
                            >
                              {row.po_id}
                            </Link>
                          ) : (
                            (row.po_id ?? "—")
                          )}
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
                        <TableCell className="max-w-[140px] truncate text-xs">
                          {row.vendor_invoice_number ?? "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {row.box_count_invoice ?? "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {row.actual_box_count_recieved ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.vendor_id != null ? (
                            <Link
                              href={`/inbound/vendors/${row.vendor_id}`}
                              className="text-primary font-medium underline-offset-4 hover:underline"
                            >
                              {row.vendor_id}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate text-sm">
                          {row.vendor_name ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[120px] truncate text-xs">
                          {row.grn_audit_by ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatNoteType(row.credit_debit_note_type)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-xs",
                            debitGood(row.credit_debit_note_status)
                          )}
                        >
                          {row.credit_debit_note_status ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate text-xs">
                          {row.credit_debit_note_number ?? "—"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-xs",
                            debitGood(row.credit_debit_note_number_assignment_status)
                          )}
                        >
                          {row.credit_debit_note_number_assignment_status ?? "—"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-xs",
                            debitGood(row.credit_debit_note_upload_status),
                            debitBad(row.credit_debit_note_upload_status)
                          )}
                        >
                          {row.credit_debit_note_upload_status ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[120px] truncate text-xs">
                          {row.credit_debit_note_uploaded_by ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[120px] truncate text-xs">
                          {row.reverse_credit_debit_note_number ?? "—"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-xs",
                            debitBad(row.reverse_credit_debit_note_upload_status),
                            debitGood(row.reverse_credit_debit_note_upload_status)
                          )}
                        >
                          {row.reverse_credit_debit_note_upload_status ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[100px] truncate text-xs">
                          {row.reverse_credit_debit_note_uploaded_by ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {row.created_by ?? "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatDisplayDateTime(row.created_at)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatDisplayDateTime(row.updated_at)}
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
                Page {data.current_page} of {totalPages} — {data.total} note(s) total
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
