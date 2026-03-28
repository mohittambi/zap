"use client";

import * as React from "react";
import Image from "next/image";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

type PackRow = { pack_combo_sku_id: string };

type Detail = {
  pack_combo_sku_id: string;
  effective_available_quantity: number;
  components: Array<{
    component_sku_id: string;
    quantity: number;
    listing: {
      sku_id: string;
      img_hd?: string | null;
      available_quantity: number;
    };
  }>;
};

export default function PacksCombosPage() {
  const [draft, setDraft] = React.useState("");
  const [keyword, setKeyword] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [list, setList] = React.useState<{
    total: number;
    content: PackRow[];
  } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [openSku, setOpenSku] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), count: "50" });
      if (keyword.trim()) q.set("search_keyword", keyword.trim());
      const res = await apiFetch<{ total: number; content: PackRow[] }>(
        `/api/inventory/secondary_listings/packs_and_combos/paginated?${q}`
      );
      setList(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      setList(null);
    } finally {
      setLoading(false);
    }
  }, [keyword, page]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!openSku) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void (async () => {
      try {
        const d = await apiFetch<Detail>(
          `/api/packs_combos/sku/${encodeURIComponent(openSku)}?detail=1`
        );
        if (!cancelled) setDetail(d);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed detail");
        if (!cancelled) setDetail(null);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openSku]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-primary text-2xl font-semibold">Packs And Combos</h1>
        <p className="text-sm text-muted-foreground">
          Expand a row to see bundle composition and effective availability.
        </p>
      </div>
      <Card className="border-primary/10 shadow-sm">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label>Search</Label>
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  setKeyword(draft);
                }
              }}
              placeholder="Search pack_combo_sku…"
              className="min-h-11 font-mono"
            />
          </div>
          <Button
            className="min-h-11"
            onClick={() => {
              setPage(1);
              setKeyword(draft);
            }}
          >
            Search
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">sr_no.</TableHead>
                  <TableHead>pack_combo_sku</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list?.content?.map((row, i) => (
                  <React.Fragment key={row.pack_combo_sku_id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() =>
                        setOpenSku((s) =>
                          s === row.pack_combo_sku_id ? null : row.pack_combo_sku_id
                        )
                      }
                    >
                      <TableCell className="tabular-nums text-muted-foreground">
                        {(page - 1) * 50 + i + 1}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{row.pack_combo_sku_id}</TableCell>
                    </TableRow>
                    {openSku === row.pack_combo_sku_id && (
                      <TableRow>
                        <TableCell colSpan={2} className="bg-muted/30 p-4">
                          {detailLoading ? (
                            <Skeleton className="h-32 w-full" />
                          ) : detail ? (
                            <div className="space-y-3">
                              <p className="font-semibold">
                                Effective available quantity:{" "}
                                <span className="text-primary text-lg">
                                  {detail.effective_available_quantity}
                                </span>
                              </p>
                              <div className="flex flex-wrap gap-3">
                                {detail.components.map((c) => (
                                  <div
                                    key={c.component_sku_id}
                                    className="flex max-w-xs gap-2 rounded-lg border bg-card p-2"
                                  >
                                    <div className="relative size-16 shrink-0">
                                      {c.listing.img_hd ? (
                                        <Image
                                          src={c.listing.img_hd}
                                          alt=""
                                          fill
                                          className="rounded object-cover"
                                          unoptimized
                                        />
                                      ) : (
                                        <div className="flex size-full items-center justify-center bg-muted text-[10px] text-muted-foreground">
                                          N/A
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-xs">
                                      <p className="font-mono font-semibold">{c.component_sku_id}</p>
                                      <p>
                                        Available [{c.listing.available_quantity}] · Units{" "}
                                        [{c.quantity}]
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No details</p>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          )}
          {!loading && (!list?.content?.length ? (
            <p className="text-muted-foreground text-sm">No pack/combo rows for this page.</p>
          ) : null)}
          <div className="mt-4 flex justify-between gap-2">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={!list || list.content.length < 50}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
