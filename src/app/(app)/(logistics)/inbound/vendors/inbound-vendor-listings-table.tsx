"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

export type VendorListingRow = {
  id: number;
  vendor_id: number;
  sku_id: string;
  cost_price: number;
  listing: {
    sku_id: string;
    category: string | null;
    description: string;
    /** Present when the SKU names cache has a label for this sku_id */
    eautomate_sku_name?: string | null;
    available_quantity: number;
    bins: {
      id: number;
      warehouse_id: number;
      sku_id: string;
      bin_id: string;
      available_quantity: number;
    }[];
  } | null;
};

type BinRow = NonNullable<VendorListingRow["listing"]>["bins"][number];

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function InboundVendorListingsTable({
  vendorId,
}: Readonly<{ vendorId: string }>) {
  const [data, setData] = React.useState<VendorListingRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let c = false;
    (async () => {
      try {
        const res = await apiFetch<VendorListingRow[]>(
          `/api/vendors/listings/${encodeURIComponent(vendorId)}`
        );
        if (!c) setData(res);
      } catch (e) {
        if (!c) toast.error(e instanceof Error ? e.message : "Failed");
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [vendorId]);

  return (
    <Card className="border-primary/10 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Vendor SKUs</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-2 px-6 py-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : null}
        {!loading && data.length === 0 ? (
          <div className="px-6 py-8">
            <EmptyState
              title="No SKUs"
              description="This vendor has no vendor_sku rows yet. Run listing sync or assign SKUs in the database."
            />
          </div>
        ) : null}
        {!loading && data.length > 0 ? (
          <div className="overflow-x-auto px-2 pb-4 md:px-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="min-w-[140px]">SKU</TableHead>
                  <TableHead className="min-w-[200px]">Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">On hand</TableHead>
                  <TableHead className="text-center">Bins</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => {
                  const L = row.listing;
                  const binCount = L?.bins?.length ?? 0;
                  const binQty =
                    L?.bins?.reduce(
                      (acc: number, b: BinRow) =>
                        acc + (b.available_quantity ?? 0),
                      0
                    ) ?? 0;
                  return (
                    <TableRow key={row.id} className="hover:bg-muted/30">
                      <TableCell className="align-top font-mono text-xs">
                        {L ? (
                          <Link
                            href={`/listings/${encodeURIComponent(row.sku_id)}`}
                            className="text-primary font-medium underline-offset-4 hover:underline"
                          >
                            {row.sku_id}
                          </Link>
                        ) : (
                          <span>{row.sku_id}</span>
                        )}
                      </TableCell>
                      <TableCell
                        className="text-muted-foreground max-w-md align-top text-sm"
                        title={
                          L?.eautomate_sku_name
                            ? `Cached name: ${L.eautomate_sku_name}`
                            : undefined
                        }
                      >
                        {L
                          ? truncate(L.description || "—", 120)
                          : "Listing not in DB"}
                      </TableCell>
                      <TableCell className="align-top text-sm">
                        {L?.category ?? "—"}
                      </TableCell>
                      <TableCell className="align-top text-right font-mono text-sm">
                        {row.cost_price == null
                          ? "—"
                          : row.cost_price.toFixed(2)}
                      </TableCell>
                      <TableCell className="align-top text-right font-mono text-sm">
                        {L === null ? "—" : L.available_quantity}
                      </TableCell>
                      <TableCell
                        className="text-muted-foreground align-top text-center text-sm"
                        title={
                          binCount > 0
                            ? `${binQty} units across bins`
                            : undefined
                        }
                      >
                        {L === null ? "—" : binCount}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
