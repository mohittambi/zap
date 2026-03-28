"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type LotRow = Record<string, unknown>;

function listingOf(r: LotRow): LotRow | null {
  const L = r.listing;
  if (L && typeof L === "object" && !Array.isArray(L)) return L as LotRow;
  return null;
}

/** PO line / vendor fields — never read from nested `listing`. */
function pickRoot(r: LotRow, keys: string[]): string {
  for (const k of keys) {
    const v = r[k];
    if (v != null && String(v).trim() !== "") return String(v);
  }
  return "";
}

function pickNumRoot(r: LotRow, keys: string[]): number | null {
  for (const k of keys) {
    const v = r[k];
    if (v == null || v === "") continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Root first, then `listing` (SKU images, available_quantity, etc.). */
function pickRow(r: LotRow, keys: string[]): string {
  const L = listingOf(r);
  for (const k of keys) {
    const v = r[k];
    if (v != null && String(v).trim() !== "") return String(v);
    if (L) {
      const v2 = L[k];
      if (v2 != null && String(v2).trim() !== "") return String(v2);
    }
  }
  return "";
}

function pickNumRow(r: LotRow, keys: string[]): number | null {
  const L = listingOf(r);
  for (const k of keys) {
    for (const obj of L ? [r, L] : [r]) {
      const v = obj[k];
      if (v == null || v === "") continue;
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function pickImageUrl(r: LotRow): string {
  return pickRow(r, [
    "thumb_img_url",
    "thumbnail_url",
    "product_image",
    "image_url",
    "img_hd",
    "img_white",
    "img_wdim",
    "img_link1",
    "img_link2",
    "image",
    "sku_image",
    "hd_image_url",
  ]);
}

function skuIdOf(r: LotRow): string {
  return pickRow(r, ["sku_id", "skuId", "Sku Id", "sku"]);
}

function poIdOf(r: LotRow): string {
  return pickRoot(r, ["po_id", "poId", "Po Id", "purchase_order_id"]);
}

function vendorIdOf(r: LotRow): string {
  return pickRoot(r, ["vendor_id", "vendorId", "Vendor Id"]);
}

function statusOf(r: LotRow): string {
  return pickRoot(r, ["status", "po_status", "PO status", "poStatus"]);
}

function vendorNameOf(r: LotRow): string {
  return pickRoot(r, ["vendor_name", "vendorName", "Vendor Name"]);
}

function qtyOf(r: LotRow): string {
  const q = pickRow(r, [
    "order_placed_quantity",
    "required_quantity",
    "ordered_quantity",
    "quantity",
    "demand",
    "Order Placed Quantity",
  ]);
  if (q) return q;
  const n = pickNumRow(r, [
    "order_placed_quantity",
    "required_quantity",
    "quantity",
    "demand",
  ]);
  return n != null ? String(n) : "—";
}

function expiryOf(r: LotRow): string {
  return pickRoot(r, [
    "expiry_date",
    "expected_date",
    "Expiry Date",
    "expiryDate",
  ]);
}

function createdAtOf(r: LotRow): string {
  return pickRoot(r, ["created_at", "date_created", "Date Created", "createdAt"]);
}

function createdByOf(r: LotRow): string {
  return pickRoot(r, ["created_by", "Created by", "createdBy"]);
}

function lineIdOf(r: LotRow): string {
  return pickRoot(r, ["id", "line_id", "lot_listing_id"]);
}

function updatedAtOf(r: LotRow): string {
  return pickRoot(r, ["updated_at", "updatedAt"]);
}

function fulfilledQtyDisplay(r: LotRow): string {
  const n = pickNumRoot(r, ["fulfilled_quantity", "fulfilledQuantity"]);
  return n != null ? String(n) : "—";
}

function costReceivedDisplay(r: LotRow): string {
  const n = pickNumRoot(r, ["cost_price_received", "costPriceReceived"]);
  return n != null ? String(n) : "—";
}

function availQtyDisplay(r: LotRow): string {
  const n = pickNumRow(r, ["available_quantity", "availableQuantity"]);
  return n != null ? String(n) : "—";
}

type BinRow = Record<string, unknown>;

function binsOf(r: LotRow): BinRow[] {
  const L = listingOf(r);
  if (!L) return [];
  const b = L.bins;
  if (!Array.isArray(b)) return [];
  return b.filter(
    (x): x is BinRow => x != null && typeof x === "object" && !Array.isArray(x)
  ) as BinRow[];
}

function listingField(r: LotRow, keys: string[]): string {
  const L = listingOf(r);
  if (!L) return "";
  for (const k of keys) {
    const v = L[k];
    if (v != null && String(v).trim() !== "") return String(v);
  }
  return "";
}

function listingNum(r: LotRow, keys: string[]): number | null {
  const L = listingOf(r);
  if (!L) return null;
  for (const k of keys) {
    const v = L[k];
    if (v == null || v === "") continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function parseExpectedDateOnly(s: string): Date | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
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
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function expiryTone(s: string): "expired" | "soon" | "ok" | "unknown" {
  const d = parseExpectedDateOnly(s);
  if (!d) return "unknown";
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

const displayFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function formatDisplayDateTime(raw: string): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    const m = raw.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})/i);
    if (m) return raw;
    return raw;
  }
  return displayFormatter.format(d);
}

function formatExpiryDisplay(raw: string): string {
  if (!raw) return "—";
  const d = parseExpectedDateOnly(raw);
  if (d && !Number.isNaN(d.getTime())) {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(d);
  }
  const tryIso = new Date(raw);
  if (!Number.isNaN(tryIso.getTime())) {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(tryIso);
  }
  return raw;
}

function displayPoStatus(status: string): string {
  if (!status) return "—";
  if (status === "PENDING_PUBLISHED") return "Published";
  if (status === "MARKED_CANCELLED") return "Cancelled";
  if (status === "MARKED_MODIFICATION") return "Modification";
  return status.replace(/_/g, " ");
}

function parseLotResponse(data: unknown): {
  rows: LotRow[];
  total: number;
  currentPage: number;
  perPage: number;
} {
  if (Array.isArray(data)) {
    return {
      rows: data as LotRow[],
      total: data.length,
      currentPage: 1,
      perPage: data.length || 100,
    };
  }
  if (!data || typeof data !== "object") {
    return { rows: [], total: 0, currentPage: 1, perPage: 100 };
  }
  const o = data as Record<string, unknown>;
  const arr =
    (Array.isArray(o.content) ? o.content : null) ??
    (Array.isArray(o.data) ? o.data : null) ??
    (Array.isArray(o.lot_listings) ? o.lot_listings : null);
  if (!arr) {
    return { rows: [], total: 0, currentPage: 1, perPage: 100 };
  }
  return {
    rows: arr as LotRow[],
    total: Number(o.total ?? arr.length) || arr.length,
    currentPage: Number(o.current_page ?? 1) || 1,
    perPage: Number(o.per_page_count ?? o.count ?? 100) || 100,
  };
}

function rowKey(r: LotRow, i: number): string {
  const line = lineIdOf(r);
  if (line) return `line-${line}`;
  const sku = skuIdOf(r);
  const po = poIdOf(r);
  if (sku || po) return `${sku}-${po}-${i}`;
  return `row-${i}`;
}

function LotDetailsSheet({
  row,
  open,
  onOpenChange,
}: {
  row: LotRow | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const sku = row ? skuIdOf(row) : "";
  const category = row ? listingField(row, ["category"]) : "";
  const description = row ? listingField(row, ["description"]) : "";
  const dimension = row ? listingField(row, ["dimension"]) : "";
  const material = row ? listingField(row, ["material_info", "materialInfo"]) : "";
  const bulk = row ? listingNum(row, ["bulk_price", "bulkPrice"]) : null;
  const avail = row ? pickNumRow(row, ["available_quantity", "availableQuantity"]) : null;
  const bins = row ? binsOf(row) : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Listing details</SheetTitle>
          <SheetDescription>
            {sku ? (
              <>
                SKU{" "}
                <Link
                  href={`/listings/${encodeURIComponent(sku)}`}
                  className="text-primary font-medium underline-offset-4 hover:underline"
                >
                  {sku}
                </Link>
              </>
            ) : (
              "Nested listing from eautomate"
            )}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4 pb-6">
          <dl className="grid gap-3 text-sm">
            {category ? (
              <div>
                <dt className="text-muted-foreground font-medium">Category</dt>
                <dd>{category}</dd>
              </div>
            ) : null}
            {material ? (
              <div>
                <dt className="text-muted-foreground font-medium">Material</dt>
                <dd>{material}</dd>
              </div>
            ) : null}
            {dimension ? (
              <div>
                <dt className="text-muted-foreground font-medium">Dimension</dt>
                <dd>{dimension}</dd>
              </div>
            ) : null}
            {bulk != null ? (
              <div>
                <dt className="text-muted-foreground font-medium">Bulk price</dt>
                <dd className="font-mono">{bulk}</dd>
              </div>
            ) : null}
            {avail != null ? (
              <div>
                <dt className="text-muted-foreground font-medium">
                  Available quantity
                </dt>
                <dd className="font-mono">{avail}</dd>
              </div>
            ) : null}
          </dl>
          {description ? (
            <div>
              <h3 className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                Description
              </h3>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {description}
              </p>
            </div>
          ) : null}
          {bins.length > 0 ? (
            <div>
              <h3 className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Bins
              </h3>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-muted/60">
                      <TableHead className="text-xs">Bin</TableHead>
                      <TableHead className="text-right text-xs">Avail</TableHead>
                      <TableHead className="text-right text-xs">WH id</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bins.map((b, i) => {
                      const binId = pickRoot(b, ["bin_id", "binId"]);
                      const wh = pickNumRoot(b, ["warehouse_id", "warehouseId"]);
                      const aq = pickNumRoot(b, [
                        "available_quantity",
                        "availableQuantity",
                      ]);
                      return (
                        <TableRow key={`${binId}-${i}`}>
                          <TableCell className="font-mono text-xs">
                            {binId || "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {aq != null ? aq : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {wh != null ? wh : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
          {row && !listingOf(row) ? (
            <p className="text-muted-foreground text-sm">
              No nested listing payload for this row.
            </p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function InboundSkuWisePage() {
  const [showImages, setShowImages] = React.useState(false);
  const [detailRow, setDetailRow] = React.useState<LotRow | null>(null);
  const [searchDraft, setSearchDraft] = React.useState("");
  const [searchKeyword, setSearchKeyword] = React.useState("");
  const [page, setPage] = React.useState(1);
  const perPage = 100;

  const [loading, setLoading] = React.useState(true);
  const [rows, setRows] = React.useState<LotRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [perPageResp, setPerPageResp] = React.useState(100);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("search_keyword", searchKeyword);
      params.set("page", String(page));
      params.set("count", String(perPage));
      const data = await apiFetch<unknown>(
        `/api/inbound/lot-listings?${params.toString()}`
      );
      const parsed = parseLotResponse(data);
      setRows(parsed.rows);
      setTotal(parsed.total);
      setCurrentPage(parsed.currentPage);
      setPerPageResp(parsed.perPage);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load lot listings");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [searchKeyword, page]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function applySearch() {
    setPage(1);
    setSearchKeyword(searchDraft.trim());
  }

  const totalPages = Math.max(1, Math.ceil(total / perPageResp));

  return (
    <div className="mx-auto max-w-[1920px] space-y-4 px-2 py-4 md:px-4">
      <AppPageTitle
        title="SKU Wise View"
        description="Purchase order lines by SKU from eautomate (lot listings). Links open Zap listing, vendor, or PO context where available."
      />

      <Card className="border-primary/10 shadow-sm">
        <CardHeader className="flex flex-col gap-4 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={showImages}
                onChange={(e) => setShowImages(e.target.checked)}
                className="border-input size-4 rounded"
              />
              Show Images ?
            </label>
          </div>
          <div className="flex w-full flex-col gap-2 sm:max-w-md sm:flex-1">
            <Label
              htmlFor="sku-wise-search"
              className="text-muted-foreground text-xs font-medium"
            >
              Search
            </Label>
            <div className="flex gap-2">
              <Input
                id="sku-wise-search"
                placeholder="Search po, sku id…"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applySearch();
                }}
              />
              <Button type="button" variant="secondary" onClick={applySearch}>
                Apply
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 px-4 py-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}
          {!loading && rows.length === 0 ? (
            <div className="px-4 py-8">
              <EmptyState
                title="No lot listings"
                description="Configure EAUTOMATE_COOKIE on the Zap server (.env.local), or adjust search. Data loads live from eautomate."
              />
            </div>
          ) : null}
          {!loading && rows.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/60 hover:bg-muted/60">
                      {showImages ? (
                        <TableHead className="w-14 whitespace-nowrap">
                          Image
                        </TableHead>
                      ) : null}
                      <TableHead className="whitespace-nowrap">Line id</TableHead>
                      <TableHead className="whitespace-nowrap">Sku Id</TableHead>
                      <TableHead className="whitespace-nowrap">Po Id</TableHead>
                      <TableHead>PO status</TableHead>
                      <TableHead className="whitespace-nowrap">
                        Vendor Id
                      </TableHead>
                      <TableHead className="min-w-[140px]">Vendor Name</TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Order Placed Quantity
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Fulfilled qty
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Cost received
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Avail qty
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        Expiry Date
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        Date Created
                      </TableHead>
                      <TableHead className="whitespace-nowrap">Updated</TableHead>
                      <TableHead>Created by</TableHead>
                      <TableHead className="w-[1%] whitespace-nowrap">
                        Details
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, idx) => {
                      const sku = skuIdOf(r);
                      const po = poIdOf(r);
                      const vid = vendorIdOf(r);
                      const exp = expiryOf(r);
                      const tone = expiryTone(exp);
                      const img = pickImageUrl(r);
                      return (
                        <TableRow
                          key={rowKey(r, idx)}
                          className={cn(
                            "hover:bg-muted/40",
                            idx % 2 === 1 ? "bg-muted/20" : ""
                          )}
                        >
                          {showImages ? (
                            <TableCell className="p-2">
                              {img ? (
                                <a
                                  href={img}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="relative block size-10 overflow-hidden rounded border bg-muted"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary eautomate CDN hosts */}
                                  <img
                                    src={img}
                                    alt=""
                                    width={40}
                                    height={40}
                                    className="size-10 object-cover"
                                  />
                                </a>
                              ) : (
                                <span className="text-muted-foreground text-xs">
                                  —
                                </span>
                              )}
                            </TableCell>
                          ) : null}
                          <TableCell className="font-mono text-xs">
                            {lineIdOf(r) || "—"}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {sku ? (
                              <Link
                                href={`/listings/${encodeURIComponent(sku)}`}
                                className="text-primary font-medium underline-offset-4 hover:underline"
                              >
                                {sku}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {po && vid ? (
                              <Link
                                href={`/inbound/vendors/${encodeURIComponent(vid)}?tab=purchase-orders`}
                                className="text-primary font-medium underline-offset-4 hover:underline"
                              >
                                {po}
                              </Link>
                            ) : po ? (
                              <Link
                                href="/inbound/purchase-orders"
                                className="text-primary font-medium underline-offset-4 hover:underline"
                              >
                                {po}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {displayPoStatus(statusOf(r))}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {vid ? (
                              <Link
                                href={`/inbound/vendors/${encodeURIComponent(vid)}`}
                                className="text-primary font-medium underline-offset-4 hover:underline"
                              >
                                {vid}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm">
                            {vendorNameOf(r) || "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {qtyOf(r)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {fulfilledQtyDisplay(r)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {costReceivedDisplay(r)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {availQtyDisplay(r)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "whitespace-nowrap text-xs font-medium",
                              tone === "expired" && "text-destructive",
                              tone === "soon" &&
                                "text-amber-600 dark:text-amber-400",
                              tone === "ok" && "text-orange-600 dark:text-orange-400"
                            )}
                          >
                            {formatExpiryDisplay(exp)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            {formatDisplayDateTime(createdAtOf(r))}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            {formatDisplayDateTime(updatedAtOf(r))}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {createdByOf(r) || "—"}
                          </TableCell>
                          <TableCell className="p-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={() => setDetailRow(r)}
                            >
                              Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 ? (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-sm">
                  <span className="text-muted-foreground">
                    Page {currentPage} of {totalPages} (~{total} rows)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1 || loading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages || loading}
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>

      <LotDetailsSheet
        row={detailRow}
        open={detailRow != null}
        onOpenChange={(next) => {
          if (!next) setDetailRow(null);
        }}
      />
    </div>
  );
}
