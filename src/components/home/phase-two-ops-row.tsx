"use client";

import type { HomeSummary } from "@/server/services/homeSummaryService";
import type { DashboardCardId } from "@/lib/dashboard-card-ids";
import { OpsQueuesCard } from "@/components/home/ops-queues-card";
import { OpenPosCard } from "@/components/home/open-pos-card";
import { VendorQualityCard } from "@/components/home/vendor-quality-card";
import { InventorySnapshotCard } from "@/components/home/inventory-snapshot-card";

export function PhaseTwoOpsRow({
  data,
  loading,
  isVisible = () => true,
}: {
  data: HomeSummary | null;
  loading: boolean;
  isVisible?: (id: DashboardCardId) => boolean;
}) {
  const companyId = data?.scoped.company_id ?? null;
  const openPosHref =
    companyId != null
      ? `/outbound/purchase-orders?company_id=${companyId}`
      : "/outbound/purchase-orders";

  const showOps = isVisible("ops_queues");
  const showOpenPos = isVisible("open_pos");
  const showVQ = isVisible("vendor_quality");
  const showInv = isVisible("inventory_snapshot");
  if (!showOps && !showOpenPos && !showVQ && !showInv) return null;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
      {showOps && <OpsQueuesCard queues={data?.ops_queues} loading={loading} />}
      {showOpenPos && (
        <OpenPosCard stat={data?.open_pos} loading={loading} href={openPosHref} />
      )}
      {showVQ && (
        <VendorQualityCard vq={data?.vendor_quality} loading={loading} href="/inbound" />
      )}
      {showInv && (
        <InventorySnapshotCard
          snapshot={data?.inventory_snapshot}
          scopedToCompany={companyId != null}
          loading={loading}
        />
      )}
    </div>
  );
}
