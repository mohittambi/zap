"use client";

import { useParams } from "next/navigation";
import { AppPageTitle } from "@/components/layout/app-page-shell";
import { OpsSkuPoControlDetailPanel } from "@/components/ops/ops-sku-po-control-detail-panel";

export default function OpsSkuPoControlDetailPage() {
  const params = useParams();
  const masterSku = decodeURIComponent(String(params.masterSku ?? ""));

  return (
    <div className="space-y-6">
      <AppPageTitle
        title={masterSku}
        description="SKU PO Control drill-down · live-computed on each load from synced DB (not the list’s 6h cache)"
      />
      {masterSku ? <OpsSkuPoControlDetailPanel masterSku={masterSku} /> : null}
    </div>
  );
}
