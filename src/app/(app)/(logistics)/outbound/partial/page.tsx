import { AppPageTitle } from "@/components/layout/app-page-shell";
import { PartialOutboundPosTable } from "../partial-outbound-pos-table";

export default function OutboundPartialPoPage() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-2 py-4 md:px-4">
      <AppPageTitle
        title="Partially Created Purchase Orders"
        description="Rows with po_creation_status = PARTIAL in Zap (sync from eAutomate with npm run sync:outbound-partial-pos). PO numbers link to detail."
      />
      <PartialOutboundPosTable />
    </div>
  );
}
