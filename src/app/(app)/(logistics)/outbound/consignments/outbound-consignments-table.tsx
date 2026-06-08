"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronsUpDown, Download } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, apiUrl, getStoredToken } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CompanyNameWithLogo } from "@/components/company/company-logo";
import { cn } from "@/lib/utils";

type Row = {
  id: number;
  company_name: string | null;
  location: string | null;
  sold_via: string | null;
  po_number: string | null;
  po_type: string | null;
  consignment_status: string | null;
  invoice_number_status: string | null;
  invoice_number: string | null;
  invoice_type: string | null;
  invoice_upload_status: string | null;
  boxes_count: number | null;
  sku_count: number | null;
  total_quantity: number | null;
  transporter_name: string | null;
  vehicle_number: string | null;
  docket_number: string | null;
  created_at: string | null;
  marked_rtd_at: string | null;
  marked_rtd_by: string | null;
};

type Paginated = {
  total: number;
  current_page: number;
  per_page_count: number;
  curr_page_count: number;
  content: Row[];
};

const SORTABLE: { key: string; label: string; align?: "right" }[] = [
  { key: "company_name", label: "Company Name" },
  { key: "location", label: "Location" },
  { key: "sold_via", label: "Sold Via" },
  { key: "po_number", label: "PO Number" },
  { key: "po_type", label: "PO Type" },
  { key: "consignment_status", label: "Consignment Status" },
  { key: "invoice_number_status", label: "Invoice Number Status" },
  { key: "invoice_number", label: "Invoice Number" },
  { key: "invoice_upload_status", label: "Invoice Upload Status" },
  { key: "boxes_count", label: "Boxes Count", align: "right" },
  { key: "sku_count", label: "Sku Count", align: "right" },
  { key: "total_quantity", label: "Total Quantity", align: "right" },
  { key: "transporter_name", label: "Transporter Name" },
  { key: "vehicle_number", label: "Vehicle / Docket" },
  { key: "created_at", label: "Consignment Created At" },
  { key: "marked_rtd_at", label: "Consignment Marked RTD At" },
  { key: "marked_rtd_by", label: "Marked RTD By" },
  { key: "invoice_type", label: "Invoice Type" },
];

function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return d;
  return x.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function consignmentStatusClass(s: string | null | undefined): string {
  const u = (s ?? "").toUpperCase();
  if (u.includes("RTD")) return "text-purple-600 dark:text-purple-400 font-medium";
  return "";
}

function greenStatusClass(s: string | null | undefined): string {
  const u = (s ?? "").toUpperCase();
  if (u.includes("ASSIGN") || u.includes("UPLOAD")) {
    return "text-green-600 dark:text-green-400 font-medium";
  }
  return "";
}

function vehicleDisplay(r: Row): string {
  const v = r.vehicle_number?.trim();
  const d = r.docket_number?.trim();
  if (v && d) return `${v} / ${d}`;
  return v || d || "—";
}

function SortHeader({
  label,
  colKey,
  activeKey,
  dir,
  onSort,
  align = "left",
}: {
  label: string;
  colKey: string;
  activeKey: string;
  dir: "asc" | "desc";
  onSort: (k: string) => void;
  align?: "left" | "right";
}) {
  const active = activeKey === colKey;
  return (
    <button
      type="button"
      className={cn(
        "hover:bg-muted/80 inline-flex items-center gap-1 whitespace-nowrap rounded px-1 py-0.5 font-semibold",
        align === "right" ? "ml-auto justify-end text-right" : "text-left"
      )}
      onClick={() => onSort(colKey)}
    >
      {label}
      {active ? (
        dir === "asc" ? (
          <ArrowUp className="size-3.5 shrink-0 opacity-80" />
        ) : (
          <ArrowDown className="size-3.5 shrink-0 opacity-80" />
        )
      ) : (
        <ChevronsUpDown className="text-muted-foreground size-3.5 shrink-0 opacity-60" />
      )}
    </button>
  );
}

export function OutboundConsignmentsTable({
  invoicePending = false,
}: {
  /** When true, only consignments that still need invoice capture (same filter as mobile pending-invoices). */
  invoicePending?: boolean;
} = {}) {
  const searchParams = useSearchParams();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [applied, setApplied] = React.useState("");
  const [sort, setSort] = React.useState("created_at");
  const [dir, setDir] = React.useState<"asc" | "desc">("desc");
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [data, setData] = React.useState<Paginated | null>(null);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [downloadingBulk, setDownloadingBulk] = React.useState(false);

  const onSort = React.useCallback(
    (k: string) => {
      setSort((prev) => {
        if (prev === k) {
          setDir((d) => (d === "asc" ? "desc" : "asc"));
          return prev;
        }
        setDir("desc");
        return k;
      });
    },
    []
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams();
      q.set("page", String(page));
      q.set("count", "100");
      if (applied.trim()) q.set("search", applied.trim());
      q.set("sort", sort);
      q.set("dir", dir);
      if (invoicePending) q.set("pending_invoice", "1");
      const res = await apiFetch<Paginated>(`/api/outbound/consignments?${q}`);
      setData(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, applied, sort, dir, invoicePending]);

  React.useEffect(() => {
    const q = searchParams.get("search")?.trim();
    if (q) {
      setSearch(q);
      setApplied(q);
      setPage(1);
    }
  }, [searchParams]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.per_page_count)) : 1;
  const rows = data?.content ?? [];
  const pageIds = rows.map((r) => r.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someSelected = pageIds.some((id) => selected.has(id));
  const selectedRows = rows.filter((r) => selected.has(r.id));
  const selectedWithInvoice = selectedRows.filter(
    (r) => (r.invoice_number ?? "").trim().length > 0
  );
  const selectedMissingInvoice = selectedRows.filter(
    (r) => !(r.invoice_number ?? "").trim()
  );
  const canBulkDownload =
    selectedWithInvoice.length > 0 && selectedMissingInvoice.length === 0;

  function toggleAll() {
    if (allSelected) {
      setSelected((prev) => {
        const s = new Set(prev);
        pageIds.forEach((id) => s.delete(id));
        return s;
      });
    } else {
      setSelected((prev) => {
        const s = new Set(prev);
        pageIds.forEach((id) => s.add(id));
        return s;
      });
    }
  }

  function toggleRow(id: number) {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  async function handleBulkDownloadInvoiceData() {
    if (selectedRows.length === 0) return;
    if (selectedMissingInvoice.length > 0) {
      toast.error(
        `Assign invoice number first for consignment id(s): ${selectedMissingInvoice.map((r) => r.id).join(", ")}`
      );
      return;
    }
    setDownloadingBulk(true);
    try {
      const token = getStoredToken();
      const headers = new Headers({ "Content-Type": "application/json" });
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const res = await fetch(apiUrl("/api/outbound/consignments/bulk-invoice-excel"), {
        method: "POST",
        headers,
        body: JSON.stringify({ ids: selectedWithInvoice.map((r) => r.id) }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? res.statusText);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bulk-invoice-data-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded invoice data for ${selectedWithInvoice.length} consignment(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloadingBulk(false);
    }
  }

  return (
    <Card className="border-primary/10 shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-muted-foreground text-sm">
          {data ? (
            <>
              Showing {data.curr_page_count} of {data.total} consignment(s)
              {invoicePending ? " pending invoice" : ""}.
            </>
          ) : loading ? (
            "Loading…"
          ) : (
            "—"
          )}
        </p>
        <div className="flex w-full max-w-sm flex-col gap-2">
          <label className="text-muted-foreground text-xs font-medium" htmlFor="c-search">
            Search
          </label>
          <div className="flex gap-2">
            <Input
              id="c-search"
              placeholder="PO, company, location, invoice…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setApplied(search);
              }}
            />
            <Button type="button" variant="secondary" onClick={() => setApplied(search)}>
              Apply
            </Button>
          </div>
        </div>
        {invoicePending && someSelected ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-sm">
              {selected.size} selected
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={!canBulkDownload || downloadingBulk || loading}
              title={
                selectedMissingInvoice.length > 0
                  ? "All selected rows must have an invoice number assigned"
                  : undefined
              }
              onClick={() => void handleBulkDownloadInvoiceData()}
            >
              <Download className="size-3.5" />
              {downloadingBulk ? "Downloading…" : "Download invoice data"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-muted-foreground text-xs"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        {err && (
          <p className="text-destructive px-6 py-4 text-sm" role="alert">
            {err}
          </p>
        )}
        {loading && !data ? (
          <div className="space-y-2 px-6 py-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="max-w-full overflow-x-auto">
            <table className="w-max min-w-full border-collapse text-left text-xs">
              <colgroup>
                {invoicePending ? <col className="w-[1%]" /> : null}
                <col className="w-[1%]" />
                {SORTABLE.map((c) => (
                  <col
                    key={c.key}
                    className={cn(c.align === "right" && "tabular-nums")}
                  />
                ))}
              </colgroup>
              <thead>
                <tr className="bg-muted/50 border-b">
                  {invoicePending ? (
                    <th className="align-top whitespace-nowrap px-2 py-2">
                      <input
                        type="checkbox"
                        className="accent-primary cursor-pointer"
                        aria-label="Select all on page"
                        checked={allSelected}
                        onChange={toggleAll}
                      />
                    </th>
                  ) : null}
                  <th className="align-top whitespace-nowrap px-2 py-2">
                    <SortHeader
                      label="Consignment ID"
                      colKey="id"
                      activeKey={sort}
                      dir={dir}
                      onSort={onSort}
                    />
                  </th>
                  {SORTABLE.map((c) => (
                    <th
                      key={c.key}
                      className={cn(
                        "align-top whitespace-nowrap px-2 py-2",
                        c.align === "right" && "text-right"
                      )}
                    >
                      <SortHeader
                        label={c.label}
                        colKey={c.key}
                        activeKey={sort}
                        dir={dir}
                        onSort={onSort}
                        align={c.align === "right" ? "right" : "left"}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b hover:bg-muted/30",
                      invoicePending && selected.has(row.id) && "bg-primary/5"
                    )}
                  >
                    {invoicePending ? (
                      <td className="align-top whitespace-nowrap px-2 py-2">
                        <input
                          type="checkbox"
                          className="accent-primary cursor-pointer"
                          aria-label={`Select consignment ${row.id}`}
                          checked={selected.has(row.id)}
                          onChange={() => toggleRow(row.id)}
                        />
                      </td>
                    ) : null}
                    <td className="align-top whitespace-nowrap px-2 py-2">
                      <Link
                        href={`/outbound/consignments/${row.id}`}
                        className="text-primary font-medium underline-offset-4 hover:underline"
                      >
                        {row.id}
                      </Link>
                    </td>
                    <td className="align-top px-2 py-2">
                      <CompanyNameWithLogo name={row.company_name} />
                    </td>
                    <td className="align-top px-2 py-2">{row.location ?? "—"}</td>
                    <td className="align-top px-2 py-2">{row.sold_via ?? "—"}</td>
                    <td className="align-top px-2 py-2">{row.po_number ?? "—"}</td>
                    <td className="align-top px-2 py-2">{row.po_type ?? "—"}</td>
                    <td
                      className={cn(
                        "align-top px-2 py-2",
                        consignmentStatusClass(row.consignment_status)
                      )}
                    >
                      {row.consignment_status ?? "—"}
                    </td>
                    <td
                      className={cn(
                        "align-top px-2 py-2",
                        greenStatusClass(row.invoice_number_status)
                      )}
                    >
                      {row.invoice_number_status ?? "—"}
                    </td>
                    <td className="align-top px-2 py-2">{row.invoice_number ?? "—"}</td>
                    <td
                      className={cn(
                        "align-top px-2 py-2",
                        greenStatusClass(row.invoice_upload_status)
                      )}
                    >
                      {row.invoice_upload_status ?? "—"}
                    </td>
                    <td className="align-top px-2 py-2 text-right tabular-nums">
                      {row.boxes_count != null ? row.boxes_count : "—"}
                    </td>
                    <td className="align-top px-2 py-2 text-right tabular-nums">
                      {row.sku_count != null ? row.sku_count : "—"}
                    </td>
                    <td className="align-top px-2 py-2 text-right tabular-nums">
                      {row.total_quantity != null ? row.total_quantity : "—"}
                    </td>
                    <td className="align-top px-2 py-2">{row.transporter_name ?? "—"}</td>
                    <td
                      className="align-top max-w-[11rem] truncate px-2 py-2"
                      title={vehicleDisplay(row)}
                    >
                      {vehicleDisplay(row)}
                    </td>
                    <td className="align-top whitespace-nowrap px-2 py-2">
                      {fmtDateTime(row.created_at)}
                    </td>
                    <td className="align-top whitespace-nowrap px-2 py-2">
                      {fmtDateTime(row.marked_rtd_at)}
                    </td>
                    <td className="text-muted-foreground align-top px-2 py-2">
                      {row.marked_rtd_by ?? "—"}
                    </td>
                    <td className="align-top px-2 py-2">{row.invoice_type ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t text-sm">
        <span className="text-muted-foreground">
          Page {data?.current_page ?? page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || !data || page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
