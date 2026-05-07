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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CircleHelp } from "lucide-react";
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

const PENDING_DCN_WORKFLOW = `
flowchart TD
  openPage["Open this pending list"] --> seeList["All rows shown still need attention"]
  seeList --> oneRow["Each row is one debit or credit note case"]
  oneRow --> needFile{"Attachment still required?"}
  needFile -->|Yes| upload["Upload the note copy or supporting file"]
  needFile -->|No| choose
  upload --> choose{"Is the case acceptable?"}
  choose -->|Yes| acceptBtn["Accept"]
  choose -->|No| declineBtn["Decline"]
  acceptBtn --> done["Completed cases no longer appear here"]
  declineBtn --> done
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

function isTerminalNoteStatus(value: string | null): boolean {
  if (!value) return false;
  const up = value.trim().toUpperCase();
  return (
    up === "APPROVED" ||
    up === "REJECTED" ||
    up === "CLOSED" ||
    up === "DONE" ||
    up === "COMPLETED" ||
    up === "SETTLED"
  );
}

function isUploadedStatus(value: string | null): boolean {
  if (!value) return false;
  const up = value.trim().toUpperCase();
  return up === "UPLOADED" || up === "DONE" || up === "COMPLETED";
}

type PendingRowProps = Readonly<{
  row: NoteRow;
  rowIndex: number;
  uploadingNoteId: number | null;
  decidingNoteId: number | null;
  onUpload: (noteId: number, grnId: number) => void;
  onDecision: (noteId: number, grnId: number, status: "APPROVED" | "REJECTED") => void;
}>;

function PendingDebitCreditTableRow({
  row,
  rowIndex,
  uploadingNoteId,
  decidingNoteId,
  onUpload,
  onDecision,
}: PendingRowProps) {
  const noteTerminal = isTerminalNoteStatus(row.credit_debit_note_status);
  const uploadDone = isUploadedStatus(row.credit_debit_note_upload_status);
  const uploadNeeded = uploadDone === false;
  const canDecide = noteTerminal === false;
  const uploadBusy = uploadingNoteId === row.note_id;
  const actionBusy = decidingNoteId === row.note_id;
  const showNoActions = uploadNeeded === false && canDecide === false;

  return (
    <TableRow
      className={cn("hover:bg-muted/40", rowIndex % 2 === 1 ? "bg-muted/20" : "")}
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
      <TableCell className={cn("text-xs", closedStatusClass(row.grn_status))}>
        {row.grn_status ?? "—"}
      </TableCell>
      <TableCell
        className={cn("text-xs", closedStatusClass(row.grn_audit_status))}
      >
        {row.grn_audit_status ?? "—"}
      </TableCell>
      <TableCell className="max-w-[140px] truncate text-xs">
        {row.vendor_invoice_number ?? "—"}
      </TableCell>
      <TableCell className="text-right text-xs">{row.box_count_invoice ?? "—"}</TableCell>
      <TableCell className="text-right text-xs">
        {row.actual_box_count_recieved ?? "—"}
      </TableCell>
      <TableCell className="font-mono text-xs">
        {row.vendor_id == null ? (
          "—"
        ) : (
          <Link
            href={`/inbound/vendors/${row.vendor_id}`}
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            {row.vendor_id}
          </Link>
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
        className={cn("text-xs", debitGood(row.credit_debit_note_status))}
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
      <TableCell className="text-muted-foreground text-xs">{row.created_by ?? "—"}</TableCell>
      <TableCell className="whitespace-nowrap text-xs">
        {formatDisplayDateTime(row.created_at)}
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs">
        {formatDisplayDateTime(row.updated_at)}
      </TableCell>
      <TableCell className="min-w-[250px]">
        <div className="flex flex-wrap gap-2">
          {uploadNeeded ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadBusy || actionBusy}
              onClick={() => onUpload(row.note_id, row.grn_id)}
            >
              {uploadBusy ? "Uploading..." : "Upload"}
            </Button>
          ) : null}
          {canDecide ? (
            <>
              <Button
                type="button"
                size="sm"
                disabled={actionBusy || uploadBusy}
                onClick={() => void onDecision(row.note_id, row.grn_id, "APPROVED")}
              >
                {actionBusy ? "Saving..." : "Accept"}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={actionBusy || uploadBusy}
                onClick={() => void onDecision(row.note_id, row.grn_id, "REJECTED")}
              >
                {actionBusy ? "Saving..." : "Decline"}
              </Button>
            </>
          ) : null}
          {showNoActions ? (
            <span className="text-muted-foreground text-xs">No actions available</span>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function InboundPendingDebitCreditPage() {
  const [page, setPage] = React.useState(1);
  const [searchDraft, setSearchDraft] = React.useState("");
  const [searchApplied, setSearchApplied] = React.useState("");
  const [data, setData] = React.useState<ListResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [uploadingNoteId, setUploadingNoteId] = React.useState<number | null>(null);
  const [decidingNoteId, setDecidingNoteId] = React.useState<number | null>(null);
  const [uploadTarget, setUploadTarget] = React.useState<{
    noteId: number;
    grnId: number;
  } | null>(null);
  const uploadRef = React.useRef<HTMLInputElement | null>(null);
  const [workflowOpen, setWorkflowOpen] = React.useState(false);
  const [workflowChartMounted, setWorkflowChartMounted] = React.useState(false);

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

  const handleUpload = React.useCallback((noteId: number, grnId: number) => {
    setUploadTarget({ noteId, grnId });
    uploadRef.current?.click();
  }, []);

  const handleUploadFileSelected = React.useCallback(
    async (file: File | null) => {
      if (!file || !uploadTarget) return;
      setUploadingNoteId(uploadTarget.noteId);
      try {
        const fd = new FormData();
        fd.set("file", file);
        fd.set("kind", "debit_note");
        fd.set("noteId", String(uploadTarget.noteId));
        await apiFetch(`/api/inbound/grns/${uploadTarget.grnId}/upload-zap`, {
          method: "POST",
          body: fd,
        });
        toast.success("Debit/Credit note file uploaded");
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploadingNoteId(null);
        setUploadTarget(null);
      }
    },
    [load, uploadTarget]
  );

  const handleDecision = React.useCallback(
    async (noteId: number, grnId: number, status: "APPROVED" | "REJECTED") => {
      const message =
        status === "APPROVED"
          ? "Accept this debit/credit note?"
          : "Decline this debit/credit note?";
      if (!globalThis.confirm(message)) return;
      setDecidingNoteId(noteId);
      try {
        await apiFetch(`/api/inbound/pending-debit-credit/notes/${noteId}/decision`, {
          method: "POST",
          body: JSON.stringify({ grn_id: grnId, status }),
        });
        toast.success(status === "APPROVED" ? "Note accepted" : "Note declined");
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action failed");
      } finally {
        setDecidingNoteId(null);
      }
    },
    [load]
  );

  const totalPages =
    data && data.total > 0 ? Math.ceil(data.total / data.per_page_count) : 1;

  return (
    <div className="mx-auto max-w-[1920px] space-y-4 px-2 py-4 md:px-4">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <AppPageTitle
          className="mb-0 min-w-0 flex-1"
          title="Pending Debit & Credit Notes"
          description="Debit and credit note cases that still need a file or your approval."
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
              Steps for each row on this screen. Scroll for the diagram.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 p-4">
            <p className="text-muted-foreground text-sm leading-relaxed">
              When you open this page, you see every debit or credit note that is still pending for
              this workflow. Each line is one case: vendor, GRN, and note details are in the columns.
              Next, attach any required document using{" "}
              <strong className="text-foreground">Upload</strong>, then record your decision with{" "}
              <strong className="text-foreground">Accept</strong> or{" "}
              <strong className="text-foreground">Decline</strong>. Completed cases disappear from this
              list.
            </p>
            {workflowChartMounted ? (
              <MermaidDiagram
                chart={PENDING_DCN_WORKFLOW}
                className="w-full overflow-x-auto"
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <Card className="border-primary/10 shadow-sm">
        <input
          ref={uploadRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            e.target.value = "";
            void handleUploadFileSelected(file);
          }}
        />
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
              <p className="text-muted-foreground border-b bg-muted/30 px-4 py-2 text-xs">
                Scroll right on the table to reach the Actions column (Upload, Accept, Decline).
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
                      <TableHead className="whitespace-nowrap">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.content.map((row, idx) => (
                      <PendingDebitCreditTableRow
                        key={row.note_id}
                        row={row}
                        rowIndex={idx}
                        uploadingNoteId={uploadingNoteId}
                        decidingNoteId={decidingNoteId}
                        onUpload={handleUpload}
                        onDecision={handleDecision}
                      />
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
