"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, apiUrl, getStoredToken } from "@/lib/api-browser";
import type {
  EanImportPreview,
  EanImportPreviewRow,
  EanImportRowStatus,
} from "@/server/services/eanMappingsImportService";
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

function rowStatusClass(status: EanImportRowStatus): string {
  if (status === "error") return "bg-destructive/10";
  if (status === "replace") return "bg-amber-500/15";
  if (status === "warning") return "bg-amber-500/10";
  if (status === "new") return "bg-emerald-500/10";
  return "";
}

function statusBadgeVariant(
  status: EanImportRowStatus
): "outline" | "secondary" | "destructive" {
  if (status === "error") return "destructive";
  if (status === "replace" || status === "warning") return "secondary";
  return "outline";
}

function needsApproval(status: EanImportRowStatus): boolean {
  return status === "replace" || status === "warning";
}

export function EanMappingsImportPreviewDialog({
  open,
  onOpenChange,
  preview,
  pendingFile,
  onApplied,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: EanImportPreview | null;
  pendingFile: File | null;
  onApplied?: () => void;
}>) {
  const [busy, setBusy] = React.useState(false);
  const [approvedRows, setApprovedRows] = React.useState<Set<number>>(new Set());

  React.useEffect(() => {
    if (!open || !preview) {
      setApprovedRows(new Set());
      return;
    }
    setApprovedRows(
      new Set(
        preview.rowsPreview
          .filter((r) => needsApproval(r.status))
          .map((r) => r.rowNumber)
      )
    );
  }, [open, preview]);

  const approvableRows = React.useMemo(
    () => preview?.rowsPreview.filter((r) => needsApproval(r.status)) ?? [],
    [preview]
  );

  function toggleRow(rowNumber: number, checked: boolean) {
    setApprovedRows((prev) => {
      const next = new Set(prev);
      if (checked) next.add(rowNumber);
      else next.delete(rowNumber);
      return next;
    });
  }

  function toggleAllApproved(checked: boolean) {
    if (!checked) {
      setApprovedRows(new Set());
      return;
    }
    setApprovedRows(new Set(approvableRows.map((r) => r.rowNumber)));
  }

  async function handleApply() {
    if (!preview?.ok || !pendingFile) return;
    const missingApproval = approvableRows.some(
      (r) => !approvedRows.has(r.rowNumber)
    );
    if (missingApproval && approvableRows.length > 0) {
      const ok = window.confirm(
        "Some replacement rows are not selected. Apply only the checked rows?"
      );
      if (!ok) return;
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", pendingFile);
      fd.set("approvedRowNumbers", JSON.stringify([...approvedRows]));
      const token = getStoredToken();
      const headers = new Headers();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const res = await fetch(apiUrl("/api/ean-mappings/import/apply"), {
        method: "POST",
        headers,
        body: fd,
      });
      const json = (await res.json()) as {
        error?: string;
        upserted?: number;
        skipped?: number;
      };
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      toast.success(
        `Imported ${json.upserted ?? 0} mapping row(s)${
          json.skipped ? ` (${json.skipped} skipped)` : ""
        }`
      );
      onOpenChange(false);
      onApplied?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  const applyCount = React.useMemo(() => {
    if (!preview) return 0;
    return preview.rowsPreview.filter((row) => {
      if (row.status === "error" || row.status === "unchanged") return false;
      if (needsApproval(row.status) && !approvedRows.has(row.rowNumber)) {
        return false;
      }
      return true;
    }).length;
  }, [preview, approvedRows]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl" showCloseButton>
        <DialogHeader>
          <DialogTitle>Review EAN mapping import</DialogTitle>
          <DialogDescription>
            {pendingFile?.name ?? "CSV"} — confirm new and replacement rows before
            applying.
          </DialogDescription>
        </DialogHeader>

        {preview ? (
          <div className="max-h-[60vh] space-y-4 overflow-y-auto">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">{preview.stats.totalRows} rows</Badge>
              {preview.stats.newCount > 0 ? (
                <Badge variant="outline">{preview.stats.newCount} new</Badge>
              ) : null}
              {preview.stats.replaceCount > 0 ? (
                <Badge variant="secondary">{preview.stats.replaceCount} replace</Badge>
              ) : null}
              {preview.stats.warningCount > 0 ? (
                <Badge variant="secondary">{preview.stats.warningCount} warnings</Badge>
              ) : null}
              {preview.stats.unchangedCount > 0 ? (
                <Badge variant="outline">{preview.stats.unchangedCount} unchanged</Badge>
              ) : null}
              {preview.stats.errorCount > 0 ? (
                <Badge variant="destructive">{preview.stats.errorCount} errors</Badge>
              ) : null}
            </div>

            {approvableRows.length > 0 ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={
                    approvableRows.length > 0 &&
                    approvableRows.every((r) => approvedRows.has(r.rowNumber))
                  }
                  onChange={(e) => toggleAllApproved(e.target.checked)}
                />
                <span>Select all replacement / warning rows ({approvableRows.length})</span>
              </label>
            ) : null}

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[720px] border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="px-2 py-2 w-8" />
                    <th className="px-2 py-2">#</th>
                    <th className="px-2 py-2">SKU</th>
                    <th className="px-2 py-2">Company</th>
                    <th className="px-2 py-2">Zap EAN</th>
                    <th className="px-2 py-2">Type</th>
                    <th className="px-2 py-2">Universal EAN</th>
                    <th className="px-2 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rowsPreview.map((row) => (
                    <ImportPreviewRow
                      key={row.rowNumber}
                      row={row}
                      approved={approvedRows.has(row.rowNumber)}
                      onToggle={(checked) => toggleRow(row.rowNumber, checked)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || !preview?.ok || applyCount === 0}
            onClick={() => void handleApply()}
          >
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Apply {applyCount > 0 ? `${applyCount} row(s)` : "import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportPreviewRow({
  row,
  approved,
  onToggle,
}: {
  row: EanImportPreviewRow;
  approved: boolean;
  onToggle: (checked: boolean) => void;
}) {
  const showCheckbox = needsApproval(row.status);
  const existing = row.existing;

  return (
    <tr className={cn("border-b align-top", rowStatusClass(row.status))}>
      <td className="px-2 py-2">
        {showCheckbox ? (
          <input
            type="checkbox"
            checked={approved}
            onChange={(e) => onToggle(e.target.checked)}
            aria-label={`Approve row ${row.rowNumber}`}
          />
        ) : null}
      </td>
      <td className="px-2 py-2 tabular-nums">{row.rowNumber}</td>
      <td className="px-2 py-2 font-mono">{row.sku_code || "—"}</td>
      <td className="px-2 py-2">{row.company_name || "—"}</td>
      <td className="px-2 py-2 font-mono">
        {row.status === "replace" && existing?.zap_ean ? (
          <span className="text-muted-foreground line-through">{existing.zap_ean}</span>
        ) : null}
        {row.status === "replace" && existing?.zap_ean ? " → " : null}
        {row.zap_ean ?? "—"}
      </td>
      <td className="px-2 py-2">{row.ean_type || "—"}</td>
      <td className="px-2 py-2 font-mono">{row.universal_ean ?? "—"}</td>
      <td className="px-2 py-2">
        <Badge variant={statusBadgeVariant(row.status)} className="font-normal">
          {row.status}
        </Badge>
        {row.issues.length > 0 ? (
          <ul className="text-muted-foreground mt-1 list-disc pl-3 text-[10px]">
            {row.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : null}
      </td>
    </tr>
  );
}

export async function previewEanMappingsImportFile(
  file: File
): Promise<EanImportPreview> {
  const fd = new FormData();
  fd.set("file", file);
  return apiFetch<EanImportPreview>("/api/ean-mappings/import/preview", {
    method: "POST",
    body: fd,
  });
}
