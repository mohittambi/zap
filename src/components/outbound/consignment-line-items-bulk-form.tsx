"use client";

import * as React from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  applyBulkFormRowsToSkus,
  getMaxBoxNumber,
  skusToBulkFormRows,
  validateConsignmentSkuPackingClient,
  type ConsignmentBulkSkuRow,
  type ConsignmentSkuPacking,
} from "@/lib/outbound-consignment-line-drafts";
import { SearchableSelect } from "@/components/outbound/searchable-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function ConsignmentLineItemsBulkForm({
  skus,
  activeBoxNumber,
  hasOpenBox = true,
  validBins,
  validBinSet,
  disabled = false,
  onApply,
  onSave,
  saving = false,
}: Readonly<{
  skus: ConsignmentSkuPacking[];
  activeBoxNumber: number;
  hasOpenBox?: boolean;
  validBins: { key: string; label: string }[];
  validBinSet: Set<string>;
  disabled?: boolean;
  onApply: (skus: ConsignmentSkuPacking[]) => void;
  onSave: (skus: ConsignmentSkuPacking[]) => void | Promise<void>;
  saving?: boolean;
}>) {
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<ConsignmentBulkSkuRow[]>([]);
  const nextRowId = React.useRef(0);

  const binOptions = React.useMemo(
    () => validBins.map((b) => ({ key: b.key, label: b.label })),
    [validBins]
  );

  React.useEffect(() => {
    if (open) {
      setRows(skusToBulkFormRows(skus, { defaultBoxNumber: activeBoxNumber }));
      nextRowId.current = skus.length * 10;
    }
  }, [open, skus, activeBoxNumber]);

  function nextBulkBoxNumber(): number {
    let max = Math.max(getMaxBoxNumber(skus), activeBoxNumber);
    for (const r of rows) {
      const n = Math.trunc(Number(r.box_number));
      if (Number.isFinite(n) && n > max) max = n;
    }
    return max + 1;
  }

  function newRowId(): string {
    nextRowId.current += 1;
    return `bulk-${nextRowId.current}`;
  }

  function validateAndCommit(
    onSuccess: (next: ConsignmentSkuPacking[]) => void
  ): boolean {
    const { skus: parsed, errors: parseErrors } = applyBulkFormRowsToSkus(rows, skus, {
      activeBoxNumber,
    });
    if (parseErrors.length > 0) {
      toast.error(parseErrors[0]);
      return false;
    }
    const validation = validateConsignmentSkuPackingClient(parsed, validBinSet);
    if (!validation.ok) {
      const first = validation.errors[0];
      const row = parsed[first.skuIndex];
      const skuLabel =
        row?.po_secondary_sku && row?.company_code_primary
          ? `${row.po_secondary_sku} / ${row.company_code_primary}`
          : row?.po_secondary_sku || `#${first.skuIndex + 1}`;
      toast.error(`${skuLabel}: ${first.message}`);
      return false;
    }
    if (validation.warnings.length > 0) {
      toast.warning(validation.warnings[0]?.message ?? "Some SKUs are under-packed");
    }
    onSuccess(parsed);
    return true;
  }

  function applyAndClose() {
    if (!validateAndCommit((next) => {
      onApply(next);
      toast.success("Bulk form applied");
      setOpen(false);
    })) {
      return;
    }
  }

  async function saveFromBulk() {
    let parsedSkus: ConsignmentSkuPacking[] | null = null;
    if (
      !validateAndCommit((next) => {
        parsedSkus = next;
        onApply(next);
      })
    ) {
      return;
    }
    if (!parsedSkus) return;
    await onSave(parsedSkus);
    setOpen(false);
  }

  function updateRow(idx: number, patch: Partial<ConsignmentBulkSkuRow>) {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx]!, ...patch };
      return next;
    });
  }

  function addBoxRowForSku(poSecondarySku: string) {
    const anchor = rows.find((r) => r.po_secondary_sku === poSecondarySku);
    if (!anchor) return;
    let insertAfter = -1;
    rows.forEach((r, i) => {
      if (r.po_secondary_sku === poSecondarySku) insertAfter = i;
    });
    const insert: ConsignmentBulkSkuRow = {
      id: newRowId(),
      po_secondary_sku: anchor.po_secondary_sku,
      company_code_primary: anchor.company_code_primary,
      box_number: String(nextBulkBoxNumber()),
      box_name: "",
      box_quantity: "",
      removable: true,
    };
    setRows((prev) => [
      ...prev.slice(0, insertAfter + 1),
      insert,
      ...prev.slice(insertAfter + 1),
    ]);
  }

  function removeRow(idx: number) {
    const row = rows[idx];
    if (!row?.removable) return;
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function showSkuCells(row: ConsignmentBulkSkuRow, idx: number): boolean {
    if (idx === 0) return true;
    return rows[idx - 1]?.po_secondary_sku !== row.po_secondary_sku;
  }

  if (skus.length === 0) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => {
          if (!hasOpenBox) {
            toast.error("Click Add box before using the bulk form");
            return;
          }
          setOpen(true);
        }}
      >
        Bulk form
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90vh] w-[min(98vw,56rem)] max-w-[min(98vw,56rem)] flex-col gap-0 p-0 sm:max-w-[min(98vw,56rem)]">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle className="text-base">Bulk packing form</DialogTitle>
            <DialogDescription className="text-sm">
              Same columns as Upload CSV: box_number, box_quantity, box_name. Empty box # defaults
              to open box #{activeBoxNumber} on the first line per SKU. Packed total per SKU cannot
              exceed pending quantity.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-muted/60 border-b">
                    <th className="px-2 py-2 font-semibold whitespace-nowrap">PO Secondary SKU</th>
                    <th className="px-2 py-2 font-semibold whitespace-nowrap">Company Code Primary</th>
                    <th className="w-20 px-2 py-2 font-semibold whitespace-nowrap text-right">
                      Box #
                    </th>
                    <th className="w-36 px-2 py-2 font-semibold whitespace-nowrap">box name</th>
                    <th className="w-24 px-2 py-2 font-semibold whitespace-nowrap text-right">
                      box quantity
                    </th>
                    <th className="w-32 px-2 py-2 font-semibold whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row, idx) => {
                    const showSku = showSkuCells(row, idx);
                    return (
                      <tr key={row.id}>
                        <td className="px-2 py-1.5 font-mono align-top">
                          {showSku ? row.po_secondary_sku || "—" : ""}
                        </td>
                        <td className="px-2 py-1.5 font-mono align-top">
                          {showSku ? row.company_code_primary || "—" : ""}
                        </td>
                        <td className="px-2 py-1 text-right align-top">
                          <Input
                            value={row.box_number}
                            onChange={(e) => updateRow(idx, { box_number: e.target.value })}
                            placeholder={String(activeBoxNumber)}
                            className="ml-auto h-8 w-16 font-mono text-xs tabular-nums"
                            disabled={disabled}
                          />
                        </td>
                        <td className="px-2 py-1 align-top">
                          <SearchableSelect
                            value={row.box_name || null}
                            onChange={(key) => updateRow(idx, { box_name: key ?? "" })}
                            options={binOptions}
                            placeholder="box name"
                            emptyText="No valid box types"
                            variant="soft"
                            size="sm"
                            className="max-w-[9rem]"
                          />
                        </td>
                        <td className="px-2 py-1 text-right align-top">
                          <Input
                            value={row.box_quantity}
                            onChange={(e) => updateRow(idx, { box_quantity: e.target.value })}
                            placeholder="box quantity"
                            className="ml-auto h-8 w-20 font-mono text-xs tabular-nums"
                            disabled={disabled}
                          />
                        </td>
                        <td className="px-2 py-1 align-top">
                          <div className="flex flex-wrap items-center gap-1">
                            {showSku ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                disabled={disabled}
                                onClick={() => addBoxRowForSku(row.po_secondary_sku)}
                              >
                                <Plus className="mr-0.5 size-3" />
                                Add box
                              </Button>
                            ) : null}
                            {row.removable ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-7 shrink-0"
                                disabled={disabled}
                                onClick={() => removeRow(idx)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="secondary" disabled={disabled} onClick={applyAndClose}>
              Apply to table
            </Button>
            <Button type="button" disabled={disabled || saving} onClick={() => void saveFromBulk()}>
              {saving ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
              Save lines
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
