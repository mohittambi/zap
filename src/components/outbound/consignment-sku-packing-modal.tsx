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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Packing — {draft.po_secondary_sku || "—"}
            {draft.company_code_primary ? ` · ${draft.company_code_primary}` : ""}
          </DialogTitle>
          <DialogDescription>Pending quantity: {draft.pending_quantity}</DialogDescription>
        </DialogHeader>

        {errors.length > 0 ? (
          <ul className="text-destructive space-y-1 text-xs">
            {errors.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        ) : null}

        <div className="space-y-3">
          {draft.boxes.map((box, boxIdx) => {
            const prefillQty = suggestedQtyForBox(draft, boxIdx);
            return (
            <div
              key={`box-${boxIdx}`}
              className="grid grid-cols-[1fr_5rem_auto] items-end gap-2 rounded-md border p-2"
            >
              <div>
                <p className="text-muted-foreground mb-1 text-[10px] font-medium uppercase">Box name</p>
                <SearchableSelect
                  value={box.box_name || null}
                  onChange={(key) => updateBox(boxIdx, { box_name: key ?? "" })}
                  options={validBins}
                  placeholder="Select box name"
                  emptyText="No valid box names synced"
                />
              </div>
              <div>
                <p className="text-muted-foreground mb-1 text-[10px] font-medium uppercase">
                  Qty ({prefillQty})
                </p>
                <Input
                  value={String(box.box_quantity)}
                  onChange={(e) =>
                    updateBox(boxIdx, {
                      box_quantity: e.target.value === "" ? 0 : Math.trunc(Number(e.target.value)),
                    })
                  }
                  className="h-8 font-mono text-xs"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                disabled={draft.boxes.length <= 1}
                onClick={() => removeBox(boxIdx)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            );
          })}
        </div>

        <Button type="button" variant="outline" size="sm" onClick={addBox}>
          <Plus className="mr-1 size-3.5" />
          Add box
        </Button>

        <DialogFooter>
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
