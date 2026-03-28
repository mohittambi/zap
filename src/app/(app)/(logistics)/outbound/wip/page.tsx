import { AppPageTitle } from "@/components/layout/app-page-shell";
import { OutboundPurchaseOrdersTable } from "../outbound-purchase-orders-table";

export default function OutboundWipPurchaseOrdersPage() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-2 py-4 md:px-4">
      <AppPageTitle
        title="WIP Purchase Orders"
        description="Purchase orders marked as work-in-progress (Is WIP = YES)."
      />
      <OutboundPurchaseOrdersTable wipOnly />
    </div>
  );
}
