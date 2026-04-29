import { Suspense } from "react";
import { AppPageTitle } from "@/components/layout/app-page-shell";
import { OutboundConsignmentsTable } from "../consignments/outbound-consignments-table";

export default function OutboundPendingInvoicesPage() {
  return (
    <div className="mx-auto max-w-[1800px] space-y-4 px-2 py-4 md:px-4">
      <AppPageTitle
        title="Pending Invoices"
        description="Outbound consignments that still need an invoice number or have a pending invoice status."
      />
      <Suspense fallback={<p className="text-muted-foreground text-sm">Loading…</p>}>
        <OutboundConsignmentsTable invoicePending />
      </Suspense>
    </div>
  );
}
