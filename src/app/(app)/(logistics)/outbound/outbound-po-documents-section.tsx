"use client";

import * as React from "react";
import Link from "next/link";
import { Download, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type EaFile = {
  eautomate_file_id: number;
  file_name: string;
  file_uploaded_by: string | null;
  created_at: string | null;
  file_type: string | null;
  zap_storage_path?: string | null;
};

export type ZapAtt = {
  id: number;
  original_filename: string;
  kind: string;
  created_at: string | null;
};

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

/** PO originals on Details tab (excludes post-dispatch file types). */
export function originalEaFiles(files: EaFile[]): EaFile[] {
  return files.filter((f) => postDispatchCategory(f) == null);
}

type DocumentRow =
  | {
      key: string;
      source: "zap";
      fileName: string;
      kind: string;
      uploadedAt: string | null;
      uploadedBy: string | null;
      downloadId: number;
      canDownload: true;
    }
  | {
      key: string;
      source: "eautomate";
      fileName: string;
      kind: string | null;
      uploadedAt: string | null;
      uploadedBy: string | null;
      downloadId: number;
      canDownload: boolean;
    };

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

function buildDocumentRows(
  zapAttachments: ZapAtt[],
  eaOriginalFiles: EaFile[],
  legacyFetch: boolean
): DocumentRow[] {
  const rows: DocumentRow[] = zapAttachments.map((a) => ({
    key: `zap-${a.id}`,
    source: "zap" as const,
    fileName: a.original_filename,
    kind: a.kind,
    uploadedAt: a.created_at,
    uploadedBy: null,
    downloadId: a.id,
    canDownload: true,
  }));
  for (const f of eaOriginalFiles) {
    rows.push({
      key: `ea-${f.eautomate_file_id}`,
      source: "eautomate",
      fileName: f.file_name,
      kind: f.file_type,
      uploadedAt: f.created_at,
      uploadedBy: f.file_uploaded_by,
      downloadId: f.eautomate_file_id,
      canDownload: Boolean(f.zap_storage_path || legacyFetch),
    });
  }
  return rows;
}

export function OutboundPoDocumentsSection({
  zapAttachments,
  eautomateFiles,
  legacyFetch,
  zapReady,
  eautomateDownloadConfigured,
  canMutate,
  canWritePo,
  dlBusy,
  onDownloadZap,
  onDownloadEa,
  eaZapFile,
  eaZapUploadInputKey,
  eaZapUploading,
  onEaZapFileChange,
  onUploadEaZap,
  listingsSourceFilename,
  uploadSlot,
}: {
  zapAttachments: ZapAtt[];
  eautomateFiles: EaFile[];
  legacyFetch: boolean;
  zapReady: boolean;
  eautomateDownloadConfigured: boolean;
  canMutate: boolean;
  canWritePo: boolean;
  dlBusy: number | string | null;
  onDownloadZap: (attachmentId: number, fileName: string) => void;
  onDownloadEa: (fileId: number, fileName: string) => void;
  eaZapFile: File | null;
  eaZapUploadInputKey: number;
  eaZapUploading: boolean;
  onEaZapFileChange: (file: File | null) => void;
  onUploadEaZap: () => void;
  listingsSourceFilename?: string | null;
  /** Upload form (Add PO document) rendered below the table */
  uploadSlot?: React.ReactNode;
}) {
  const eaOriginal = originalEaFiles(eautomateFiles);
  const rows = buildDocumentRows(zapAttachments, eaOriginal, legacyFetch);
  const showEaStorageHint =
    eaOriginal.length > 0 && canWritePo && zapReady;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Original PO documents</CardTitle>
        <CardDescription>
          PDF and spreadsheet uploaded in Zap (create or below), plus documents synced
          from eAutomate when available. Spreadsheets update line items on upload.
          {listingsSourceFilename ? (
            <>
              {" "}
              Active line-item source:{" "}
              <span className="font-medium">{listingsSourceFilename}</span>
            </>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-0 sm:p-6 sm:pt-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="px-3 py-2 font-semibold">Source</th>
                <th className="px-3 py-2 font-semibold">File name</th>
                <th className="px-3 py-2 font-semibold">Kind</th>
                <th className="px-3 py-2 font-semibold">Uploaded at</th>
                <th className="px-3 py-2 font-semibold">Uploaded by</th>
                <th className="px-3 py-2 font-semibold">Download</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-muted-foreground px-3 py-4 text-center"
                  >
                    No PO documents yet. Upload PDF and spreadsheet when creating the
                    PO, or use <strong>Add PO document</strong> below.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const busyKey =
                    row.source === "zap"
                      ? `zap-${row.downloadId}`
                      : `ea-${row.downloadId}`;
                  return (
                    <tr key={row.key} className="border-b">
                      <td className="px-3 py-2">
                        <Badge
                          variant={row.source === "zap" ? "secondary" : "outline"}
                          className="font-normal"
                        >
                          {row.source === "zap" ? "Zap" : "eAutomate"}
                        </Badge>
                      </td>
                      <td
                        className="max-w-[240px] truncate px-3 py-2"
                        title={row.fileName}
                      >
                        {row.fileName}
                      </td>
                      <td className="px-3 py-2 capitalize">{row.kind ?? "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {fmtDateTime(row.uploadedAt)}
                      </td>
                      <td className="max-w-[120px] truncate px-3 py-2 text-xs">
                        {row.uploadedBy ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className="inline-flex"
                          title={
                            !row.canDownload
                              ? "File not available for download. Upload a copy to Zap Storage to enable."
                              : undefined
                          }
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-primary h-8 w-8"
                            disabled={!row.canDownload || dlBusy === busyKey}
                            aria-label={`Download ${row.fileName}`}
                            onClick={() =>
                              row.source === "zap"
                                ? onDownloadZap(row.downloadId, row.fileName)
                                : onDownloadEa(row.downloadId, row.fileName)
                            }
                          >
                            {dlBusy === busyKey ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Download className="size-4" />
                            )}
                          </Button>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {showEaStorageHint ? (
          <div className="border-t px-3 py-3 sm:px-0">
            <p className="text-muted-foreground mb-2 text-xs">
              eAutomate-synced files may need a copy in Zap Storage before download
              works.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="ea-zap-upload" className="text-muted-foreground text-xs">
                  Upload a copy to Zap Storage
                </Label>
                <Input
                  key={eaZapUploadInputKey}
                  id="ea-zap-upload"
                  type="file"
                  className="max-w-xs cursor-pointer"
                  disabled={eaZapUploading}
                  onChange={(e) => onEaZapFileChange(e.target.files?.[0] ?? null)}
                />
              </div>
              <Button
                type="button"
                size="sm"
                disabled={!eaZapFile || eaZapUploading}
                onClick={onUploadEaZap}
              >
                {eaZapUploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Upload"
                )}
              </Button>
            </div>
          </div>
        ) : null}

        {!zapReady && !eautomateDownloadConfigured && rows.length === 0 ? (
          <p className="text-muted-foreground border-t px-3 py-2 text-xs sm:px-0">
            Configure Zap Storage or the legacy outbound file URL on the server to
            enable downloads.
          </p>
        ) : null}

        {uploadSlot ? (
          <div className="border-t px-3 pt-4 sm:px-0">{uploadSlot}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function OutboundPoAddDocumentUpload({
  canMutate,
  file,
  uploading,
  onFileChange,
  onUpload,
}: {
  canMutate: boolean;
  file: File | null;
  uploading: boolean;
  onFileChange: (file: File | null) => void;
  onUpload: () => void;
}) {
  if (!canMutate) return null;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Add PO document</p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          PDF or spreadsheet/CSV, max 2MB. Spreadsheets update PO line items immediately
          on upload — use the vendor PO file, not the sample template on live POs.
        </p>
        <p className="text-xs">
          <Link
            href="/samples/outbound/sample_po_line_items_spreadsheet.csv?v=2"
            className="text-primary font-medium underline-offset-2 hover:underline"
            download
          >
            Sample spreadsheet (vendor format: HSN, IGST %, Quantity, MRP, …)
          </Link>
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="po-upload">Choose file</Label>
          <Input
            id="po-upload"
            type="file"
            accept=".pdf,.csv,.xlsx,.xls"
            className="max-w-xs cursor-pointer"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
        </div>
        <Button type="button" disabled={!file || uploading} onClick={onUpload}>
          {uploading ? "Uploading…" : "Upload"}
        </Button>
      </div>
    </div>
  );
}
