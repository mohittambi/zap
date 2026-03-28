"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
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
import { AppPageTitle } from "@/components/layout/app-page-shell";
import { cn } from "@/lib/utils";

type PoRow = {
  po_id: number;
  vendor_id: number;
  expected_date: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  date_published: string | null;
  status: string | null;
  po_remarks: string | null;
  vendor_name: string | null;
  id: number;
  sku_count: number;
  total_quantity: number;
  number_of_grns: number;
  total_invoice_quantity: number;
  total_accepted_quantity: number;
  total_rejected_quantity: number;
  sku_fill_rate: number;
  quantity_fill_rate: number;
};

type PoListResponse = {
  total: number;
  current_page: number;
  per_page_count: number;
  curr_page_count: number;
  content: PoRow[];
};

type VendorOpt = {
  id: number;
  vendor_name: string;
};

const displayFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function formatDisplayDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return displayFormatter.format(d);
}

function parseExpectedDateOnly(s: string | null): Date | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    12,
    0,
    0,
    0
  );
}

function expiryTone(
  expected: string | null
): "expired" | "soon" | "ok" | "unknown" {
  const d = parseExpectedDateOnly(expected);
  if (!d || Number.isNaN(d.getTime())) return "unknown";
  const now = new Date();
  const startToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const endSoon = new Date(startToday);
  endSoon.setDate(endSoon.getDate() + 5);
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (day < startToday) return "expired";
  if (day < endSoon) return "soon";
  return "ok";
}

function displayPoStatus(status: string | null): string {
  if (!status) return "—";
  if (status === "PENDING_PUBLISHED") return "Published";
  if (status === "MARKED_CANCELLED") return "Cancelled";
  if (status === "MARKED_MODIFICATION") return "Modification";
  return status.replace(/_/g, " ");
}

export default function InboundPurchaseOrdersPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("purchase_orders", "create");

  const [vendors, setVendors] = React.useState<VendorOpt[]>([]);
  const [page, setPage] = React.useState(1);
  const [searchDraft, setSearchDraft] = React.useState("");
  const [searchApplied, setSearchApplied] = React.useState("");
  const [vendorFilter, setVendorFilter] = React.useState("");
  const [vendorApplied, setVendorApplied] = React.useState("");
  const [data, setData] = React.useState<PoListResponse | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let c = false;
    (async () => {
      try {
        const v = await apiFetch<VendorOpt[]>("/api/vendors/all");
        if (!c) setVendors(v);
      } catch {
        if (!c) setVendors([]);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        page: String(page),
        count: "50",
        search_keyword: searchApplied,
      });
      if (vendorApplied.trim()) {
        q.set("vendor_id", vendorApplied.trim());
      }
      const res = await apiFetch<PoListResponse>(
        `/api/inbound/purchase-orders?${q}`
      );
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, searchApplied, vendorApplied]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const applyFilters = () => {
    setPage(1);
    setSearchApplied(searchDraft);
    setVendorApplied(vendorFilter);
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-2 py-4 md:px-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <AppPageTitle
          title="Purchase Orders"
          description="All inbound purchase orders across vendors. Filter by vendor or search."
        />
        <div className="flex flex-wrap items-center gap-4 text-xs sm:justify-end">
          <div className="text-muted-foreground flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 rounded-sm bg-destructive"
                aria-hidden
              />
              Expired
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 rounded-sm bg-amber-500"
                aria-hidden
              />
              Expiring in the next 5 days
            </span>
          </div>
        </div>
      </div>

      <Card className="border-primary/10 shadow-sm">
        <CardHeader className="flex flex-col gap-3 space-y-0 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="flex min-w-[200px] flex-1 flex-col gap-2 sm:max-w-xs">
              <Label
                htmlFor="po-global-search"
                className="text-muted-foreground text-xs font-medium"
              >
                Search
              </Label>
              <Input
                id="po-global-search"
                placeholder="PO id, vendor, status, remarks…"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyFilters();
                }}
              />
            </div>
            <div className="flex min-w-[200px] flex-col gap-2 sm:max-w-xs">
              <Label
                htmlFor="po-vendor-filter"
                className="text-muted-foreground text-xs font-medium"
              >
                Vendor
              </Label>
              <select
                id="po-vendor-filter"
                className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
              >
                <option value="">All vendors</option>
                {vendors.map((v) => (
                  <option key={v.id} value={String(v.id)}>
                    {v.vendor_name ?? v.id} ({v.id})
                  </option>
                ))}
              </select>
            </div>
            <Button type="button" variant="secondary" onClick={applyFilters}>
              Apply
            </Button>
          </div>
          {canCreate ? (
            <Button type="button" asChild className="shrink-0">
              <Link href="/inbound">Create PO (pick vendor)</Link>
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 px-4 py-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}
          {!loading && (!data || data.content.length === 0) ? (
            <div className="px-4 py-8">
              <EmptyState
                title="No purchase orders"
                description="Sync from eautomate (npm run sync:vendor-pos:all) or create POs from a vendor under Inbound → Vendors."
              />
            </div>
          ) : null}
          {!loading && data && data.content.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                    <TableHead className="w-10" />
                    <TableHead className="whitespace-nowrap">PO Id</TableHead>
                    <TableHead className="whitespace-nowrap">Vendor Id</TableHead>
                    <TableHead className="min-w-[140px]">Vendor Name</TableHead>
                    <TableHead>PO status</TableHead>
                    <TableHead className="text-right">Sku Count</TableHead>
                    <TableHead className="text-right">Total Qty</TableHead>
                    <TableHead className="whitespace-nowrap">
                      Was GRN Done?
                    </TableHead>
                    <TableHead className="text-right"># GRNs</TableHead>
                    <TableHead className="text-right">Inv. Qty</TableHead>
                    <TableHead className="text-right">Acc. Qty</TableHead>
                    <TableHead className="text-right">Rej. Qty</TableHead>
                    <TableHead className="text-right">SKU %</TableHead>
                    <TableHead className="text-right">Qty %</TableHead>
                    <TableHead className="min-w-[100px]">Remarks</TableHead>
                    <TableHead className="whitespace-nowrap">Created</TableHead>
                    <TableHead className="whitespace-nowrap">Published</TableHead>
                    <TableHead className="whitespace-nowrap">
                      Expiry date
                    </TableHead>
                    <TableHead className="whitespace-nowrap">Updated</TableHead>
                    <TableHead>Created By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.content.map((row, idx) => {
                    const tone = expiryTone(row.expected_date);
                    const grnDone = row.number_of_grns > 0;
                    return (
                      <TableRow
                        key={row.po_id}
                        className={cn(
                          "hover:bg-muted/40",
                          idx % 2 === 1 ? "bg-muted/20" : ""
                        )}
                      >
                        <TableCell className="p-2">
                          <input
                            type="checkbox"
                            className="border-input size-4 rounded"
                            disabled
                            aria-label={`Select PO ${row.po_id}`}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          <Link
                            href={`/inbound/vendors/${row.vendor_id}/purchase-orders/${row.po_id}`}
                            className="text-primary font-medium underline-offset-4 hover:underline"
                          >
                            {row.po_id}
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          <Link
                            href={`/inbound/vendors/${row.vendor_id}`}
                            className="text-primary font-medium underline-offset-4 hover:underline"
                          >
                            {row.vendor_id}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate text-sm">
                          {row.vendor_name ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {displayPoStatus(row.status)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {row.sku_count}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {row.total_quantity}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-xs font-medium",
                            grnDone
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-destructive"
                          )}
                        >
                          {grnDone ? "YES" : "NO"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {row.number_of_grns}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {row.total_invoice_quantity}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {row.total_accepted_quantity}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {row.total_rejected_quantity}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {row.sku_fill_rate}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {row.quantity_fill_rate}
                        </TableCell>
                        <TableCell
                          className="text-muted-foreground max-w-[120px] truncate text-xs"
                          title={row.po_remarks ?? undefined}
                        >
                          {row.po_remarks ?? "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatDisplayDateTime(row.created_at)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {row.date_published ?? "—"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "whitespace-nowrap text-xs font-medium",
                            tone === "expired" && "text-destructive",
                            tone === "soon" && "text-amber-600 dark:text-amber-400"
                          )}
                        >
                          {row.expected_date ?? "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatDisplayDateTime(row.updated_at)}
                        </TableCell>
                        <TableCell
                          className="text-muted-foreground max-w-[120px] truncate text-xs"
                          title={row.created_by ?? undefined}
                        >
                          {row.created_by ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : null}
          {data && data.total > 0 ? (
            <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-xs">
              <span>
                Page {data.current_page} — showing {data.curr_page_count} of{" "}
                {data.total} POs
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    loading || page * data.per_page_count >= data.total
                  }
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
