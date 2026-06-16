"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListingThumbnail } from "@/components/listings/listing-thumbnail";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function pickListing(row: Record<string, unknown>): Record<string, unknown> | null {
  const l = row.listing;
  if (l && typeof l === "object" && !Array.isArray(l)) return l as Record<string, unknown>;
  return null;
}

export type OutboundListingsEnvelope = {
  total?: unknown;
  content?: unknown[];
  current_page?: unknown;
  per_page_count?: unknown;
  curr_page_count?: unknown;
};

export function OutboundPoLineItemsTable({
  listings,
}: {
  listings: OutboundListingsEnvelope | Record<string, unknown>;
}) {
  const [showImages, setShowImages] = React.useState(false);
  const [openIds, setOpenIds] = React.useState<Set<number>>(() => new Set());

  const content = React.useMemo(() => {
    const c = (listings as OutboundListingsEnvelope).content;
    if (!Array.isArray(c)) return [] as Record<string, unknown>[];
    return c.filter((x): x is Record<string, unknown> => x != null && typeof x === "object");
  }, [listings]);

  const toggle = (id: number) => {
    setOpenIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  if (content.length === 0) {
    return (
      <p className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
        No line items synced yet. Open this page again to refresh listings from the sync pipeline.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          id="po-show-images"
          type="checkbox"
          className="border-input size-4 rounded"
          checked={showImages}
          onChange={(e) => setShowImages(e.target.checked)}
        />
        <Label htmlFor="po-show-images" className="text-sm font-medium">
          Show Images?
        </Label>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="w-8 px-1 py-2" aria-label="Expand" />
              <th className="px-2 py-2 font-semibold">SR No.</th>
              {showImages ? (
                <th className="px-2 py-2 font-semibold">Image</th>
              ) : null}
              <th className="px-2 py-2 font-semibold">PO Secondary SKU</th>
              <th className="px-2 py-2 font-semibold">Master SKU</th>
              <th className="px-2 py-2 font-semibold">Inventory SKU</th>
              <th className="px-2 py-2 font-semibold">Pack-Combo SKU</th>
              <th className="px-2 py-2 font-semibold">SKU Type</th>
              <th className="px-2 py-2 font-semibold">Company Code Primary</th>
              <th className="px-2 py-2 font-semibold">Zap EAN</th>
              <th className="px-2 py-2 text-right font-semibold">Warehouse Quantity</th>
              <th className="px-2 py-2 text-right font-semibold">Demand Quantity</th>
              <th className="px-2 py-2 text-right font-semibold">Packed Quantity</th>
              <th className="px-2 py-2 text-right font-semibold">Dispatched Quantity</th>
              <th className="px-2 py-2 text-right font-semibold">Pending Quantity</th>
              <th className="px-2 py-2 text-right font-semibold">Fill Rate %</th>
            </tr>
          </thead>
          <tbody>
            {content.map((row, idx) => {
              const rowId = num(row.id) || idx;
              const listing = pickListing(row);
              const demand =
                num(row.demand) || num(row.original_demand) || num(row.box_quantity);
              const dispatched = num(row.dispatched_quantity);
              const packed = num((row as { packed_quantity?: unknown }).packed_quantity);
              const pending = Math.max(0, demand - dispatched - packed);
              const fillPct =
                demand > 0 ? Math.round((dispatched / demand) * 1000) / 10 : 0;
              const expanded = openIds.has(rowId);

              return (
                <React.Fragment key={`${rowId}-${idx}`}>
                  <tr className="border-b">
                    <td className="px-1 py-1 align-middle">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-expanded={expanded}
                        onClick={() => toggle(rowId)}
                      >
                        {expanded ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                      </Button>
                    </td>
                    <td className="px-2 py-2 tabular-nums">{idx + 1}</td>
                    {showImages ? (
                      <td className="px-2 py-1 align-middle">
                        <ListingThumbnail row={row} size={48} />
                      </td>
                    ) : null}
                    <td className="px-2 py-2 font-mono text-xs">{str(row.po_secondary_sku)}</td>
                    <td className="px-2 py-2 font-mono text-xs">{str(row.master_sku)}</td>
                    <td className="px-2 py-2 font-mono text-xs">{str(row.inventory_sku_id)}</td>
                    <td className="px-2 py-2 font-mono text-xs">{str(row.pack_combo_sku_id)}</td>
                    <td className="px-2 py-2">{str(row.sku_type)}</td>
                    <td className="px-2 py-2 font-mono text-xs">{str(row.company_code_primary)}</td>
                    <td className="px-2 py-2 font-mono text-xs tabular-nums">
                      {str(row.zap_ean) || "—"}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {listing ? num(listing.available_quantity) : "—"}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{demand}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{packed}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{dispatched}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{pending}</td>
                    <td
                      className={cn(
                        "px-2 py-2 text-right tabular-nums",
                        fillPct > 0 && "text-primary font-medium"
                      )}
                    >
                      {fillPct}%
                    </td>
                  </tr>
                  {expanded ? (
                    <tr className="bg-muted/30 border-b">
                      <td
                        colSpan={showImages ? 16 : 15}
                        className="px-4 py-3 text-sm leading-relaxed"
                      >
                        <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          <div>
                            <dt className="text-muted-foreground text-xs">Title</dt>
                            <dd>{str(row.title)}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground text-xs">Color</dt>
                            <dd>{str(row.color ?? listing.color)}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground text-xs">Company Code Secondary</dt>
                            <dd className="font-mono text-xs">{str(row.company_code_secondary)}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground text-xs">Zap EAN</dt>
                            <dd className="font-mono text-xs tabular-nums">
                              {str(row.zap_ean) || "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground text-xs">Universal EAN</dt>
                            <dd className="font-mono text-xs tabular-nums">
                              {str(row.universal_ean) || "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground text-xs">HSN</dt>
                            <dd className="font-mono text-xs">{str(row.hsn_code)}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground text-xs">MRP</dt>
                            <dd className="tabular-nums">{num(row.mrp)}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground text-xs">Rate exclusive of Taxes</dt>
                            <dd className="tabular-nums">{num(row.rate_without_tax)}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground text-xs">Tax Rate</dt>
                            <dd className="tabular-nums">{num(row.tax_rate)}</dd>
                          </div>
                        </dl>
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
