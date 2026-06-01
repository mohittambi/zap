"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  collectConsignmentBoxNumbers,
  getMaxBoxNumber,
  sumPackedQty,
  validateConsignmentSkuPackingClient,
  type ConsignmentBoxLine,
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
import { cn } from "@/lib/utils";

const NEW_BOX_VALUE = "__new_box__";

function sortBoxLines(boxes: ConsignmentBoxLine[]): ConsignmentBoxLine[] {
  return [...boxes].sort(
    (a, b) => a.box_number - b.box_number || a.box_name.localeCompare(b.box_name)
  );
}

/** Remaining qty available for a physical box line in the modal draft. */
function suggestedQtyForBox(
  sku: ConsignmentSkuPacking,
  boxNumber: number,
  draftBoxes: ConsignmentBoxLine[],
  boxIdx: number
): number {
  const n = Math.trunc(boxNumber);
  let packedOther = 0;
  draftBoxes.forEach((b, i) => {
    if (i === boxIdx || Math.trunc(b.box_number) !== n) return;
    packedOther += Number.isFinite(b.box_quantity) ? b.box_quantity : 0;
  });
  const packedOtherSaved = sku.boxes
    .filter((b) => Math.trunc(b.box_number) !== n)
    .reduce((sum, b) => sum + (Number.isFinite(b.box_quantity) ? b.box_quantity : 0), 0);
  const packedInDraftOtherBoxes = draftBoxes
    .filter((b, i) => i !== boxIdx && Math.trunc(b.box_number) !== n)
    .reduce((sum, b) => sum + (Number.isFinite(b.box_quantity) ? b.box_quantity : 0), 0);
  return Math.max(
    0,
    sku.pending_quantity - packedOtherSaved - packedInDraftOtherBoxes - packedOther
  );
}

function sumDraftPackedQty(draftBoxes: ConsignmentBoxLine[]): number {
  return draftBoxes.reduce(
    (s, b) => s + (Number.isFinite(b.box_quantity) ? b.box_quantity : 0),
    0
  );
}

function buildDraftBoxesForModal(
  sku: ConsignmentSkuPacking,
  activeBoxNumber: number,
  activeBoxName: string
): ConsignmentBoxLine[] {
  const boxes = sortBoxLines(sku.boxes.map((b) => ({ ...b })));
  const n = Math.trunc(activeBoxNumber);
  if (!boxes.some((b) => Math.trunc(b.box_number) === n)) {
    boxes.push({
      box_number: n,
      box_quantity: 0,
      box_name: activeBoxName,
    });
  }
  return sortBoxLines(boxes);
}

export function ConsignmentSkuPackingModal({
  open,
  onOpenChange,
  sku,
  allSkus,
  activeBoxNumber,
  activeBoxName,
  validBins,
  validBinSet,
  onSave,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sku: ConsignmentSkuPacking | null;
  allSkus: ConsignmentSkuPacking[];
  activeBoxNumber: number;
  activeBoxName: string;
  validBins: { key: string; label: string }[];
  validBinSet: Set<string>;
  onSave: (updated: ConsignmentSkuPacking) => void;
}>) {
  const [draft, setDraft] = React.useState<ConsignmentSkuPacking | null>(null);
  const [errors, setErrors] = React.useState<string[]>([]);
  const wasOpenRef = React.useRef(false);
  const errorsRef = React.useRef<HTMLUListElement>(null);

  React.useLayoutEffect(() => {
    if (open && sku) {
      if (!wasOpenRef.current) {
        const modalBoxes = buildDraftBoxesForModal(sku, activeBoxNumber, activeBoxName);
        setDraft({ ...sku, boxes: modalBoxes });
        setErrors([]);
      }
    } else if (!open) {
      setDraft(null);
      setErrors([]);
    }
    wasOpenRef.current = open;
  }, [open, sku, activeBoxNumber, activeBoxName]);

  React.useEffect(() => {
    if (errors.length > 0) {
      errorsRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [errors]);

  const boxNumberOptions = React.useMemo((): { existing: number[]; nextNew: number } => {
    if (!draft) return { existing: [], nextNew: 1 };
    const draftNums = draft.boxes.map((b) => Math.trunc(b.box_number));
    const existing = collectConsignmentBoxNumbers(allSkus, [
      activeBoxNumber,
      ...draftNums,
    ]);
    const max = Math.max(getMaxBoxNumber(allSkus), ...draftNums, activeBoxNumber, 0);
    return { existing, nextNew: max + 1 };
  }, [draft, allSkus, activeBoxNumber]);

  if (!draft) return null;

  const remainingUnpackaged = Math.max(0, draft.pending_quantity - sumDraftPackedQty(draft.boxes));

  function updateBox(boxIdx: number, patch: Partial<ConsignmentBoxLine>) {
    setDraft((prev) => {
      if (!prev) return prev;
      const boxes = [...prev.boxes];
      boxes[boxIdx] = { ...boxes[boxIdx], ...patch };
      return { ...prev, boxes: sortBoxLines(boxes) };
    });
  }

  function addLineForSku(targetBoxNumber?: number) {
    setDraft((prev) => {
      if (!prev) return prev;
      const maxInDraft = prev.boxes.reduce(
        (m, b) => Math.max(m, Math.trunc(b.box_number)),
        0
      );
      const boxNumber =
        targetBoxNumber != null
          ? Math.trunc(targetBoxNumber)
          : Math.max(getMaxBoxNumber(allSkus), maxInDraft, activeBoxNumber) + 1;
      if (prev.boxes.some((b) => Math.trunc(b.box_number) === boxNumber)) {
        return prev;
      }
      return {
        ...prev,
        boxes: sortBoxLines([
          ...prev.boxes,
          {
            box_number: boxNumber,
            box_quantity: 0,
            box_name: activeBoxName,
          },
        ]),
      };
    });
  }

  function removeBox(boxIdx: number) {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        boxes: prev.boxes.filter((_, i) => i !== boxIdx),
      };
    });
  }

  function handleSave() {
    if (!draft) return;

    const activeLines = draft.boxes
      .map((b) => ({
        box_number: Math.trunc(b.box_number),
        box_name: (b.box_name.trim() || activeBoxName.trim()),
        box_quantity: Math.trunc(b.box_quantity),
      }))
      .filter((b) => b.box_quantity > 0);

    if (activeLines.length === 0) {
      const msg = "Enter a quantity of at least 1 on at least one box line.";
      setErrors([msg]);
      toast.error(msg);
      return;
    }

    for (const line of activeLines) {
      if (!line.box_name) {
        const msg =
          "Box type is required on each line with quantity. Select a type on the packing bar or in the row.";
        setErrors([msg]);
        toast.error(msg);
        return;
      }
    }

    const merged: ConsignmentSkuPacking = {
      ...draft,
      boxes: sortBoxLines(activeLines),
    };

    const result = validateConsignmentSkuPackingClient([merged], validBinSet);
    if (!result.ok) {
      const messages = result.errors.map((e) => {
        const field = e.field ? `${e.field}: ` : "";
        return `${field}${e.message}`;
      });
      setErrors(messages);
      toast.error(messages[0] ?? "Could not save packing");
      return;
    }

    onSave(merged);
    toast.success("Packing saved for this SKU");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[min(98vw,40rem)] max-w-[min(98vw,40rem)] flex-col gap-0 p-0 sm:max-w-[min(98vw,40rem)]">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle className="text-base">
            Packing — {draft.po_secondary_sku || "—"}
            {draft.company_code_primary ? ` · ${draft.company_code_primary}` : ""}
          </DialogTitle>
          <DialogDescription className="text-sm">
            Pending: {draft.pending_quantity}. Remaining to pack: {remainingUnpackaged}. Open
            physical box #{activeBoxNumber}
            {activeBoxName ? ` (type: ${activeBoxName})` : ""}. Add lines to split this SKU across
            boxes; each row can use a different box type.
          </DialogDescription>
        </DialogHeader>

        {errors.length > 0 ? (
          <ul
            ref={errorsRef}
            className="text-destructive shrink-0 space-y-1 border-b border-destructive/30 bg-destructive/5 px-6 py-2 text-xs"
          >
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
                  <th className="w-28 px-2 py-2 font-semibold whitespace-nowrap">Box #</th>
                  <th className="w-36 px-2 py-2 font-semibold whitespace-nowrap">Box type</th>
                  <th className="w-24 px-2 py-2 font-semibold whitespace-nowrap text-right">Qty</th>
                  <th className="w-28 px-2 py-2 font-semibold whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {draft.boxes.map((box, boxIdx) => {
                  const prefillQty = suggestedQtyForBox(
                    draft,
                    box.box_number,
                    draft.boxes,
                    boxIdx
                  );
                  const isActiveOpenBox = Math.trunc(box.box_number) === activeBoxNumber;
                  const usedNumbers = new Set(
                    draft.boxes.map((b, i) => (i === boxIdx ? -1 : Math.trunc(b.box_number)))
                  );
                  return (
                    <tr
                      key={`box-${box.box_number}-${box.box_name}-${boxIdx}`}
                      className={isActiveOpenBox ? "bg-primary/5" : undefined}
                    >
                      <td className="px-2 py-1 align-top">
                        <select
                          value={String(Math.trunc(box.box_number))}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === NEW_BOX_VALUE) {
                              updateBox(boxIdx, { box_number: boxNumberOptions.nextNew });
                            } else {
                              const n = Math.trunc(Number(val));
                              if (!usedNumbers.has(n)) {
                                updateBox(boxIdx, { box_number: n });
                              }
                            }
                          }}
                          className={cn(
                            "border-input bg-background h-8 w-[6.5rem] rounded-md border px-2 font-mono text-xs tabular-nums"
                          )}
                        >
                          {boxNumberOptions.existing.map((n) => (
                            <option key={n} value={String(n)} disabled={usedNumbers.has(n)}>
                              Box {n}
                            </option>
                          ))}
                          {!boxNumberOptions.existing.includes(Math.trunc(box.box_number)) ? (
                            <option value={String(Math.trunc(box.box_number))}>
                              Box {Math.trunc(box.box_number)}
                            </option>
                          ) : null}
                          <option value={NEW_BOX_VALUE}>
                            New box ({boxNumberOptions.nextNew})
                          </option>
                        </select>
                      </td>
                      <td className="px-2 py-1 align-top">
                        <SearchableSelect
                          value={box.box_name || null}
                          onChange={(key) => updateBox(boxIdx, { box_name: key ?? "" })}
                          options={validBins}
                          placeholder="Box type"
                          emptyText="No valid box types"
                          variant="soft"
                          size="sm"
                          className="max-w-[9rem]"
                        />
                      </td>
                      <td className="px-2 py-1 text-right align-top">
                        <Input
                          value={box.box_quantity > 0 ? String(box.box_quantity) : ""}
                          onChange={(e) =>
                            updateBox(boxIdx, {
                              box_quantity:
                                e.target.value === "" ? 0 : Math.trunc(Number(e.target.value)),
                            })
                          }
                          placeholder={prefillQty > 0 ? String(prefillQty) : "0"}
                          className="ml-auto h-8 w-20 font-mono text-xs tabular-nums"
                        />
                      </td>
                      <td className="px-2 py-1 align-top">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0"
                          onClick={() => removeBox(boxIdx)}
                          title="Remove line"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => addLineForSku()}
            >
              <Plus className="mr-0.5 size-3" />
              Add line for this SKU
            </Button>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSave();
            }}
          >
            Save packing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
