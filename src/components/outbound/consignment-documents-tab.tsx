"use client";

import * as React from "react";
import { Download, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, apiUrl, getStoredToken } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type EaFile,
  type ZapAtt,
} from "@/app/(app)/(logistics)/outbound/outbound-po-documents-section";
import type { OutboundConsignmentRow } from "@/server/services/outboundConsignmentsService";

type PostDispatchKind = "invoice" | "bilty" | "pod" | "return";

function postDispatchCategory(f: EaFile): PostDispatchKind | null {
  const t = (f.file_type ?? "").toLowerCase();
  if (!t) return null;
  if (t.includes("return")) return "return";
  if (t.includes("pod") || t.includes("proof")) return "pod";
  if (t.includes("bilty") || t.includes("billty") || t.includes("bilt")) return "bilty";
  if (t.includes("invoice")) return "invoice";
  return null;
}

function eaFilesForKind(files: EaFile[], kind: PostDispatchKind): EaFile[] {
  return files.filter((f) => postDispatchCategory(f) === kind);
}

function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return d;
  return x.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

type FilesPayload = {
  outboundPoId: number | null;
  eautomateFiles: EaFile[];
  legacyOutboundFileFetchEnabled: boolean;
};

export function ConsignmentDocumentsTab({
  consignmentId,
  row,
  active,
  invoiceNumInput,
  savingInvoiceNum,
  uploadingInvoice,
  downloadingExcel,
  invoiceFileRef,
  onInvoiceNumChange,
  onSaveInvoiceNumber,
  onUploadInvoice,
  onDownloadInvoice,
  onDownloadExcel,
}: Readonly<{
  consignmentId: number;
  row: OutboundConsignmentRow;
  active: boolean;
  invoiceNumInput: string;
  savingInvoiceNum: boolean;
  uploadingInvoice: boolean;
  downloadingExcel: boolean;
  invoiceFileRef: React.RefObject<HTMLInputElement | null>;
  onInvoiceNumChange: (v: string) => void;
  onSaveInvoiceNumber: () => void;
  onUploadInvoice: () => void;
  onDownloadInvoice: () => void;
  onDownloadExcel: () => void;
}>) {
  const [filesLoading, setFilesLoading] = React.useState(false);
  const [files, setFiles] = React.useState<FilesPayload | null>(null);
  const [dlBusy, setDlBusy] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!active) return;
    let cancelled = false;
    (async () => {
      setFilesLoading(true);
      try {
        const data = await apiFetch<FilesPayload & { zapAttachments: ZapAtt[] }>(
          `/api/outbound/consignments/${consignmentId}/po-reference-files`
        );
        if (!cancelled) {
          setFiles({
            outboundPoId: data.outboundPoId,
            eautomateFiles: data.eautomateFiles ?? [],
            legacyOutboundFileFetchEnabled: data.legacyOutboundFileFetchEnabled,
          });
        }
      } catch {
        if (!cancelled) setFiles(null);
      } finally {
        if (!cancelled) setFilesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [consignmentId, active]);

  async function downloadEa(fileId: number, fileName: string) {
    const poId = files?.outboundPoId;
    if (!poId) return;
    setDlBusy(fileId);
    try {
      const token = getStoredToken();
      const headers = new Headers();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const res = await fetch(
        apiUrl(`/api/outbound/purchase-orders/${poId}/eautomate-files/${fileId}`),
        { headers }
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? res.statusText);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDlBusy(null);
    }
  }

  const legacyFetch = files?.legacyOutboundFileFetchEnabled ?? false;
  const eaAll = files?.eautomateFiles ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Consignment invoice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 divide-y">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
            <span className="text-muted-foreground text-xs font-medium">Invoice number</span>
            {row.invoice_number ? (
              <span className="font-mono text-sm">{row.invoice_number}</span>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  value={invoiceNumInput}
                  onChange={(e) => onInvoiceNumChange(e.target.value)}
                  placeholder="Enter invoice number"
                  className="h-8 w-44 text-xs font-mono"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  disabled={savingInvoiceNum || !invoiceNumInput.trim()}
                  onClick={onSaveInvoiceNumber}
                >
                  {savingInvoiceNum ? "Saving…" : "Save"}
                </Button>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={downloadingExcel}
              onClick={onDownloadExcel}
            >
              <Download className="mr-1 size-3.5" />
              {downloadingExcel ? "Downloading…" : "Download invoice Excel"}
            </Button>
            {row.invoice_file_name ? (
              <Button type="button" variant="outline" size="sm" onClick={onDownloadInvoice}>
                <Download className="mr-1 size-3.5" />
                Download invoice file
              </Button>
            ) : null}
          </div>
          {row.invoice_number_status && !row.invoice_file_name ? (
            <div className="flex flex-wrap items-center gap-2 pt-3">
              <input ref={invoiceFileRef} type="file" accept=".pdf,.jpg,.jpeg" className="text-xs" />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={uploadingInvoice}
                onClick={onUploadInvoice}
              >
                <Upload className="mr-1 size-3.5" />
                {uploadingInvoice ? "Uploading…" : "Upload invoice"}
              </Button>
            </div>
          ) : null}
          <p className="text-muted-foreground pt-2 text-xs">
            Invoice status: {row.invoice_number_status ?? "—"} · Upload:{" "}
            {row.invoice_upload_status ?? "—"}
          </p>
        </CardContent>
      </Card>

      {filesLoading ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Loading synced documents…
        </p>
      ) : (
        (
          [
            ["Invoice", "invoice" as PostDispatchKind],
            ["Bilty", "bilty" as PostDispatchKind],
            ["Proof of Delivery", "pod" as PostDispatchKind],
            ["Return Invoice", "return" as PostDispatchKind],
          ] as const
        ).map(([label, kind]) => {
          const sectionFiles = eaFilesForKind(eaAll, kind);
          return (
            <Card key={kind}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{label}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="w-full overflow-x-auto">
                  <table className="w-full table-fixed border-collapse text-left text-sm">
                    <thead>
                      <tr className="bg-muted/60 border-b">
                        <th className="w-24 px-3 py-2 font-semibold">File ID</th>
                        <th className="px-3 py-2 font-semibold">Uploaded at</th>
                        <th className="px-3 py-2 font-semibold">Uploaded by</th>
                        <th className="px-3 py-2 font-semibold">File name</th>
                        <th className="w-20 px-3 py-2 text-center font-semibold">Download</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {sectionFiles.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="text-muted-foreground px-3 py-8 text-center text-sm"
                          >
                            No document was found
                          </td>
                        </tr>
                      ) : (
                        sectionFiles.map((f) => (
                          <tr key={f.eautomate_file_id}>
                            <td className="px-3 py-2 tabular-nums">{f.eautomate_file_id}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs">
                              {fmtDateTime(f.created_at)}
                            </td>
                            <td className="px-3 py-2 text-xs">{f.file_uploaded_by ?? "—"}</td>
                            <td className="px-3 py-2 font-mono text-xs break-all">{f.file_name}</td>
                            <td className="px-3 py-2 text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-primary h-8 w-8"
                                disabled={
                                  !(f.zap_storage_path || legacyFetch) ||
                                  dlBusy === f.eautomate_file_id
                                }
                                onClick={() =>
                                  void downloadEa(f.eautomate_file_id, f.file_name)
                                }
                              >
                                {dlBusy === f.eautomate_file_id ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <Download className="size-4" />
                                )}
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
