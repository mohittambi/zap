import { AppPageTitle } from "@/components/layout/app-page-shell";
import { OutboundConsignmentsTable } from "./outbound-consignments-table";

export default function OutboundConsignmentsPage() {
  return (
    <div className="mx-auto max-w-[1800px] space-y-4 px-2 py-4 md:px-4">
      <AppPageTitle
        title="Consignments"
        description="Data from Zap (sync: npm run sync:outbound-consignments). Companies: npm run sync:outbound-companies. Delivery locations are refreshed by the consignments sync."
      />
      <OutboundConsignmentsTable />
    </div>
  );
}

