import { AppPageTitle } from "@/components/layout/app-page-shell";
import { PartialOutboundPosTable } from "../partial-outbound-pos-table";

export default function OutboundPartialPoPage() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-2 py-4 md:px-4">
      <AppPageTitle
        title="Partially Created Purchase Orders"
        description="Outbound purchase orders with partial creation status. PO numbers link to the full detail view."
      />
      <PartialOutboundPosTable />
    </div>
  );
}
