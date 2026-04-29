"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { apiFetch, apiUrl, getStoredToken } from "@/lib/api-browser";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AppPageTitle } from "@/components/layout/app-page-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import {
  InboundVendorListingsTable,
  type VendorListingRow,
} from "../inbound-vendor-listings-table";
import {
  VendorDetailsCard,
  type VendorDetail,
} from "../vendor-details-card";

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

type PoLineDraft = { key: string; sku_id: string; quantity: string };

function InboundVendorHubBody() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const canCreatePo = hasPermission("purchase_orders", "create");

  const id = String(params.id ?? "");
  const tabParam = searchParams.get("tab");
  const tab =
    tabParam === "details" || tabParam === "purchase-orders"
      ? tabParam
      : "listings";

  const setTab = React.useCallback(
    (v: string) => {
      const next =
        v === "details" || v === "purchase-orders" ? v : "listings";
      router.replace(`${pathname}?tab=${encodeURIComponent(next)}`, {
        scroll: false,
      });
    },
    [pathname, router]
  );

  const [data, setData] = React.useState<VendorDetail | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [poPage, setPoPage] = React.useState(1);
  const [poSearchDraft, setPoSearchDraft] = React.useState("");
  const [poSearchApplied, setPoSearchApplied] = React.useState("");
  const [poData, setPoData] = React.useState<PoListResponse | null>(null);
  const [poLoading, setPoLoading] = React.useState(false);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [createSubmitting, setCreateSubmitting] = React.useState(false);
  const [expectedDateDraft, setExpectedDateDraft] = React.useState("");
  const [expectedDateConfirmed, setExpectedDateConfirmed] = React.useState("");
  const [poRemarks, setPoRemarks] = React.useState("");
  const [lineDrafts, setLineDrafts] = React.useState<PoLineDraft[]>(() => [
    { key: crypto.randomUUID(), sku_id: "", quantity: "1" },
  ]);
  const [vendorSkus, setVendorSkus] = React.useState<VendorListingRow[]>([]);

  React.useEffect(() => {
    setPoPage(1);
    setPoSearchApplied("");
    setPoSearchDraft("");
    setPoData(null);
  }, [id]);

  React.useEffect(() => {
    let c = false;
    setLoading(true);
    (async () => {
      try {
        const res = await apiFetch<VendorDetail>(
          `/api/vendors/${encodeURIComponent(id)}`
        );
        if (!c) setData(res);
      } catch (e) {
        if (!c) {
          setData(null);
          toast.error(e instanceof Error ? e.message : "Not found");
        }
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [id]);

  const loadPos = React.useCallback(async () => {
    setPoLoading(true);
    try {
      const q = new URLSearchParams({
        vendor_id: id,
        page: String(poPage),
        count: "50",
        search_keyword: poSearchApplied,
      });
      const res = await apiFetch<PoListResponse>(
        `/api/inbound/vendor-purchase-orders?${q}`
      );
      setPoData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load POs");
      setPoData(null);
    } finally {
      setPoLoading(false);
    }
  }, [id, poPage, poSearchApplied]);

  React.useEffect(() => {
    if (tab !== "purchase-orders") return;
    void loadPos();
  }, [tab, loadPos]);

  const loadSkusForDialog = React.useCallback(async () => {
    try {
      const res = await apiFetch<VendorListingRow[]>(
        `/api/vendors/listings/${encodeURIComponent(id)}`
      );
      setVendorSkus(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load SKUs");
    }
  }, [id]);

  React.useEffect(() => {
    if (createOpen) void loadSkusForDialog();
  }, [createOpen, loadSkusForDialog]);

  const resetCreateForm = () => {
    setExpectedDateDraft("");
    setExpectedDateConfirmed("");
    setPoRemarks("");
    setLineDrafts([{ key: crypto.randomUUID(), sku_id: "", quantity: "1" }]);
  };

  const updateLineDraft = React.useCallback(
    (key: string, patch: Partial<Pick<PoLineDraft, "sku_id" | "quantity">>) => {
      setLineDrafts((rows) =>
        rows.map((r) => (r.key === key ? { ...r, ...patch } : r))
      );
    },
    []
  );

  const removeLineDraft = React.useCallback((key: string) => {
    setLineDrafts((rows) => rows.filter((r) => r.key !== key));
  }, []);

  const downloadPoCsv = async () => {
    try {
      const token = getStoredToken();
      const headers = new Headers();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const q = new URLSearchParams({
        vendor_id: id,
        search_keyword: poSearchApplied,
      });
      const res = await fetch(
        apiUrl(`/api/inbound/vendor-purchase-orders/export?${q}`),
        { headers }
      );
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? res.statusText);
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `vendor_${id}_purchase_orders.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Downloaded PO list CSV");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  };

  const submitCreatePo = async () => {
    if (!expectedDateConfirmed.trim()) {
      toast.error("Set the expected delivery date using Set");
      return;
    }
    const lines: { sku_id: string; quantity: number }[] = [];
    for (const row of lineDrafts) {
      const sku = row.sku_id.trim();
      const q = Number(row.quantity);
      if (!sku) continue;
      if (!Number.isFinite(q) || q < 1 || !Number.isInteger(q)) {
        toast.error("Each line needs a valid positive integer quantity");
        return;
      }
      lines.push({ sku_id: sku, quantity: q });
    }
    if (lines.length === 0) {
      toast.error("Add at least one line with a SKU");
      return;
    }
    setCreateSubmitting(true);
    try {
      await apiFetch<PoRow>(`/api/inbound/vendor-purchase-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor_id: Number(id),
          expected_date: expectedDateConfirmed.trim(),
          po_remarks: poRemarks.trim() || undefined,
          lines,
        }),
      });
      toast.success("Purchase order created");
      setCreateOpen(false);
      resetCreateForm();
      void loadPos();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreateSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[1600px] space-y-4 px-2 py-4 md:px-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-4xl px-2 py-4 md:px-4">
        <p className="text-muted-foreground">Vendor not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/inbound">Back to inbound</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 px-2 py-4 md:px-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
          <Link href="/inbound">← Inbound</Link>
        </Button>
        {canCreatePo ? (
          <Button
            type="button"
            className="w-full shrink-0 sm:w-auto"
            onClick={() => setCreateOpen(true)}
          >
            Create New Purchase Order
          </Button>
        ) : null}
      </div>

      <AppPageTitle
        title={data.vendor_name || "Vendor"}
        description={`Vendor ID ${data.id} — listings, purchase orders, and contact details.`}
      />

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList
          variant="line"
          className="mb-2 w-full flex-wrap justify-start gap-0 sm:w-auto"
        >
          <TabsTrigger value="listings">Listings</TabsTrigger>
          <TabsTrigger value="purchase-orders">Purchase orders</TabsTrigger>
          <TabsTrigger value="details">Contact details</TabsTrigger>
        </TabsList>

        <TabsContent value="listings" className="mt-4">
          <InboundVendorListingsTable vendorId={id} />
        </TabsContent>

        <TabsContent value="purchase-orders" className="mt-4 space-y-4">
          <Card className="border-primary/10 shadow-sm">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex w-full flex-col gap-2 sm:max-w-md">
                <Label
                  htmlFor="po-search"
                  className="text-muted-foreground text-xs font-medium"
                >
                  Search POs
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="po-search"
                    placeholder="PO id, status, remarks…"
                    value={poSearchDraft}
                    onChange={(e) => setPoSearchDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setPoPage(1);
                        setPoSearchApplied(poSearchDraft);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setPoPage(1);
                      setPoSearchApplied(poSearchDraft);
                    }}
                  >
                    Apply
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title="Download PO list CSV"
                    disabled={
                      poLoading || !poData || poData.total === 0
                    }
                    onClick={() => void downloadPoCsv()}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {poLoading ? (
                <div className="space-y-2 px-6 py-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : null}
              {!poLoading && (!poData || poData.content.length === 0) ? (
                <div className="px-6 py-8">
                  <EmptyState
                    title="No purchase orders"
                    description="Create a PO or run the vendor PO sync to populate this list."
                  />
                </div>
              ) : null}
              {!poLoading && poData && poData.content.length > 0 ? (
                <div className="overflow-x-auto px-2 pb-4 md:px-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="whitespace-nowrap">PO</TableHead>
                        <TableHead className="whitespace-nowrap">
                          Expected
                        </TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">SKUs</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">GRNs</TableHead>
                        <TableHead className="text-right">Inv.</TableHead>
                        <TableHead className="text-right">Acc.</TableHead>
                        <TableHead className="text-right">Rej.</TableHead>
                        <TableHead className="text-right">SKU %</TableHead>
                        <TableHead className="text-right">Qty %</TableHead>
                        <TableHead className="whitespace-nowrap">
                          Published
                        </TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {poData.content.map((row) => (
                        <TableRow key={row.po_id} className="hover:bg-muted/30">
                          <TableCell className="font-mono text-xs">
                            <Link
                              href={`/inbound/vendors/${encodeURIComponent(id)}/purchase-orders/${row.po_id}`}
                              className="text-primary font-medium underline-offset-4 hover:underline"
                            >
                              {row.po_id}
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                            {row.expected_date ?? "—"}
                          </TableCell>
                          <TableCell className="max-w-[120px] truncate text-xs">
                            {row.status ?? "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {row.sku_count}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {row.total_quantity}
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
                          <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                            {row.date_published ?? "—"}
                          </TableCell>
                          <TableCell
                            className="text-muted-foreground max-w-[140px] truncate text-xs"
                            title={row.created_by ?? undefined}
                          >
                            {row.created_by ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
              {poData && poData.total > 0 ? (
                <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-xs">
                  <span>
                    Page {poData.current_page} — {poData.curr_page_count} of{" "}
                    {poData.total} POs
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={poPage <= 1 || poLoading}
                      onClick={() => setPoPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        poLoading ||
                        poPage * poData.per_page_count >= poData.total
                      }
                      onClick={() => setPoPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="mt-4 space-y-6">
          <VendorDetailsCard data={data} vendorId={id} onSaved={setData} />
        </TabsContent>
      </Tabs>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent className="max-h-[min(90vh,640px)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Purchase Order ( Vendor ID : {id} )</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="po-exp">Expected Delivery Date</Label>
              <div className="flex flex-wrap items-end gap-2">
                <Input
                  id="po-exp"
                  className="min-w-[10rem] flex-1"
                  type="date"
                  value={expectedDateDraft}
                  onChange={(e) => setExpectedDateDraft(e.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (!expectedDateDraft.trim()) {
                      toast.error("Choose a date first");
                      return;
                    }
                    setExpectedDateConfirmed(expectedDateDraft.trim());
                  }}
                >
                  Set
                </Button>
              </div>
              {expectedDateConfirmed ? (
                <Badge variant="outline" className="border-green-600/60 text-green-700 dark:text-green-400">
                  Expected delivery: {expectedDateConfirmed}
                </Badge>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Pick a date, then click Set to confirm.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="po-rm">PO remarks</Label>
              <textarea
                id="po-rm"
                rows={3}
                className="border-input bg-background ring-offset-background focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                value={poRemarks}
                onChange={(e) => setPoRemarks(e.target.value)}
                placeholder="Notes for this PO"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Line items</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setLineDrafts((rows) => [
                      ...rows,
                      {
                        key: crypto.randomUUID(),
                        sku_id: "",
                        quantity: "1",
                      },
                    ])
                  }
                >
                  Add line
                </Button>
              </div>
              {lineDrafts.map((row) => (
                <div
                  key={row.key}
                  className="grid grid-cols-[1fr_5rem_auto] items-end gap-2"
                >
                  <div className="space-y-1">
                    <Label className="text-xs">SKU</Label>
                    <select
                      className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                      value={row.sku_id}
                      onChange={(e) =>
                        updateLineDraft(row.key, { sku_id: e.target.value })
                      }
                    >
                      <option value="">Select SKU…</option>
                      {vendorSkus.map((vs) => (
                        <option key={vs.sku_id} value={vs.sku_id}>
                          {vs.sku_id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Qty</Label>
                    <Input
                      inputMode="numeric"
                      value={row.quantity}
                      onChange={(e) =>
                        updateLineDraft(row.key, { quantity: e.target.value })
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive shrink-0"
                    disabled={lineDrafts.length <= 1}
                    onClick={() => removeLineDraft(row.key)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="flex-row gap-3 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={createSubmitting}
              onClick={() => void submitCreatePo()}
            >
              {createSubmitting ? "Saving…" : "Create PO"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HubFallback() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-2 py-4 md:px-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-full max-w-md" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function InboundVendorDetailPage() {
  return (
    <Suspense fallback={<HubFallback />}>
      <InboundVendorHubBody />
    </Suspense>
  );
}
