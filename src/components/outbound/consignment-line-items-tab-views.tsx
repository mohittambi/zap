"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-browser";
import {
  buildViewCsv,
  buildViewRows,
  CONSIGNMENT_LINE_VIEW_LABELS,
  downloadViewCsv,
  VIEW_COLUMNS,
  type ConsignmentLineItemFlatRow,
  type ConsignmentLineViewId,
} from "@/lib/outbound-consignment-line-views";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const TAB_ORDER: ConsignmentLineViewId[] = ["default", "box", "sku", "po"];

export function ConsignmentLineItemsTabViews({
  consignmentId,
}: Readonly<{ consignmentId: number }>) {
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [flat, setFlat] = React.useState<ConsignmentLineItemFlatRow[]>([]);
  const [view, setView] = React.useState<ConsignmentLineViewId>("default");

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const payload = await apiFetch<{ rows: ConsignmentLineItemFlatRow[] }>(
          `/api/outbound/consignments/${consignmentId}/line-items/rows`
        );
        if (!cancelled) setFlat(payload.rows ?? []);
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Failed to load line items");
          setFlat([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [consignmentId]);

  const activeRows = React.useMemo(() => buildViewRows(view, flat), [view, flat]);

  function handleDownload() {
    if (activeRows.length === 0) return;
    const csv = buildViewCsv(view, activeRows);
    const slug = view === "default" ? "default" : `${view}-wise`;
    downloadViewCsv(`consignment-${consignmentId}-${slug}-view.csv`, csv);
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Consignment line items</CardTitle>
        <CardDescription className="text-xs">
          Read-only views of saved packing. Use tabs to switch perspective; download exports the
          active tab as CSV.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs
          value={view}
          onValueChange={(v) => setView(v as ConsignmentLineViewId)}
          className="w-full"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList
              variant="line"
              className="bg-primary/15 w-full flex-wrap justify-start gap-1 p-1 sm:w-auto"
            >
              {TAB_ORDER.map((tabId) => (
                <TabsTrigger key={tabId} value={tabId} className="min-w-[100px] text-xs sm:text-sm">
                  {CONSIGNMENT_LINE_VIEW_LABELS[tabId]}
                </TabsTrigger>
              ))}
            </TabsList>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 self-end sm:self-auto"
              disabled={loading || activeRows.length === 0}
              onClick={handleDownload}
            >
              Download Current View
            </Button>
          </div>

          {TAB_ORDER.map((tabId) => {
            const tabRows = buildViewRows(tabId, flat);
            const columns = VIEW_COLUMNS[tabId];
            return (
            <TabsContent key={tabId} value={tabId} className="mt-4">
              {loading ? (
                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Loader2 className="size-4 animate-spin" />
                  Loading line items…
                </p>
              ) : err ? (
                <p className="text-destructive text-sm">{err}</p>
              ) : tabRows.length === 0 ? (
                <p className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
                  No saved line items for this consignment.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full min-w-[720px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-muted/60 border-b">
                        {columns.map((col) => (
                          <th
                            key={col.key}
                            className={cn(
                              "px-2 py-2 font-semibold whitespace-nowrap",
                              col.align === "right" && "text-right"
                            )}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {tabRows.map((row, i) => (
                        <tr key={`${tabId}-${i}`}>
                          {columns.map((col) => (
                            <td
                              key={col.key}
                              className={cn(
                                "px-2 py-2",
                                col.align === "right" && "text-right font-mono tabular-nums",
                                !col.align &&
                                  (col.key.includes("sku") ||
                                    col.key.includes("code") ||
                                    col.key === "box_name" ||
                                    col.key.includes("skus") ||
                                    col.key.includes("codes")) &&
                                  "font-mono"
                              )}
                            >
                              {row[col.key] ?? "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}
