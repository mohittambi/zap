"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Download, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiUrl, getStoredToken } from "@/lib/api-browser";
import { useAuth } from "@/contexts/auth-context";
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
import { cn } from "@/lib/utils";

type OutboundPoDetail = {
  id: number;
  po_number: string;
  sold_via: string | null;
  company_id: number | null;
  company_name: string | null;
  delivery_city: string | null;
  delivery_address: string | null;
  billing_address: string | null;
  buyer_gstin: string | null;
  po_issue_date: string | null;
  expiry_date: string | null;
  po_type: string | null;
  po_creation_status: string | null;
  po_acknowledgement_status: string | null;
  po_fulfillment_status: string | null;
  calculated_po_status: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  is_wip: string | null;
  remarks: string | null;
  analytics_object: Record<string, unknown>;
};

type EaFile = {
  eautomate_file_id: number;
  file_name: string;
  file_uploaded_by: string | null;
  created_at: string | null;
  file_type: string | null;
};

type ZapAtt = {
  id: number;
  original_filename: string;
  kind: string;
  created_at: string | null;
};

type DetailPayload = {
  po: OutboundPoDetail;
  eautomateFiles: EaFile[];
  zapAttachments: ZapAtt[];
  sync: { ok: boolean; message?: string };
  eautomateDownloadConfigured: boolean;
};

function fmtDay(d: string | null | undefined): string {
  if (!d) return "—";
  const x = new Date(d.replace(" ", "T"));
  if (Number.isNaN(x.getTime())) return d;
  return x.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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

async function authFetchRaw(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const token = getStoredToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(apiUrl(path), { ...init, headers });
}

async function downloadBlob(path: string, filename: string) {
  const res = await authFetchRaw(path);
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? res.statusText);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 200);
  a.click();
  URL.revokeObjectURL(url);
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}

export function OutboundPoDetailClient({ poId }: { poId: string }) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canMutate = hasPermission("purchase_orders", "create");
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<DetailPayload | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [dlBusy, setDlBusy] = React.useState<number | string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await authFetchRaw(`/api/outbound/purchase-orders/${poId}/detail`);
      const j = (await res.json()) as DetailPayload & { error?: string };
      if (!res.ok) throw new Error(j.error ?? res.statusText);
      setData(j);
      if (!j.sync?.ok && j.sync?.message) {
        toast.message("Live sync skipped", { description: j.sync.message });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [poId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const po = data?.po;
  const isPartial =
    (po?.po_creation_status ?? "").toUpperCase().trim() === "PARTIAL";

  const onDelete = async () => {
    if (!canMutate || !isPartial) return;
    if (!window.confirm("Delete this partial purchase order from Zap? This cannot be undone.")) {
      return;
    }
    setDeleting(true);
    try {
      const res = await authFetchRaw(`/api/outbound/purchase-orders/${poId}`, {
        method: "DELETE",
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? res.statusText);
      toast.success("Purchase order deleted");
      router.push("/outbound/partial");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const onUpload = async () => {
    if (!canMutate || !file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const token = getStoredToken();
      const headers = new Headers();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const res = await fetch(apiUrl(`/api/outbound/purchase-orders/${poId}/attachments`), {
        method: "POST",
        headers,
        body: fd,
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? res.statusText);
      toast.success("File uploaded");
      setFile(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onDownloadEa = async (fileId: number, fileName: string) => {
    setDlBusy(`ea-${fileId}`);
    try {
      await downloadBlob(
        `/api/outbound/purchase-orders/${poId}/eautomate-files/${fileId}`,
        fileName
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDlBusy(null);
    }
  };

  const onDownloadZap = async (attachmentId: number, fileName: string) => {
    setDlBusy(`zap-${attachmentId}`);
    try {
      await downloadBlob(
        `/api/outbound/purchase-orders/${poId}/attachments/${attachmentId}`,
        fileName
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDlBusy(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 px-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading purchase order…
      </div>
    );
  }

  if (err || !po) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-2 py-6">
        <p className="text-destructive text-sm">{err ?? "Not found"}</p>
        <Button variant="outline" asChild>
          <Link href="/outbound">Back to purchase orders</Link>
        </Button>
      </div>
    );
  }

  const analytics = po.analytics_object ?? {};
  const analyticsEntries = Object.entries(analytics).filter(
    ([, v]) => v !== null && v !== undefined && v !== ""
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-2 py-4 md:px-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="gap-1">
          <Link href={isPartial ? "/outbound/partial" : "/outbound"}>
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(240px,300px)]">
        <div className="order-2 min-w-0 space-y-6 lg:order-1">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Purchase order</CardTitle>
              <CardDescription>{po.po_number}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Buyer company name">
                {po.company_name ?? "—"}
                {po.company_id != null ? (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    ({po.company_id})
                  </span>
                ) : null}
              </Field>
              <Field label="PO number">{po.po_number}</Field>
              <Field label="PO type">{po.po_type ?? "—"}</Field>
              <Field label="Sold via">{po.sold_via ?? "—"}</Field>
              <Field label="Delivery location">{po.delivery_city ?? "—"}</Field>
              <Field label="Buyer GSTIN">
                <span className="font-mono text-xs">{po.buyer_gstin ?? "—"}</span>
              </Field>
              <Field label="PO release date">{fmtDay(po.po_issue_date)}</Field>
              <Field label="Expiry date">{fmtDay(po.expiry_date)}</Field>
              <Field label="Created by">{po.created_by ?? "—"}</Field>
              <Field label="Created at">{fmtDateTime(po.created_at)}</Field>
              <Field label="PO creation status">{po.po_creation_status ?? "—"}</Field>
              <Field label="Acknowledgement">{po.po_acknowledgement_status ?? "—"}</Field>
              <Field label="Fulfillment">{po.po_fulfillment_status ?? "—"}</Field>
              <Field label="Calculated PO status">{po.calculated_po_status ?? "—"}</Field>
              <Field label="Is WIP?">{po.is_wip ?? "—"}</Field>
              <Field label="Updated at">{fmtDateTime(po.updated_at)}</Field>
            </CardContent>
            <CardContent className="grid gap-4 border-t pt-4 sm:grid-cols-1">
              <Field label="Delivery address">
                <p className="text-muted-foreground font-normal whitespace-pre-wrap">
                  {po.delivery_address ?? "—"}
                </p>
              </Field>
            </CardContent>
            <CardContent className="grid gap-4 border-t pt-4 sm:grid-cols-1">
              <Field label="Billing address">
                <p className="text-muted-foreground font-normal whitespace-pre-wrap">
                  {po.billing_address ?? "—"}
                </p>
              </Field>
            </CardContent>
            {po.remarks ? (
              <CardContent className="border-t pt-4">
                <Field label="Remarks">
                  <p className="text-muted-foreground font-normal whitespace-pre-wrap">
                    {po.remarks}
                  </p>
                </Field>
              </CardContent>
            ) : null}
          </Card>

          {analyticsEntries.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Analytics</CardTitle>
                <CardDescription>From eAutomate analytics_object</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                  {analyticsEntries.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2 border-b border-dashed py-1">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="font-mono text-xs">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Original PO files (eAutomate)</CardTitle>
              {!data?.eautomateDownloadConfigured ? (
                <CardDescription>
                  Set <code className="text-xs">EAUTOMATE_OUTBOUND_PO_FILE_URL_PATH</code> on the
                  server (placeholders {"{"}fileId{"}"}, {"{"}poNumber{"}"}) to enable download
                  proxy.
                </CardDescription>
              ) : null}
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="px-3 py-2 font-semibold">File ID</th>
                      <th className="px-3 py-2 font-semibold">Uploaded at</th>
                      <th className="px-3 py-2 font-semibold">Uploaded by</th>
                      <th className="px-3 py-2 font-semibold">File name</th>
                      <th className="px-3 py-2 font-semibold">Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.eautomateFiles.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-muted-foreground px-3 py-4 text-center">
                          No files synced yet (open page again after eAutomate sync).
                        </td>
                      </tr>
                    ) : (
                      data.eautomateFiles.map((f) => (
                        <tr key={f.eautomate_file_id} className="border-b">
                          <td className="px-3 py-2 tabular-nums">{f.eautomate_file_id}</td>
                          <td className="px-3 py-2">{fmtDateTime(f.created_at)}</td>
                          <td className="px-3 py-2">{f.file_uploaded_by ?? "—"}</td>
                          <td className="max-w-[240px] truncate px-3 py-2" title={f.file_name}>
                            {f.file_name}
                          </td>
                          <td className="px-3 py-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-primary h-8 w-8"
                              disabled={
                                !data.eautomateDownloadConfigured ||
                                dlBusy === `ea-${f.eautomate_file_id}`
                              }
                              aria-label={`Download ${f.file_name}`}
                              onClick={() => void onDownloadEa(f.eautomate_file_id, f.file_name)}
                            >
                              {dlBusy === `ea-${f.eautomate_file_id}` ? (
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

          {data.zapAttachments.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Files uploaded in Zap</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="px-3 py-2 font-semibold">ID</th>
                        <th className="px-3 py-2 font-semibold">Uploaded at</th>
                        <th className="px-3 py-2 font-semibold">File name</th>
                        <th className="px-3 py-2 font-semibold">Kind</th>
                        <th className="px-3 py-2 font-semibold">Download</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.zapAttachments.map((a) => (
                        <tr key={a.id} className="border-b">
                          <td className="px-3 py-2 tabular-nums">{a.id}</td>
                          <td className="px-3 py-2">{fmtDateTime(a.created_at)}</td>
                          <td className="max-w-[240px] truncate px-3 py-2">{a.original_filename}</td>
                          <td className="px-3 py-2">{a.kind}</td>
                          <td className="px-3 py-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-primary h-8 w-8"
                              disabled={dlBusy === `zap-${a.id}`}
                              aria-label={`Download ${a.original_filename}`}
                              onClick={() => void onDownloadZap(a.id, a.original_filename)}
                            >
                              {dlBusy === `zap-${a.id}` ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Download className="size-4" />
                              )}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {canMutate ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Upload received PO</CardTitle>
                <CardDescription>
                  PDF or spreadsheet/CSV, max 2MB.{" "}
                  <Link
                    href="/samples/outbound/sample_po_line_items_spreadsheet.csv"
                    className="text-primary font-medium underline-offset-2 hover:underline"
                    download
                  >
                    Download sample file
                  </Link>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3">
                <div className="space-y-2">
                  <Label htmlFor="po-upload">Choose file</Label>
                  <Input
                    id="po-upload"
                    type="file"
                    accept=".pdf,.csv,.xlsx,.xls"
                    className="max-w-xs cursor-pointer"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setFile(f);
                    }}
                  />
                </div>
                <Button
                  type="button"
                  disabled={!file || uploading}
                  onClick={() => void onUpload()}
                >
                  {uploading ? "Uploading…" : "Upload"}
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="order-1 min-w-0 lg:order-2 lg:sticky lg:top-4 lg:self-start">
          <Card className="border-primary/20 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0 sm:p-6 sm:pt-0">
              {canMutate && isPartial ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleting}
                  onClick={() => void onDelete()}
                  className="box-border flex h-auto min-h-10 w-full min-w-0 max-w-full shrink flex-col gap-2 py-3 whitespace-normal text-center text-sm leading-snug sm:flex-row sm:items-center sm:justify-center sm:gap-2 sm:py-2.5"
                >
                  {deleting ? (
                    <Loader2 className="size-4 shrink-0 animate-spin" />
                  ) : (
                    <Trash2 className="size-4 shrink-0" />
                  )}
                  <span className="max-w-full text-pretty">
                    Delete this partial purchase order
                  </span>
                </Button>
              ) : (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {isPartial
                    ? "You need create permission on purchase orders to delete."
                    : "Delete is only available for partially created (PARTIAL) POs."}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
