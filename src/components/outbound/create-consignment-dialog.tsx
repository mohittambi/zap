"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function CreateConsignmentDialog({
  open,
  onOpenChange,
  poId,
  poNumber,
  onCreated,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poId: number;
  poNumber: string;
  onCreated?: () => void;
}>) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function createConsignment() {
    setBusy(true);
    try {
      const result = await apiFetch<{ consignment: { id: number } }>(
        `/api/outbound/purchase-orders/${poId}/consignments`,
        { method: "POST", body: JSON.stringify({}) }
      );
      toast.success(`Consignment #${result.consignment.id} created — enter line items on the detail page`);
      onOpenChange(false);
      onCreated?.();
      router.push(`/outbound/consignments/${result.consignment.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Consignment</DialogTitle>
          <DialogDescription>
            Create an empty consignment for PO {poNumber}. You will enter bin packing lines on the
            consignment detail page (CSV upload or form).
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={busy} onClick={() => void createConsignment()}>
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Create consignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
