"use client";

import * as React from "react";
import { toast } from "sonner";
import { RotateCcw, Settings2 } from "lucide-react";
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
  defaultPositionFor,
  type CardConfig,
  type DashboardCardId,
  type DashboardLayoutV2,
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

function findCard(layout: DashboardLayoutV2, id: DashboardCardId): CardConfig {
  return (
    layout.cards.find((c) => c.id === id) ?? {
      id,
      pos: defaultPositionFor(id),
    }
  );
}

export function CustomiseDashboardSheet({
  layout,
  saving,
  onSave,
  onReset,
}: {
  layout: DashboardLayoutV2;
  saving: boolean;
  onSave: (next: DashboardLayoutV2) => Promise<void>;
  onReset: () => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DashboardLayoutV2>(layout);

  React.useEffect(() => {
    if (open) setDraft(layout);
  }, [open, layout]);

  function toggle(id: DashboardCardId) {
    const cur = findCard(draft, id);
    const nextHidden = !cur.hidden;
    setDraft({
      ...draft,
      cards: DASHBOARD_CARD_IDS.map((cid) =>
        cid === id ? { ...findCard(draft, cid), hidden: nextHidden } : findCard(draft, cid)
      ),
    });
  }

  function showAll() {
    setDraft({
      ...draft,
      cards: DASHBOARD_CARD_IDS.map((cid) => ({
        ...findCard(draft, cid),
        hidden: false,
      })),
    });
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

  async function reset() {
    try {
      await onReset();
      toast.success("Layout reset to default");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
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
            Toggle cards on/off. Drag and resize cards on the dashboard itself.
          </p>
        </SheetHeader>
        <div className="flex flex-col gap-1 p-4">
          {DASHBOARD_CARD_IDS.map((id) => {
            const checked = !findCard(draft, id).hidden;
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
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={showAll}
              disabled={saving}
            >
              Show all
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void reset()}
              disabled={saving}
              className="text-muted-foreground gap-1.5"
            >
              <RotateCcw className="size-3.5" />
              Reset
            </Button>
          </div>
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
