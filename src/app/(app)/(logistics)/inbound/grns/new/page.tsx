"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppPageTitle } from "@/components/layout/app-page-shell";

/** Bookmark/deep links land here; creating a draft GRN is done via the PO page modal only. */
function NewGrnNotice() {
  const sp = useSearchParams();
  const vendorId = sp.get("vendor_id") ?? "";
  const poId = sp.get("po_id") ?? "";
  const poHref =
    vendorId && poId
      ? `/inbound/vendors/${encodeURIComponent(vendorId)}/purchase-orders/${encodeURIComponent(poId)}`
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Open New GRN</CardTitle>
        <CardDescription>
          Draft GRNs are opened from the purchase order: use{" "}
          <span className="text-foreground font-medium">Open new GRN</span> in the GRN section on
          the PO—this opens a modal; there is no separate form here.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {poHref ? (
          <Button asChild>
            <Link href={poHref}>Go to this purchase order</Link>
          </Button>
        ) : null}
        <Button variant="outline" asChild>
          <Link href="/inbound/grns">All GRNs</Link>
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
        description="Create a draft from the purchase order page."
      />
      <Suspense
        fallback={<p className="text-muted-foreground text-sm">Loading…</p>}
      >
        <NewGrnNotice />
      </Suspense>
    </div>
  );
}
