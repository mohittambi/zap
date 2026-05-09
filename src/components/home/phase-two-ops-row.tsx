"use client";

import type { HomeSummary } from "@/server/services/homeSummaryService";
import { OpsQueuesCard } from "@/components/home/ops-queues-card";
import { OpenPosCard } from "@/components/home/open-pos-card";
import { VendorQualityCard } from "@/components/home/vendor-quality-card";
import { InventorySnapshotCard } from "@/components/home/inventory-snapshot-card";

export function PhaseTwoOpsRow({
  data,
  loading,
}: {
  data: HomeSummary | null;
  loading: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
      <OpsQueuesCard queues={data?.ops_queues} loading={loading} />
      <OpenPosCard stat={data?.open_pos} loading={loading} />
      <VendorQualityCard vq={data?.vendor_quality} loading={loading} />
      <InventorySnapshotCard
        snapshot={data?.inventory_snapshot}
        scopedToCompany={data?.scoped.company_id != null}
        loading={loading}
      />
    </div>
  );
}
