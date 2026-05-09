"use client";

import * as React from "react";
import { toast } from "sonner";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DASHBOARD_CARD_IDS,
  type DashboardCardId,
  type DashboardLayout,
} from "@/lib/dashboard-card-ids";

const CARD_LABELS: Record<DashboardCardId, string> = {
  sales_qty: "Sales orders (qty)",
  sales_pos: "Sales POs raised",
  fill_rate_pct: "Avg fill rate",
  inbound_qty: "Inbound received (qty)",
  skus_below_reorder: "SKUs below reorder",
  ops_queues: "Ops queues",
  open_pos: "Open sales POs",
  vendor_quality: "Vendor quality",
  inventory_snapshot: "Inventory snapshot",
  trends: "Trend charts",
  channel_mix: "Channel mix",
  reorder_alerts_strip: "Reorder alerts strip",
  saved_query_panel: "Saved queries",
};

export function CustomiseDashboardSheet({
  layout,
  saving,
  onSave,
}: {
  layout: DashboardLayout;
  saving: boolean;
  onSave: (next: DashboardLayout) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DashboardLayout>(layout);

  React.useEffect(() => {
    if (open) setDraft(layout);
  }, [open, layout]);

  function toggle(id: DashboardCardId) {
    const set = new Set(draft.visible_cards);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    // Preserve canonical order regardless of toggle order.
    setDraft({
      ...draft,
      visible_cards: DASHBOARD_CARD_IDS.filter((c) => set.has(c)),
    });
  }

  function showAll() {
    setDraft({ ...draft, visible_cards: [...DASHBOARD_CARD_IDS] });
  }

  async function commit() {
    try {
      await onSave(draft);
      toast.success("Layout saved");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            <Settings2 className="size-3.5" />
            Customise
          </Button>
        }
      />
      <SheetContent side="right" className="w-[360px]">
        <SheetHeader className="border-b p-4">
          <SheetTitle>Customise dashboard</SheetTitle>
          <p className="text-muted-foreground text-xs">
            Pick which cards to show. Order is fixed in v1.
          </p>
        </SheetHeader>
        <div className="flex flex-col gap-1 p-4">
          {DASHBOARD_CARD_IDS.map((id) => {
            const checked = draft.visible_cards.includes(id);
            return (
              <label
                key={id}
                className="hover:bg-muted flex items-center gap-2 rounded px-2 py-1.5 text-sm"
              >
                <input
                  type="checkbox"
                  className="accent-primary size-4"
                  checked={checked}
                  onChange={() => toggle(id)}
                />
                <span>{CARD_LABELS[id]}</span>
              </label>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-2 border-t p-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={showAll}
            disabled={saving}
          >
            Show all
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void commit()}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
