import { AppPageTitle } from "@/components/layout/app-page-shell";
import { OutboundPurchaseOrdersTable } from "./outbound-purchase-orders-table";

export default function OutboundAllPurchaseOrdersPage() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-2 py-4 md:px-4">
      <AppPageTitle
        title="Outbound"
        description="All purchase orders — filter, paginate, and open a PO for details."
      />
      <OutboundPurchaseOrdersTable />
    </div>
  );
}
