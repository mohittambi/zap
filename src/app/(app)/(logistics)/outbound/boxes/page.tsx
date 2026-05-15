import { AppPageTitle } from "@/components/layout/app-page-shell";
import { BoxesTable } from "./boxes-table";

export default function OutboundManageBoxesPage() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-2 py-4 md:px-4">
      <AppPageTitle
        title="Manage Boxes"
        description="View and manage outbound packing boxes. Filter by status and open a box for details."
      />
      <BoxesTable />
    </div>
  );
}
