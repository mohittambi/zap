"use client";

import { Package, Plus } from "lucide-react";
import { SearchableSelect } from "@/components/outbound/searchable-select";
import { Button } from "@/components/ui/button";

export function ConsignmentCurrentBoxBar({
  activeBoxNumber,
  activeBoxName,
  boxesUsed,
  validBins,
  disabled = false,
  canCloseBox,
  canAddBox,
  onBoxNameChange,
  onAddBox,
  onCloseBox,
}: Readonly<{
  activeBoxNumber: number | null;
  activeBoxName: string;
  boxesUsed: number;
  validBins: { key: string; label: string }[];
  disabled?: boolean;
  canCloseBox: boolean;
  canAddBox: boolean;
  onBoxNameChange: (name: string) => void;
  onAddBox: () => void;
  onCloseBox: () => void;
}>) {
  const hasOpenBox = activeBoxNumber != null;

  return (
    <div className="bg-muted/40 flex flex-col gap-3 rounded-md border px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs font-medium">
          Physical boxes used:{" "}
          <span className="text-foreground font-mono tabular-nums">{boxesUsed}</span>
        </span>
        <span className="text-muted-foreground text-xs">
          {hasOpenBox
            ? "Close the open box, then use Add box for the next physical bin."
            : "Add a box when you are ready to pack."}
        </span>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-center gap-2">
            <Package className="text-muted-foreground size-4 shrink-0" aria-hidden />
            <span className="text-sm font-medium whitespace-nowrap">
              {hasOpenBox ? `Packing into Box #${activeBoxNumber}` : "No physical box open"}
            </span>
          </div>
          {hasOpenBox ? (
            <div className="flex min-w-0 flex-col gap-1 sm:max-w-xs sm:flex-1">
              <span className="text-muted-foreground text-xs">Box type</span>
              <SearchableSelect
                value={activeBoxName || null}
                onChange={(key) => onBoxNameChange(key ?? "")}
                options={validBins}
                placeholder="Select box type"
                emptyText="No valid box types"
                variant="soft"
                size="sm"
                disabled={disabled}
                className="w-full max-w-[14rem]"
              />
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={disabled || !canAddBox}
            onClick={onAddBox}
          >
            <Plus className="mr-1 size-3.5" />
            Add box
          </Button>
          {hasOpenBox ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled || !canCloseBox}
              onClick={onCloseBox}
            >
              Close box
            </Button>
          ) : null}
        </div>
      </div>
      {hasOpenBox ? (
        <p className="text-muted-foreground text-xs">
          Box type does not set the physical box number. SKUs packed here share box #
          {activeBoxNumber} until you close the box.
        </p>
      ) : null}
    </div>
  );
}
