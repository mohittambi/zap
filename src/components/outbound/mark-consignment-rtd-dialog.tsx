"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import {
  OUTBOUND_SHIPMENT_TYPES,
  type OutboundShipmentType,
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

type TransporterRow = { id: number; name: string };

export function MarkConsignmentRtdDialog({
  open,
  onOpenChange,
  consignmentId,
  onMarked,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consignmentId: number;
  onMarked?: () => void;
}>) {
  const [busy, setBusy] = React.useState(false);
  const [loadingTransporters, setLoadingTransporters] = React.useState(false);
  const [transporters, setTransporters] = React.useState<TransporterRow[]>([]);
  const [transporterId, setTransporterId] = React.useState<string | null>(null);
  const [shipmentType, setShipmentType] = React.useState<OutboundShipmentType>("Surface");
  const [docketNumber, setDocketNumber] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setTransporterId(null);
    setShipmentType("Surface");
    setDocketNumber("");
    setLoadingTransporters(true);
    apiFetch<{ content: TransporterRow[] }>("/api/outbound/transporters")
      .then((data) => setTransporters(data.content ?? []))
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Failed to load transporters");
        setTransporters([]);
      })
      .finally(() => setLoadingTransporters(false));
  }, [open]);

  const transporterOptions = transporters.map((t) => ({
    key: String(t.id),
    label: t.name,
  }));

  async function submit() {
    if (!transporterId) {
      toast.error("Select a transporter");
      return;
    }
    if (!docketNumber.trim()) {
      toast.error("Enter a docket number");
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/api/outbound/consignments/${consignmentId}/mark-rtd`, {
        method: "POST",
        body: JSON.stringify({
          transporter_id: Number(transporterId),
          shipment_type: shipmentType,
          docket_number: docketNumber.trim(),
        }),
      });
      toast.success("Consignment marked for dispatch");
      onOpenChange(false);
      onMarked?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Mark for dispatch failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark for dispatch</DialogTitle>
          <DialogDescription>
            Enter transporter, shipment type, and docket number. Status will be set to MARKED_RTD.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium">Transporter</p>
            {loadingTransporters ? (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" />
                Loading…
              </p>
            ) : (
              <SearchableSelect
                value={transporterId}
                onChange={(key) => setTransporterId(key)}
                options={transporterOptions}
                placeholder="Select transporter"
                emptyText="No transporters synced"
              />
            )}
          </div>

          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium">Shipment type</p>
            <select
              value={shipmentType}
              onChange={(e) => setShipmentType(e.target.value as OutboundShipmentType)}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            >
              {OUTBOUND_SHIPMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium">Docket number</p>
            <Input
              value={docketNumber}
              onChange={(e) => setDocketNumber(e.target.value)}
              placeholder="Docket / LR number"
              className="font-mono text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={busy} onClick={() => void submit()}>
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Confirm dispatch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
