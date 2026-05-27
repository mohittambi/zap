"use client";

import * as React from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import {
  buildConsignmentLineSampleCsv,
  parseConsignmentLineCsvToSkus,
  sumPackedQty,
  validateConsignmentSkuPackingClient,
  type ConsignmentSkuPacking,
} from "@/lib/outbound-consignment-line-drafts";
import { cn } from "@/lib/utils";
import { fetchOutboundValidBins } from "@/lib/outbound-valid-bins";
import { ConsignmentLineItemsBulkForm } from "@/components/outbound/consignment-line-items-bulk-form";
import { ConsignmentSkuPackingModal } from "@/components/outbound/consignment-sku-packing-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type DraftsPayload = {
  source: "saved" | "draft";
  skus: ConsignmentSkuPacking[];
  outboundPoId: number | null;
  poNumber: string | null;
};

export function ConsignmentLineItemsEditor({
  consignmentId,
  poNumber,
  readOnly = false,
  onSaved,
}: Readonly<{
  consignmentId: number;
  poNumber: string;
  readOnly?: boolean;
  onSaved?: () => void;
}>) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [skus, setSkus] = React.useState<ConsignmentSkuPacking[]>([]);
  const [source, setSource] = React.useState<"saved" | "draft">("draft");
  const [validBins, setValidBins] = React.useState<{ key: string; label: string }[]>([]);
  const [packingSkuIdx, setPackingSkuIdx] = React.useState<number | null>(null);

  const validBinSet = React.useMemo(
    () => new Set(validBins.map((b) => b.label.trim().toLowerCase())),
    [validBins]
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [drafts, bins] = await Promise.all([
        apiFetch<DraftsPayload>(
          `/api/outbound/consignments/${consignmentId}/line-items/drafts`
        ),
        fetchOutboundValidBins(),
      ]);
      setSkus(drafts.skus);
      setSource(drafts.source);
      setValidBins(bins.map((b) => ({ key: b.name, label: b.name })));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load line items");
      setSkus([]);
    } finally {
      setLoading(false);
    }
  }, [consignmentId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function updateSku(idx: number, updated: ConsignmentSkuPacking) {
    setSkus((prev) => {
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
  }

  const sampleCsvFilename = React.useMemo(() => {
    const safePo = poNumber.replace(/[^\w.-]+/g, "_") || String(consignmentId);
    return `consignment_lines_PO-${safePo}.csv`;
  }, [consignmentId, poNumber]);

  const sampleCsvHref = React.useMemo(() => {
    if (readOnly || skus.length === 0) return null;
    const csv = buildConsignmentLineSampleCsv(skus);
    return URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  }, [readOnly, skus]);

  React.useEffect(() => {
    return () => {
      if (sampleCsvHref) URL.revokeObjectURL(sampleCsvHref);
    };
  }, [sampleCsvHref]);

  async function uploadFile(file: File) {
    if (readOnly) return;
    const text = await file.text();
    const parsed = parseConsignmentLineCsvToSkus(text, skus);
    if (parsed.errors.length > 0) {
      toast.error(parsed.errors[0]);
      return;
    }
    setSkus(parsed.skus);
    const rowCount = parsed.skus.reduce((n, s) => n + s.boxes.length, 0);
    toast.success(`Loaded packing for ${parsed.skus.length} SKU(s) (${rowCount} box line(s))`);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function saveLines() {
    if (readOnly) return;
    const validation = validateConsignmentSkuPackingClient(skus, validBinSet);
    if (!validation.ok) {
      const first = validation.errors[0];
      const row = skus[first.skuIndex];
      const skuLabel =
        row?.po_secondary_sku && row?.company_code_primary
          ? `${row.po_secondary_sku} / ${row.company_code_primary}`
          : row?.po_secondary_sku || row?.company_code_primary || `#${first.skuIndex + 1}`;
      toast.error(`${skuLabel}: ${first.message}`);
      return;
    }
    if (validation.warnings.length > 0) {
      toast.warning(validation.warnings[0]?.message ?? "Some SKUs are under-packed");
    }
    setBusy(true);
    try {
      await apiFetch(`/api/outbound/consignments/${consignmentId}/line-items/save`, {
        method: "POST",
        body: JSON.stringify({ skus }),
      });
      toast.success("Consignment lines saved");
      setSource("saved");
      onSaved?.();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const packingSku = packingSkuIdx != null ? skus[packingSkuIdx] ?? null : null;

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Consignment line items</CardTitle>
          <CardDescription className="text-xs">
            {readOnly
              ? "Consignment is marked for dispatch. Saved line items cannot be edited."
              : source === "saved"
                ? "Saved packing for this consignment. Edit per SKU and save to update the summary."
                : "Prefilled from PO line items. Enter packing per SKU (multiple boxes allowed), then save."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadFile(f);
              }}
            />
            {!readOnly ? (
              <a
                href={sampleCsvHref ?? undefined}
                download={sampleCsvFilename}
                className={cn(
                  "text-xs underline-offset-2 hover:underline",
                  skus.length > 0 && sampleCsvHref
                    ? "text-primary"
                    : "text-muted-foreground pointer-events-none"
                )}
                aria-disabled={skus.length === 0}
              >
                Download sample CSV
              </a>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={readOnly || busy}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mr-1 size-3.5" />
              Upload CSV
            </Button>
            {!readOnly && !loading && skus.length > 0 ? (
              <ConsignmentLineItemsBulkForm
                skus={skus}
                validBins={validBins}
                validBinSet={validBinSet}
                disabled={busy}
                saving={busy}
                onApply={setSkus}
                onSave={saveLines}
              />
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={readOnly || busy || skus.length === 0}
              onClick={() => void saveLines()}
            >
              {busy ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
              Save lines
            </Button>
          </div>

          {loading ? (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Loading line items…
            </p>
          ) : skus.length === 0 ? (
            <p className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
              No PO line items found. Sync or upload PO listings first.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-muted/60 border-b">
                    <th className="px-2 py-2 font-semibold whitespace-nowrap">PO Secondary SKU</th>
                    <th className="px-2 py-2 font-semibold whitespace-nowrap">Company Code Primary</th>
                    <th className="px-2 py-2 font-semibold whitespace-nowrap text-right">demand</th>
                    <th className="px-2 py-2 font-semibold whitespace-nowrap text-right">dispatched</th>
                    <th className="px-2 py-2 font-semibold whitespace-nowrap text-right">reserved</th>
                    <th className="px-2 py-2 font-semibold whitespace-nowrap text-right">pending</th>
                    <th className="px-2 py-2 font-semibold whitespace-nowrap text-right">packed qty</th>
                    <th className="px-2 py-2 font-semibold whitespace-nowrap text-right">boxes</th>
                    <th className="px-2 py-2 font-semibold whitespace-nowrap">action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {skus.map((sku, idx) => (
                    <tr key={`${sku.po_secondary_sku}-${sku.company_code_primary}-${idx}`}>
                      <td className="px-2 py-2 font-mono">{sku.po_secondary_sku || "—"}</td>
                      <td className="px-2 py-2 font-mono">{sku.company_code_primary || "—"}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">{sku.demand_quantity}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">{sku.dispatched_quantity}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">{sku.reserved_quantity}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">{sku.pending_quantity}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">{sumPackedQty(sku)}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">{sku.boxes.length}</td>
                      <td className="px-2 py-2">
                        {readOnly ? (
                          <span className="text-muted-foreground text-xs">Locked</span>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setPackingSkuIdx(idx)}
                          >
                            Enter packing
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConsignmentSkuPackingModal
        open={packingSkuIdx != null}
        onOpenChange={(open) => {
          if (!open) setPackingSkuIdx(null);
        }}
        sku={packingSku}
        validBins={validBins}
        validBinSet={validBinSet}
        onSave={(updated) => {
          if (packingSkuIdx != null) updateSku(packingSkuIdx, updated);
        }}
      />
    </>
  );
}
