"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, apiUrl, getStoredToken } from "@/lib/api-browser";
import { CompanyNameWithLogo } from "@/components/company/company-logo";
import { Button } from "@/components/ui/button";
import {
  originalEaFiles,
  type EaFile,
  type ZapAtt,
} from "@/app/(app)/(logistics)/outbound/outbound-po-documents-section";

type Payload = {
  outboundPoId: number | null;
  zapAttachments: ZapAtt[];
  eautomateFiles: EaFile[];
  legacyOutboundFileFetchEnabled: boolean;
};

type RefFileRow = {
  key: string;
  fileId: number;
  uploadedAt: string | null;
  uploadedBy: string | null;
  fileName: string;
  source: "zap" | "eautomate";
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

function buildRefRows(
  zapAttachments: ZapAtt[],
  eaFiles: EaFile[],
  legacyFetch: boolean
): RefFileRow[] {
  const rows: RefFileRow[] = zapAttachments.map((a) => ({
    key: `zap-${a.id}`,
    fileId: a.id,
    uploadedAt: a.created_at,
    uploadedBy: null,
    fileName: a.original_filename,
    source: "zap",
    canDownload: true,
  }));
  for (const f of originalEaFiles(eaFiles)) {
    rows.push({
      key: `ea-${f.eautomate_file_id}`,
      fileId: f.eautomate_file_id,
      uploadedAt: f.created_at,
      uploadedBy: f.file_uploaded_by,
      fileName: f.file_name,
      source: "eautomate",
      canDownload: Boolean(f.zap_storage_path || legacyFetch),
    });
  }
  return rows;
}

export function ConsignmentPoReferenceFiles({
  consignmentId,
  companyName,
  embedded = false,
}: Readonly<{
  consignmentId: number;
  companyName: string | null;
  /** When true, renders inside a parent card without its own page-level section heading. */
  embedded?: boolean;
}>) {
  const [loading, setLoading] = React.useState(true);
  const [payload, setPayload] = React.useState<Payload | null>(null);
  const [dlBusy, setDlBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await apiFetch<Payload>(
          `/api/outbound/consignments/${consignmentId}/po-reference-files`
        );
        if (!cancelled) setPayload(data);
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Failed to load PO files");
          setPayload(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [consignmentId]);

  const rows = React.useMemo(() => {
    if (!payload) return [];
    return buildRefRows(
      payload.zapAttachments ?? [],
      payload.eautomateFiles ?? [],
      payload.legacyOutboundFileFetchEnabled
    );
  }, [payload]);

  async function download(source: "zap" | "eautomate", fileId: number, fileName: string) {
    const poId = payload?.outboundPoId;
    if (!poId) return;
    const busyKey = `${source}-${fileId}`;
    setDlBusy(busyKey);
    try {
      const path =
        source === "zap"
          ? `/api/outbound/purchase-orders/${poId}/attachments/${fileId}`
          : `/api/outbound/purchase-orders/${poId}/eautomate-files/${fileId}`;
      const token = getStoredToken();
      const headers = new Headers();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const res = await fetch(apiUrl(path), { headers });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? res.statusText);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || "download";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDlBusy(null);
    }
  }

  const content = (
    <div className={embedded ? "space-y-3" : "flex flex-wrap items-start gap-3"}>
      {companyName ? <CompanyNameWithLogo name={companyName} size={32} /> : null}
      <div className={embedded ? "w-full overflow-x-auto rounded-md border" : "min-w-0 flex-1 overflow-x-auto rounded-md border"}>
          <table className="w-full table-fixed border-collapse text-left text-sm">
            <thead>
              <tr className="bg-muted/60 border-b">
                <th className="w-24 px-3 py-2 font-semibold">File ID</th>
                <th className="px-3 py-2 font-semibold">Uploaded At</th>
                <th className="px-3 py-2 font-semibold">Uploaded By</th>
                <th className="px-3 py-2 font-semibold">File Name</th>
                <th className="w-20 px-3 py-2 text-center font-semibold">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-muted-foreground px-3 py-6 text-center">
                    <Loader2 className="mr-2 inline size-4 animate-spin" />
                    Loading files…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-muted-foreground px-3 py-6 text-center text-sm">
                    No PO reference files found for this consignment.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.key}>
                    <td className="px-3 py-2 font-mono tabular-nums">{row.fileId}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDateTime(row.uploadedAt)}</td>
                    <td className="px-3 py-2 text-xs">{row.uploadedBy ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs break-all">{row.fileName}</td>
                    <td className="px-3 py-2 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-primary h-8 w-8"
                        disabled={!row.canDownload || dlBusy === `${row.source}-${row.fileId}`}
                        aria-label={`Download ${row.fileName}`}
                        onClick={() => void download(row.source, row.fileId, row.fileName)}
                      >
                        {dlBusy === `${row.source}-${row.fileId}` ? (
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
    </div>
  );

  if (embedded) {
    return (
      <div className="border-t pt-4">
        <h3 className="mb-3 text-sm font-semibold">Purchase Order Files For Reference</h3>
        {content}
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">Purchase Order Files For Reference</h2>
      {content}
    </section>
  );
}
