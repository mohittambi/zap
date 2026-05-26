"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { OpsSkuPoControlDetailPanel } from "@/components/ops/ops-sku-po-control-detail-panel";
import type {
  OpsCompanyOutboundColumn,
  OpsSkuPoControlRow,
} from "@/types/opsSkuPoControl";
import { cn } from "@/lib/utils";

export function OpsSkuPoControlDetailDialog({
  masterSku,
  companies,
  initialRow,
  listFromCache,
  open,
  onOpenChange,
}: {
  masterSku: string | null;
  companies?: OpsCompanyOutboundColumn[];
  initialRow?: OpsSkuPoControlRow | null;
  listFromCache?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const sku = masterSku?.trim() ?? "";
  const fullPageHref = sku
    ? `/ops/sku-po-control/${encodeURIComponent(sku)}`
    : "#";
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [refreshing, setRefreshing] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setRefreshKey(0);
      setRefreshing(false);
    }
  }, [open]);

  const handleRefresh = React.useCallback(() => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
  }, []);

  const handleLoadComplete = React.useCallback(() => {
    setRefreshing(false);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex h-[95vh] max-h-[min(95vh,920px)] w-[98vw] max-w-[min(98vw,1600px)]",
          "sm:max-w-[min(98vw,1600px)]",
          "flex-col gap-0 overflow-hidden p-0"
        )}
      >
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
            <DialogTitle className="font-mono text-base">{sku || "SKU detail"}</DialogTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9 shrink-0"
                aria-label="Refresh SKU detail"
                disabled={!sku || refreshing}
                onClick={handleRefresh}
              >
                <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
              </Button>
              {sku ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={fullPageHref} target="_blank" rel="noopener noreferrer">
                    Open full page
                    <ExternalLink className="ml-2 size-3.5" />
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            Live-computed from synced DB · open outbound and inbound PO trail
          </p>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {sku ? (
            <OpsSkuPoControlDetailPanel
              masterSku={sku}
              companies={companies}
              initialRow={initialRow}
              listFromCache={listFromCache}
              refreshKey={refreshKey}
              onLoadComplete={handleLoadComplete}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
