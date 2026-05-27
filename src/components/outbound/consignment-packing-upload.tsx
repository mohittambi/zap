"use client";

import * as React from "react";
import { Download, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, apiUrl, getStoredToken } from "@/lib/api-browser";
import {
  buildConsignmentPackingSampleCsv,
  downloadConsignmentPackingSampleCsv,
  extractPoPackingSkusFromListings,
} from "@/lib/outbound-po-packing-skus";
import { fetchOutboundValidBins, type OutboundValidBin } from "@/lib/outbound-valid-bins";
import type { OutboundListingsEnvelope } from "@/app/(app)/(logistics)/outbound/outbound-po-detail-line-items-table";
import { SearchableSelect } from "@/components/outbound/searchable-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ParsedConsignmentPackingRow } from "@/server/utils/outboundConsignmentPackingSpreadsheetParse";

type PreviewRow = {
  rowNumber: number;
  binNumber: number;
  binName: string;
  itemCode: string;
  quantity: number;
  companyCodePrimary: string | null;
  companyCodeSecondary: string | null;
  status: "ok" | "error" | "warning";
  issues: string[];
};

type PreviewPayload = {
  ok: boolean;
  rowsPreview: PreviewRow[];
  binSummary: { binNumber: number; binName: string; lineCount: number; totalQuantity: number }[];
  errors: { row: number; field: string; message: string }[];
  warnings: { row: number; field: string; message: string }[];
  stats: { totalRows: number; binCount: number; existingLineCount: number };
  rows: ParsedConsignmentPackingRow[];
};

type ManualSkuRow = { itemCode: string; quantity: string };

function initialManualSkusFromPo(
  poSkus: ReturnType<typeof extractPoPackingSkusFromListings>
): ManualSkuRow[] {
  if (poSkus.length === 0) return [{ itemCode: "", quantity: "" }];
  return poSkus.map((s) => ({ itemCode: s.itemCode, quantity: "" }));
}

export function ConsignmentPackingUpload({
  consignmentId,
  poNumber,
  listings,
  disabled = false,
  compact = false,
  onApplied,
}: Readonly<{
  consignmentId: number;
  poNumber: string;
  listings?: OutboundListingsEnvelope | Record<string, unknown>;
  disabled?: boolean;
  compact?: boolean;
  onApplied?: () => void;
}>) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [confirmReplaceOpen, setConfirmReplaceOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<PreviewPayload | null>(null);
  const [mode, setMode] = React.useState<"append" | "replace">("append");
  const [validBins, setValidBins] = React.useState<OutboundValidBin[]>([]);
  const [manualBinName, setManualBinName] = React.useState<string | null>(null);
  const [manualBinNumber, setManualBinNumber] = React.useState("");
  const [manualSkus, setManualSkus] = React.useState<ManualSkuRow[]>([
    { itemCode: "", quantity: "" },
  ]);

  const poSkus = React.useMemo(
    () => (listings != null ? extractPoPackingSkusFromListings(listings) : []),
    [listings]
  );

  const itemCodeOptions = React.useMemo(
    () => poSkus.map((s) => ({ key: s.itemCode, label: s.itemCode })),
    [poSkus]
  );

  React.useEffect(() => {
    setManualSkus(initialManualSkusFromPo(poSkus));
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchOutboundValidBins();
        if (!cancelled) setValidBins(rows);
      } catch {
        if (!cancelled) setValidBins([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [consignmentId, poSkus]);

  function downloadSampleCsv() {
    if (poSkus.length === 0) return;
    const csv = buildConsignmentPackingSampleCsv({
      skus: poSkus,
      defaultBinName: manualBinName ?? validBins[0]?.name,
      defaultBinNumber: Number(manualBinNumber) > 0 ? Number(manualBinNumber) : 1,
    });
    const safePo = poNumber.replace(/[^\w.-]+/g, "_") || String(consignmentId);
    downloadConsignmentPackingSampleCsv(`consignment_packing_PO-${safePo}.csv`, csv);
  }

  async function previewFile(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const token = getStoredToken();
      const headers = new Headers();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const res = await fetch(
        apiUrl(`/api/outbound/consignments/${consignmentId}/packing-upload/preview`),
        { method: "POST", headers, body: fd }
      );
      const json = (await res.json()) as PreviewPayload & { error?: string };
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setPreview(json);
      setMode("append");
      setPreviewOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function previewManualRows() {
    void (async () => {
      const binNumber = Number(manualBinNumber);
      const binName = manualBinName?.trim() ?? "";
      const rows = manualSkus
        .map((sku, idx) => ({
          rowNumber: idx + 2,
          box_number: Math.trunc(binNumber),
          box_name: binName,
          po_secondary_sku: sku.itemCode.trim(),
          quantity: Math.trunc(Number(sku.quantity)),
        }))
        .filter((row) => row.po_secondary_sku || row.quantity > 0 || row.box_name || row.box_number > 0);

      setBusy(true);
      try {
        const json = await apiFetch<PreviewPayload>(
          `/api/outbound/consignments/${consignmentId}/packing-upload/preview`,
          {
            method: "POST",
            body: JSON.stringify({ rows }),
          }
        );
        setPreview(json);
        setMode("append");
        setPreviewOpen(true);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Preview failed");
      } finally {
        setBusy(false);
      }
    })();
  }

  async function applyUpload() {
    if (!preview?.ok || preview.rows.length === 0) return;
    if (mode === "replace") {
      setConfirmReplaceOpen(true);
      return;
    }
    await runApply();
  }

  async function runApply() {
    if (!preview?.rows.length) return;
    setBusy(true);
    try {
      const result = await apiFetch<{
        inserted: number;
        deleted: number;
        binsAffected: number;
        mode: string;
      }>(`/api/outbound/consignments/${consignmentId}/packing-upload/apply`, {
        method: "POST",
        body: JSON.stringify({ mode, rows: preview.rows }),
      });
      toast.success(
        mode === "replace"
          ? `Replaced consignment packing (${result.inserted} lines across ${result.binsAffected} bins)`
          : `Added ${result.inserted} bin packing lines across ${result.binsAffected} bins`
      );
      setPreviewOpen(false);
      setConfirmReplaceOpen(false);
      setPreview(null);
      onApplied?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Apply failed");
    } finally {
      setBusy(false);
    }
  }

  const binOptions = validBins.map((b) => ({ key: b.name, label: b.name }));

  const content = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          disabled={disabled || busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void previewFile(f);
          }}
        />
        <Button
          type="button"
          variant={compact ? "outline" : "default"}
          size={compact ? "sm" : "default"}
          disabled={disabled || busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Upload className="mr-2 size-4" />
          )}
          Upload bin packing CSV/XLSX
        </Button>
        {listings != null ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-primary h-auto px-2 text-xs"
            disabled={poSkus.length === 0}
            onClick={downloadSampleCsv}
          >
            <Download className="mr-1 size-3.5" />
            Download sample CSV for this PO
          </Button>
        ) : (
          <a
            href="/samples/outbound/sample_consignment_packing.csv"
            download
            className="text-primary text-xs underline-offset-2 hover:underline"
          >
            Download sample CSV
          </a>
        )}
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">
        Required columns: Bin Number, Bin Name, Item Code, Quantity. Max 2MB. Bin
        names must match synced system bins for PO {poNumber}.
        {listings != null && poSkus.length === 0 ? (
          <span className="text-amber-700 dark:text-amber-400">
            {" "}
            Sync or upload PO line items to pre-fill item codes.
          </span>
        ) : null}
        {poSkus.length > 0 ? (
          <span> Manual form includes {poSkus.length} item code(s) from this PO.</span>
        ) : null}
      </p>

      <div className="rounded-md border p-3 space-y-3">
        <p className="text-xs font-medium">Manual bin entry</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Valid bin</Label>
            <SearchableSelect
              value={manualBinName}
              onChange={setManualBinName}
              options={binOptions}
              placeholder="Select bin name"
              emptyText="No bins synced"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bin Number</Label>
            <Input
              value={manualBinNumber}
              onChange={(e) => setManualBinNumber(e.target.value)}
              placeholder="1"
              className="h-9"
            />
          </div>
        </div>
        <div className="space-y-2">
          {manualSkus.map((row, idx) => (
            <div key={`sku-${row.itemCode || "empty"}-${idx}`} className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
              {itemCodeOptions.length > 0 ? (
                <SearchableSelect
                  value={row.itemCode || null}
                  onChange={(key) => {
                    const next = [...manualSkus];
                    next[idx] = { ...next[idx], itemCode: key ?? "" };
                    setManualSkus(next);
                  }}
                  options={itemCodeOptions}
                  placeholder="Item code"
                  emptyText="No PO line items"
                />
              ) : (
                <Input
                  value={row.itemCode}
                  onChange={(e) => {
                    const next = [...manualSkus];
                    next[idx] = { ...next[idx], itemCode: e.target.value };
                    setManualSkus(next);
                  }}
                  placeholder="Item Code"
                  className="h-9 font-mono text-xs"
                />
              )}
              <Input
                value={row.quantity}
                onChange={(e) => {
                  const next = [...manualSkus];
                  next[idx] = { ...next[idx], quantity: e.target.value };
                  setManualSkus(next);
                }}
                placeholder="Qty"
                className="h-9 tabular-nums"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={manualSkus.length <= 1}
                onClick={() => setManualSkus(manualSkus.filter((_, i) => i !== idx))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setManualSkus([...manualSkus, { itemCode: "", quantity: "" }])}
          >
            <Plus className="mr-1 size-4" />
            Add SKU row
          </Button>
        </div>
        <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={previewManualRows}>
          Preview manual rows
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {compact ? content : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Bin packing</CardTitle>
            <CardDescription className="text-xs">
              Upload or enter bin packing lines for consignment #{consignmentId}.
            </CardDescription>
          </CardHeader>
          <CardContent>{content}</CardContent>
        </Card>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-3xl" showCloseButton>
          <DialogHeader>
            <DialogTitle>Review bin packing upload</DialogTitle>
            <DialogDescription>
              Consignment #{consignmentId} · PO {poNumber}
            </DialogDescription>
          </DialogHeader>

          {preview ? (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{preview.stats.totalRows} rows</Badge>
                <Badge variant="outline">{preview.stats.binCount} bins</Badge>
                {preview.stats.existingLineCount > 0 ? (
                  <Badge variant="secondary">
                    {preview.stats.existingLineCount} existing lines
                  </Badge>
                ) : null}
                {preview.errors.length > 0 ? (
                  <Badge variant="destructive">{preview.errors.length} errors</Badge>
                ) : null}
                {preview.warnings.length > 0 ? (
                  <Badge variant="secondary">{preview.warnings.length} warnings</Badge>
                ) : null}
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="px-2 py-2">Row</th>
                      <th className="px-2 py-2">Bin #</th>
                      <th className="px-2 py-2">Bin Name</th>
                      <th className="px-2 py-2">Item Code</th>
                      <th className="px-2 py-2 text-right">Qty</th>
                      <th className="px-2 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rowsPreview.map((row) => (
                      <tr key={row.rowNumber} className="border-b align-top">
                        <td className="px-2 py-2 tabular-nums">{row.rowNumber}</td>
                        <td className="px-2 py-2 tabular-nums">{row.binNumber}</td>
                        <td className="px-2 py-2">{row.binName}</td>
                        <td className="px-2 py-2 font-mono">{row.itemCode}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{row.quantity}</td>
                        <td className="px-2 py-2">
                          <Badge
                            variant={
                              row.status === "error"
                                ? "destructive"
                                : row.status === "warning"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="font-normal"
                          >
                            {row.status}
                          </Badge>
                          {row.issues.length > 0 ? (
                            <ul className="text-muted-foreground mt-1 list-disc pl-4">
                              {row.issues.map((issue) => (
                                <li key={issue}>{issue}</li>
                              ))}
                            </ul>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium">Apply mode</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={mode === "append" ? "default" : "outline"}
                    onClick={() => setMode("append")}
                  >
                    Append lines
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={mode === "replace" ? "destructive" : "outline"}
                    onClick={() => setMode("replace")}
                  >
                    Replace all lines
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  {mode === "append"
                    ? "Append adds new bin packing lines without removing existing ones."
                    : "Replace deletes all existing consignment packing lines and replaces them with this upload."}
                </p>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPreviewOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!preview?.ok || busy}
              variant={mode === "replace" ? "destructive" : "default"}
              onClick={() => void applyUpload()}
            >
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {mode === "replace" ? "Continue to replace…" : "Apply upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmReplaceOpen} onOpenChange={setConfirmReplaceOpen}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Replace all bin packing lines?</DialogTitle>
            <DialogDescription>
              This will delete {preview?.stats.existingLineCount ?? 0} existing line(s) on
              consignment #{consignmentId} and replace them with {preview?.stats.totalRows ?? 0}{" "}
              row(s) across {preview?.stats.binCount ?? 0} bin(s). This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmReplaceOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void runApply()}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Replace all lines
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
