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
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Consignment line items</CardTitle>
        <CardDescription className="text-xs">
          Read-only views of saved packing. Use tabs to switch perspective; download exports the
          active tab as CSV.
        </CardDescription>
      </CardHeader>
      <CardContent className="w-full p-0">
        <Tabs
          value={view}
          onValueChange={(v) => setView(v as ConsignmentLineViewId)}
          className="w-full gap-0"
        >
          <div className="flex w-full flex-col gap-0 border-b">
            <TabsList
              variant="line"
              className="bg-primary/15 grid h-auto w-full grid-cols-2 gap-0 rounded-none p-0 lg:grid-cols-4"
            >
              {TAB_ORDER.map((tabId) => (
                <TabsTrigger
                  key={tabId}
                  value={tabId}
                  className="h-10 w-full flex-1 rounded-none px-2 text-xs sm:text-sm"
                >
                  {CONSIGNMENT_LINE_VIEW_LABELS[tabId]}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="flex w-full justify-end border-b bg-muted/20 px-4 py-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={loading || activeRows.length === 0}
                onClick={handleDownload}
              >
                Download Current View
              </Button>
            </div>
          </div>

          {TAB_ORDER.map((tabId) => {
            const tabRows = buildViewRows(tabId, flat);
            const columns = VIEW_COLUMNS[tabId];
            return (
            <TabsContent key={tabId} value={tabId} className="mt-0 w-full pb-4 pt-4">
              {loading ? (
                <p className="text-muted-foreground flex items-center gap-2 px-4 text-sm">
                  <Loader2 className="size-4 animate-spin" />
                  Loading line items…
                </p>
              ) : err ? (
                <p className="text-destructive px-4 text-sm">{err}</p>
              ) : tabRows.length === 0 ? (
                <p className="text-muted-foreground mx-4 rounded-md border border-dashed p-4 text-sm">
                  No saved line items for this consignment.
                </p>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full table-fixed border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-muted/60 border-b">
                        {columns.map((col) => (
                          <th
                            key={col.key}
                            className={cn(
                              "px-3 py-2 font-semibold",
                              col.align === "right" ? "text-right" : "text-left"
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
                                "px-3 py-2 align-top break-words",
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
