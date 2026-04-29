"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { AppPageTitle } from "@/components/layout/app-page-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type GrnRow = { grn_id: number };

function NewGrnForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const vendorId = sp.get("vendor_id") ?? "";
  const poId = sp.get("po_id") ?? "";
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    const vid = Number(vendorId);
    const pid = Number(poId);
    if (!Number.isFinite(vid) || !Number.isFinite(pid)) {
      toast.error("vendor_id and po_id query params are required");
      return;
    }
    setBusy(true);
    try {
      const row = await apiFetch<GrnRow>(`/api/inbound/grns`, {
        method: "POST",
        body: JSON.stringify({ vendor_id: vid, po_id: pid }),
      });
      toast.success("Draft GRN created");
      router.push(`/inbound/grns/${row.grn_id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create draft GRN</CardTitle>
        <CardDescription>
          Creates a draft goods receipt row in Zap for this vendor and PO.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Vendor ID</Label>
          <Input value={vendorId} readOnly className="font-mono" />
        </div>
        <div className="space-y-2">
          <Label>PO ID</Label>
          <Input value={poId} readOnly className="font-mono" />
        </div>
        <Button
          type="button"
          disabled={busy || !vendorId || !poId}
          onClick={() => void submit()}
        >
          {busy ? "Creating…" : "Create draft GRN"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function NewInboundGrnPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6 px-2 py-6">
      <AppPageTitle
        title="New GRN"
        description="Create a draft GRN linked to a vendor PO."
      />
      <Suspense
        fallback={<p className="text-muted-foreground text-sm">Loading…</p>}
      >
        <NewGrnForm />
      </Suspense>
    </div>
  );
}
