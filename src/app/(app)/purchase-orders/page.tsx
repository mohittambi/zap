"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export default function PurchaseOrdersPage() {
  const [draftSku, setDraftSku] = React.useState("");
  const [appliedSku, setAppliedSku] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<unknown>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!appliedSku.trim()) {
      return;
    }
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), count: "50" });
      const res = await apiFetch<unknown>(
        `/api/incoming_purchase_orders/listing_order_details/${encodeURIComponent(appliedSku.trim())}?${q}`
      );
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [appliedSku, page]);

  React.useEffect(() => {
    if (!appliedSku.trim()) return;
    void load();
  }, [load, appliedSku, page]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Purchase orders</h1>
        <p className="text-sm text-muted-foreground">
          Listing order details by secondary SKU.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Query</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="sku">SKU</Label>
            <Input
              id="sku"
              value={draftSku}
              onChange={(e) => setDraftSku(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const s = draftSku.trim();
                  if (!s) {
                    toast.message("Enter a SKU (po_secondary_sku)");
                    return;
                  }
                  setAppliedSku(s);
                  setPage(1);
                }
              }}
              className="min-h-11 font-mono"
            />
          </div>
          <Button
            className="min-h-11"
            onClick={() => {
              const s = draftSku.trim();
              if (!s) {
                toast.message("Enter a SKU (po_secondary_sku)");
                return;
              }
              setAppliedSku(s);
              setPage(1);
            }}
          >
            Load
          </Button>
        </CardContent>
      </Card>
      {appliedSku ? (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            {(() => {
              const rows: Record<string, unknown>[] = (() => {
                if (!data) return [];
                if (Array.isArray(data)) return data as Record<string, unknown>[];
                const d = data as Record<string, unknown>;
                if (Array.isArray(d.data)) return d.data as Record<string, unknown>[];
                if (Array.isArray(d.content)) return d.content as Record<string, unknown>[];
                if (typeof d === "object") return [d];
                return [];
              })();
              const cols = rows.length > 0 && rows[0]
                ? Object.keys(rows[0]).slice(0, 12)
                : ["po_id", "vendor_id", "sku_id", "quantity", "status", "created_at"];
              return (
                <>
                  <div className="flex items-center justify-between border-b px-4 py-2">
                    <span className="text-muted-foreground text-xs">
                      {!loading && rows.length > 0 ? `${rows.length} order(s)` : ""}
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={page <= 1 || loading}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev page</Button>
                      <Button variant="outline" size="sm" disabled={loading}
                        onClick={() => setPage((p) => p + 1)}>Next page</Button>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/60 hover:bg-muted/60">
                        {cols.map((c) => (
                          <TableHead key={c} className="whitespace-nowrap text-xs">
                            {c.replaceAll("_", " ")}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading
                        ? Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                              {cols.map((c) => (
                                <TableCell key={c}><Skeleton className="h-5 w-full" /></TableCell>
                              ))}
                            </TableRow>
                          ))
                        : rows.length === 0
                        ? (
                          <TableRow>
                            <TableCell colSpan={cols.length} className="text-muted-foreground py-10 text-center text-sm">
                              No purchase orders found for this SKU.
                            </TableCell>
                          </TableRow>
                        )
                        : rows.map((r, idx) => (
                          <TableRow key={idx} className={idx % 2 === 1 ? "bg-muted/20" : ""}>
                            {cols.map((c) => (
                              <TableCell key={c} className="font-mono text-xs">
                                {r[c] == null ? "—" : String(r[c])}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </>
              );
            })()}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
