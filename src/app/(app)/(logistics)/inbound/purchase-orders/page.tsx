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
import { AppPageTitle } from "@/components/layout/app-page-shell";
import { cn } from "@/lib/utils";
import {
  buildInboundPurchaseOrdersQuery,
  displayPoStatus,
  expiryTone,
  formatExpiryDateDisplay,
  formatInboundListDateTime as formatDisplayDateTime,
  inboundPoRowsToCsv,
} from "@/lib/inboundPoGrnPendingUi";
import { FillRateBar } from "@/components/ui/fill-rate-bar";
import { ChevronDown, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

type ColumnMultiSelectProps = {
  readonly options: readonly { id: number; label: string }[];
  readonly selected: ReadonlySet<number>;
  readonly onToggle: (id: number) => void;
  readonly onClear: () => void;
  readonly placeholder: string;
  readonly ariaLabel: string;
};

function ColumnMultiSelect({
  options,
  selected,
  onToggle,
  onClear,
  placeholder,
  ariaLabel,
}: ColumnMultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  React.useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options.slice();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(needle) ||
        String(o.id).toLowerCase().includes(needle)
    );
  }, [options, q]);

  const label =
    selected.size > 0
      ? `${selected.size} selected`
      : placeholder;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        type="button"
        aria-label={ariaLabel}
        className="border-input bg-background hover:bg-accent/50 ring-offset-background focus-visible:ring-ring flex h-8 w-full items-center gap-1.5 rounded-md border px-2 text-left font-normal text-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronDown className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="bottom"
        className="max-w-[min(320px,calc(100vw-2rem))] min-w-[200px] p-2"
      >
        <div
          className="px-0 pb-2"
          onPointerDown={(e) => {
            /* keep menu open while interacting with search */
            e.preventDefault();
          }}
        >
          <Input
            aria-label={`${ariaLabel} search`}
            className="h-8 text-xs"
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="max-h-[min(240px,40vh)] overflow-y-auto pr-1">
          <DropdownMenuGroup>
            {filtered.length === 0 ? (
              <div className="text-muted-foreground px-1.5 py-2 text-xs">
                No matches
              </div>
            ) : (
              filtered.map((opt) => (
                <DropdownMenuCheckboxItem
                  key={opt.id}
                  checked={selected.has(opt.id)}
                  onCheckedChange={() => {
                    onToggle(opt.id);
                  }}
                  inset
                  className="cursor-pointer text-xs"
                >
                  {opt.label}
                </DropdownMenuCheckboxItem>
              ))
            )}
          </DropdownMenuGroup>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-muted-foreground justify-center text-xs font-normal"
          onClick={() => {
            onClear();
          }}
        >
          Clear
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function downloadSelectedCsv(rows: PoRow[]): void {
  const csv = inboundPoRowsToCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `purchase_orders_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function InboundPurchaseOrdersPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("purchase_orders", "create");

  const [vendors, setVendors] = React.useState<VendorOpt[]>([]);
  const [page, setPage] = React.useState(1);
  const [searchDraft, setSearchDraft] = React.useState("");
  const [searchApplied, setSearchApplied] = React.useState("");
  const [poIdColDraft, setPoIdColDraft] = React.useState("");
  const [poIdColApplied, setPoIdColApplied] = React.useState("");
  const [appliedVendorIds, setAppliedVendorIds] = React.useState<number[]>([]);
  const [selectedPoIds, setSelectedPoIds] = React.useState<Set<number>>(
    () => new Set()
  );
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
      const qs = buildInboundPurchaseOrdersQuery({
        page,
        count: 50,
        searchKeyword: searchApplied,
        vendorIds: appliedVendorIds,
        poIdFilter: poIdColApplied,
      });
      const res = await apiFetch<PoListResponse>(
        `/api/inbound/purchase-orders?${qs}`
      );
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, searchApplied, appliedVendorIds, poIdColApplied]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const clearSelection = React.useCallback(() => {
    setSelectedPoIds(new Set());
  }, []);

  React.useEffect(() => {
    clearSelection();
  }, [page, searchApplied, appliedVendorIds, poIdColApplied, clearSelection]);

  const appliedVendorSet = React.useMemo(
    () => new Set(appliedVendorIds),
    [appliedVendorIds]
  );

  const vendorIdOptions = React.useMemo(
    () => vendors.map((v) => ({ id: v.id, label: String(v.id) })),
    [vendors]
  );

  const vendorNameOptions = React.useMemo(
    () =>
      vendors.map((v) => ({
        id: v.id,
        label: v.vendor_name?.trim() ? v.vendor_name : String(v.id),
      })),
    [vendors]
  );

  const toggleAppliedVendor = React.useCallback((id: number) => {
    setPage(1);
    setAppliedVendorIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return [...s].sort((a, b) => a - b);
    });
  }, []);

  const clearAppliedVendors = React.useCallback(() => {
    setPage(1);
    setAppliedVendorIds([]);
  }, []);

  const applyFilters = () => {
    setPage(1);
    setSearchApplied(searchDraft);
    setPoIdColApplied(poIdColDraft.trim());
  };

  const selectedRows = React.useMemo(() => {
    if (!data?.content.length) return [];
    return data.content.filter((r) => selectedPoIds.has(r.po_id));
  }, [data, selectedPoIds]);

  const rows = data?.content;
  const allPageSelected =
    Array.isArray(rows) &&
    rows.length > 0 &&
    rows.every((r) => selectedPoIds.has(r.po_id));

  const somePageSelected =
    Array.isArray(rows) &&
    rows.length > 0 &&
    rows.some((r) => selectedPoIds.has(r.po_id));

  function togglePo(poId: number, checked: boolean) {
    setSelectedPoIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(poId);
      else next.delete(poId);
      return next;
    });
  }

  function toggleSelectAllPage() {
    if (!data?.content.length) return;
    if (allPageSelected) {
      setSelectedPoIds((prev) => {
        const next = new Set(prev);
        for (const r of data.content) next.delete(r.po_id);
        return next;
      });
    } else {
      setSelectedPoIds((prev) => {
        const next = new Set(prev);
        for (const r of data.content) next.add(r.po_id);
        return next;
      });
    }
  }

  function handleDownloadSelected() {
    if (selectedRows.length === 0) {
      toast.error("Select at least one purchase order");
      return;
    }
    downloadSelectedCsv(selectedRows);
    toast.success(`Downloaded ${selectedRows.length} row(s)`);
  }

  const headerSelectRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const el = headerSelectRef.current;
    if (el) {
      el.indeterminate =
        Boolean(somePageSelected) && Boolean(data?.content.length) && !allPageSelected;
    }
  }, [somePageSelected, allPageSelected, data?.content.length]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-2 py-4 md:px-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <AppPageTitle
          title="Purchase Orders"
          description="All inbound purchase orders across vendors. Filter by vendor or search."
        />
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 shrink-0 rounded-sm bg-destructive"
                aria-hidden
              />
              Expired
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 shrink-0 rounded-sm bg-amber-500"
                aria-hidden
              />
              Expiring in the next 5 days
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 shrink-0 rounded-sm bg-emerald-500"
                aria-hidden
              />
              On track
            </span>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="shrink-0 gap-2"
            disabled={selectedRows.length === 0}
            onClick={handleDownloadSelected}
          >
            <Download className="h-4 w-4" />
            Download Purchase Orders Data
          </Button>
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                    <TableHead className="w-10 p-2">
                      <input
                        ref={headerSelectRef}
                        type="checkbox"
                        className="border-input size-4 rounded"
                        checked={allPageSelected}
                        onChange={() => toggleSelectAllPage()}
                        aria-label="Select all POs on this page"
                      />
                    </TableHead>
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
                  <TableRow className="bg-muted/40 border-b">
                    <TableHead className="p-1" />
                    <TableHead className="min-w-[88px] p-1">
                      <Input
                        className="h-8 text-xs"
                        placeholder="Filter…"
                        value={poIdColDraft}
                        onChange={(e) => setPoIdColDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") applyFilters();
                        }}
                        aria-label="Filter by PO id"
                      />
                    </TableHead>
                    <TableHead className="min-w-[112px] p-1">
                      <ColumnMultiSelect
                        options={vendorIdOptions}
                        selected={appliedVendorSet}
                        onToggle={toggleAppliedVendor}
                        onClear={clearAppliedVendors}
                        placeholder="All vendors"
                        ariaLabel="Filter by vendor id"
                      />
                    </TableHead>
                    <TableHead className="min-w-[144px] p-1">
                      <ColumnMultiSelect
                        options={vendorNameOptions}
                        selected={appliedVendorSet}
                        onToggle={toggleAppliedVendor}
                        onClear={clearAppliedVendors}
                        placeholder="All vendors"
                        ariaLabel="Filter by vendor name"
                      />
                    </TableHead>
                    <TableHead
                      colSpan={16}
                      className="text-muted-foreground p-2 text-left align-bottom text-[10px] font-normal"
                    >
                      Vendor filters apply immediately when you toggle; PO id and
                      global Search use <strong>Apply</strong>.
                    </TableHead>
                  </TableRow>
              </TableHeader>
              <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 20 }).map((__, j) => (
                          <TableCell key={j} className="py-2">
                            <Skeleton className="h-5 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : !data || data.content.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={20}
                        className="text-muted-foreground py-10 text-center text-sm"
                      >
                        No purchase orders match the current filters.
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {!loading && data && data.content.map((row, idx) => {
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
                            checked={selectedPoIds.has(row.po_id)}
                            onChange={(e) =>
                              togglePo(row.po_id, e.target.checked)
                            }
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
                        <TableCell className="px-2 py-1.5">
                          <FillRateBar value={row.sku_fill_rate} />
                        </TableCell>
                        <TableCell className="px-2 py-1.5">
                          <FillRateBar value={row.quantity_fill_rate} />
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
                            tone === "soon" &&
                              "text-amber-600 dark:text-amber-400",
                            tone === "ok" &&
                              "text-emerald-600 dark:text-emerald-400",
                            tone === "unknown" && "text-muted-foreground"
                          )}
                        >
                          {row.expected_date
                            ? formatExpiryDateDisplay(row.expected_date)
                            : "—"}
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
