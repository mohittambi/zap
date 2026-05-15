import { Suspense } from "react";
import { AppPageTitle } from "@/components/layout/app-page-shell";
import { OutboundConsignmentsTable } from "./outbound-consignments-table";

export default function OutboundConsignmentsPage() {
  return (
    <div className="mx-auto max-w-[1800px] space-y-4 px-2 py-4 md:px-4">
      <AppPageTitle
        title="Consignments"
        description="Outbound consignments and their associated companies and delivery locations."
      />
      <Suspense fallback={<p className="text-muted-foreground text-sm">Loading…</p>}>
        <OutboundConsignmentsTable />
      </Suspense>
    </div>
  );
}

