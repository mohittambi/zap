"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  sumPackedQty,
  validateConsignmentSkuPackingClient,
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

function withSequentialBoxNumbers(
  boxes: ConsignmentSkuPacking["boxes"]
): ConsignmentSkuPacking["boxes"] {
  return boxes.map((b, i) => ({ ...b, box_number: i + 1 }));
}

/** Remaining pending for one box line (excludes that line’s current qty). */
function suggestedQtyForBox(sku: ConsignmentSkuPacking, boxIdx: number): number {
  const packedElsewhere = sku.boxes.reduce(
    (sum, b, i) => (i === boxIdx ? sum : sum + (Number.isFinite(b.box_quantity) ? b.box_quantity : 0)),
    0
  );
  return Math.max(0, sku.pending_quantity - packedElsewhere);
}

function defaultBoxQuantity(sku: ConsignmentSkuPacking, boxes: ConsignmentSkuPacking["boxes"]): number {
  const remaining = Math.max(0, sku.pending_quantity - sumPackedQty({ ...sku, boxes }));
  return remaining > 0 ? remaining : 1;
}

export function ConsignmentSkuPackingModal({
  open,
  onOpenChange,
  sku,
  validBins,
  validBinSet,
  onSave,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sku: ConsignmentSkuPacking | null;
  validBins: { key: string; label: string }[];
  validBinSet: Set<string>;
  onSave: (updated: ConsignmentSkuPacking) => void;
}>) {
  const [draft, setDraft] = React.useState<ConsignmentSkuPacking | null>(null);
  const [errors, setErrors] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (open && sku) {
      const boxes = withSequentialBoxNumbers(
        sku.boxes.length
          ? sku.boxes.map((b) => ({ ...b }))
          : [
              {
                box_number: 1,
                box_quantity: Math.max(1, sku.pending_quantity),
                box_name: "",
              },
            ]
      );
      setDraft({ ...sku, boxes });
      setErrors([]);
    }
  }, [open, sku]);

  if (!draft) return null;

  function updateBox(boxIdx: number, patch: Partial<ConsignmentSkuPacking["boxes"][number]>) {
    setDraft((prev) => {
      if (!prev) return prev;
      const boxes = [...prev.boxes];
      boxes[boxIdx] = { ...boxes[boxIdx], ...patch };
      return { ...prev, boxes };
    });
  }

  function addBox() {
    setDraft((prev) => {
      if (!prev) return prev;
      const qty = defaultBoxQuantity(prev, prev.boxes);
      return {
        ...prev,
        boxes: withSequentialBoxNumbers([
          ...prev.boxes,
          { box_number: 0, box_quantity: qty, box_name: "" },
        ]),
      };
    });
  }

  function removeBox(boxIdx: number) {
    if (boxIdx === 0) return;
    setDraft((prev) => {
      if (!prev || prev.boxes.length <= 1) return prev;
      return {
        ...prev,
        boxes: withSequentialBoxNumbers(prev.boxes.filter((_, i) => i !== boxIdx)),
      };
    });
  }

  function handleSave() {
    if (!draft) return;
    const normalized = { ...draft, boxes: withSequentialBoxNumbers(draft.boxes) };
    const result = validateConsignmentSkuPackingClient([normalized], validBinSet);
    if (!result.ok) {
      setErrors(result.errors.map((e) => e.message));
      return;
    }
    onSave(normalized);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[min(98vw,32rem)] max-w-[min(98vw,32rem)] flex-col gap-0 p-0 sm:max-w-[min(98vw,32rem)]">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle className="text-base">
            Packing — {draft.po_secondary_sku || "—"}
            {draft.company_code_primary ? ` · ${draft.company_code_primary}` : ""}
          </DialogTitle>
          <DialogDescription className="text-sm">
            Pending quantity: {draft.pending_quantity}. Add extra box lines below; the first
            row cannot be removed.
          </DialogDescription>
        </DialogHeader>

        {errors.length > 0 ? (
          <ul className="text-destructive shrink-0 space-y-1 border-b px-6 py-2 text-xs">
            {errors.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-muted/60 border-b">
                  <th className="w-36 px-2 py-2 font-semibold whitespace-nowrap">Box name</th>
                  <th className="w-24 px-2 py-2 font-semibold whitespace-nowrap text-right">Qty</th>
                  <th className="w-32 px-2 py-2 font-semibold whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {draft.boxes.map((box, boxIdx) => {
                  const prefillQty = suggestedQtyForBox(draft, boxIdx);
                  const isParentRow = boxIdx === 0;
                  return (
                    <tr key={`box-${boxIdx}`}>
                      <td className="px-2 py-1 align-top">
                        <SearchableSelect
                          value={box.box_name || null}
                          onChange={(key) => updateBox(boxIdx, { box_name: key ?? "" })}
                          options={validBins}
                          placeholder="Box name"
                          emptyText="No valid box names"
                          variant="soft"
                          size="sm"
                          className="max-w-[9rem]"
                        />
                      </td>
                      <td className="px-2 py-1 text-right align-top">
                        <Input
                          value={String(box.box_quantity)}
                          onChange={(e) =>
                            updateBox(boxIdx, {
                              box_quantity:
                                e.target.value === "" ? 0 : Math.trunc(Number(e.target.value)),
                            })
                          }
                          placeholder={String(prefillQty)}
                          className="ml-auto h-8 w-20 font-mono text-xs tabular-nums"
                        />
                      </td>
                      <td className="px-2 py-1 align-top">
                        <div className="flex flex-wrap items-center gap-1">
                          {isParentRow ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={addBox}
                            >
                              <Plus className="mr-0.5 size-3" />
                              Add box
                            </Button>
                          ) : null}
                          {!isParentRow ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7 shrink-0"
                              onClick={() => removeBox(boxIdx)}
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
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save packing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
